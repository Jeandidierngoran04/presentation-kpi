// Fiche de stock d'un produit : tout son historique, comme un livre de compte.
// Stock initial, puis chaque entrée / sortie ajuste le stock ligne après
// ligne, avec les changements de statut intercalés. Lecture seule.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet, Filter, Flag, Package, Scale } from 'lucide-react'
import { useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'
import { messageErreur } from '../lib/erreurs'
import { dateVersInput, dureeLisible } from '../lib/dates'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getLocalisationsProduits } from '../lib/api/produits'
import { getChangementsStatut, getJournalStock, type ChangementStatut, type LigneJournal } from '../lib/api/suiviStock'
import { exporterExcel, nomFichierSur, type ValeurExport } from '../lib/export/fichiers'
import type { LocalisationProduit, ProduitAvecStock, StatutStock } from '../types/stock'
import { StatutBadge, STYLES_STATUT_STOCK } from '../components/dashboard/StatutBadge'
import { CLASSE_CHAMP_COMPACT, CLASSE_LABEL } from '../components/ui/styles'
import { CaseFiltre, PanneauFiltres, SectionFiltre } from '../components/ui/PanneauFiltres'
import { BandeauErreur } from '../components/ui/BandeauErreur'

type Periode = 'tout' | '7' | '30' | '90' | 'annee'

const PERIODES: { id: Periode; label: string }[] = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: '90', label: '3 mois' },
  { id: 'annee', label: 'Cette année' },
  { id: 'tout', label: 'Tout' },
]

/** Famille de mouvement proposée dans le filtre (la quarantaine regroupe les mises et libérations). */
type CategorieMvt = 'entree' | 'sortie' | 'reintegration' | 'transfert' | 'quarantaine' | 'deplacement' | 'ajustement' | 'inventaire'

const CATEGORIES: { id: CategorieMvt; label: string }[] = [
  { id: 'entree', label: 'Entrée' },
  { id: 'sortie', label: 'Sortie' },
  { id: 'reintegration', label: 'Réintégration' },
  { id: 'transfert', label: 'Transfert' },
  { id: 'quarantaine', label: 'Quarantaine' },
  { id: 'deplacement', label: 'Déplacement interne' },
  { id: 'ajustement', label: 'Ajustement' },
  { id: 'inventaire', label: 'Inventaire' },
]

function categorie(l: LigneJournal): CategorieMvt {
  if (l.type === 'deplacement') return l.delta === 0 ? 'deplacement' : 'quarantaine'
  if ((l.type === 'entree' || l.type === 'sortie') && l.delta === 0) return 'quarantaine'
  return l.type
}

const STATUTS_FILTRE: { id: StatutStock; label: string }[] = [
  { id: 'faible', label: 'Passage en alerte' },
  { id: 'rupture', label: 'Passage en rupture' },
  { id: 'normal', label: 'Retour à la normale' },
]

interface FiltresFiche {
  periode: Periode
  du: string
  au: string
  entrepotId: string
  types: CategorieMvt[]
  statuts: StatutStock[]
}

const FILTRES_DEFAUT: FiltresFiche = {
  periode: 'tout',
  du: '',
  au: '',
  entrepotId: '',
  types: CATEGORIES.map((c) => c.id),
  statuts: STATUTS_FILTRE.map((s) => s.id),
}

/** Dates du / au correspondant à un raccourci de période. */
function datesPeriode(p: Periode): { du: string; au: string } {
  if (p === 'tout') return { du: '', au: '' }
  const aujourdhui = new Date()
  const debut = new Date(aujourdhui)
  if (p === 'annee') debut.setMonth(0, 1)
  else debut.setDate(debut.getDate() - Number(p) + 1)
  return { du: dateVersInput(debut), au: dateVersInput(aujourdhui) }
}

const dateFr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR')

function libellePeriode(f: FiltresFiche): string {
  if (f.du && f.au) return f.periode !== 'tout' ? PERIODES.find((p) => p.id === f.periode)!.label : `${dateFr(f.du)} au ${dateFr(f.au)}`
  if (f.du) return `depuis le ${dateFr(f.du)}`
  if (f.au) return `jusqu'au ${dateFr(f.au)}`
  return 'Tout'
}

/** Toutes les cases cochées, ou aucune : pas de filtre (tout s'affiche). */
function sansFiltre(coches: unknown[], total: number): boolean {
  return coches.length === 0 || coches.length === total
}

/** Ajoute ou retire une valeur d'une liste de cases cochées. */
function basculerValeur<T>(liste: T[], valeur: T, coche: boolean): T[] {
  return coche ? (liste.includes(valeur) ? liste : [...liste, valeur]) : liste.filter((v) => v !== valeur)
}

/** Libellé clair de l'opération, selon le type et son effet sur le stock disponible. */
function libelleOperation(l: LigneJournal): string {
  switch (l.type) {
    case 'entree':
      return l.delta === 0 ? 'Entrée en quarantaine' : 'Entrée'
    case 'sortie':
      return l.delta === 0 ? 'Sortie de quarantaine' : 'Sortie'
    case 'reintegration':
      return 'Réintégration'
    case 'transfert':
      return l.delta < 0 ? 'Transfert envoyé' : 'Transfert reçu'
    case 'deplacement':
      return l.delta < 0 ? 'Mise en quarantaine' : l.delta > 0 ? 'Libération de quarantaine' : 'Déplacement interne'
    case 'ajustement':
      return 'Ajustement'
    case 'inventaire':
      return 'Inventaire'
  }
}

function statutPour(stock: number, produit: ProduitAvecStock | undefined): StatutStock | null {
  if (!produit) return null
  if (stock <= 0) return 'rupture'
  if (stock <= (produit.seuil_reappro ?? produit.stock_min)) return 'faible'
  return 'normal'
}

const CLASSE_STOCK: Record<StatutStock, string> = {
  normal: 'text-text',
  faible: 'text-warn-deep',
  rupture: 'text-danger-deep',
}

const LIBELLE_CHANGEMENT: Record<StatutStock, string> = {
  normal: 'Retour à la normale',
  faible: 'Passage en alerte',
  rupture: 'Passage en rupture',
}

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const nombre = (n: number) => n.toLocaleString('fr-FR')

type Ligne =
  | { genre: 'mouvement'; date: string; m: LigneJournal }
  | { genre: 'statut'; date: string; c: ChangementStatut; duree: number | null }

export function FicheStock() {
  const { ongletActifId } = useTabs()
  const { demandeFicheStock } = useSelection()
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [produitId, setProduitId] = useState<string | null>(null)
  const [saisieProduit, setSaisieProduit] = useState('')
  const champProduitRef = useRef<HTMLInputElement>(null)
  const [journal, setJournal] = useState<LigneJournal[] | null>(null)
  const [changements, setChangements] = useState<ChangementStatut[]>([])
  const [statutsIndisponibles, setStatutsIndisponibles] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtres, setFiltres] = useState<FiltresFiche>(FILTRES_DEFAUT)
  // Filtres en cours de modification dans le panneau (null = panneau fermé) : appliqués au clic sur « Appliquer ».
  const [brouillon, setBrouillon] = useState<FiltresFiche | null>(null)
  const { du, au, entrepotId, types, statuts } = filtres
  // Rejoue l'animation d'apparition des lignes quand le contenu change.
  const [cleAnimation, setCleAnimation] = useState(0)

  useEffect(() => {
    if (!demandeFicheStock) return
    setProduitId(demandeFicheStock.produitId)
  }, [demandeFicheStock])

  // Liste des produits (sélecteur) rechargée à chaque retour sur l'onglet.
  useEffect(() => {
    if (ongletActifId !== 'fiche-stock') return
    Promise.all([getProduitsAvecStock(), getLocalisationsProduits()])
      .then(([p, l]) => {
        setProduits(p)
        setLocalisations(l)
      })
      .catch((e) => setErreur(messageErreur(e)))
  }, [ongletActifId])

  // Recharge à l'ouverture d'un produit et à chaque retour sur l'onglet (pas en arrière-plan).
  useEffect(() => {
    if (!produitId || ongletActifId !== 'fiche-stock') return
    let actif = true
    setJournal(null)
    setErreur(null)
    getJournalStock(produitId)
      .then((j) => {
        if (!actif) return
        setJournal(j)
        setCleAnimation((k) => k + 1)
      })
      .catch((e) => actif && setErreur(messageErreur(e)))
    getChangementsStatut(produitId, 1000)
      .then((c) => {
        if (!actif) return
        setChangements(c)
        setStatutsIndisponibles(false)
      })
      .catch(() => {
        if (!actif) return
        setChangements([])
        setStatutsIndisponibles(true)
      })
    return () => {
      actif = false
    }
  }, [produitId, ongletActifId])

  const produit = produits.find((p) => p.id === produitId)

  useEffect(() => {
    if (produit) setSaisieProduit(produit.reference)
  }, [produit])

  // Ouverte sans produit (bouton Historique de Produits) : le curseur attend la référence.
  useEffect(() => {
    if (ongletActifId === 'fiche-stock' && !produitId) champProduitRef.current?.focus()
  }, [ongletActifId, produitId])

  function onSaisieProduit(texte: string) {
    setSaisieProduit(texte)
    const trouve = produits.find((p) => p.reference.toLowerCase() === texte.trim().toLowerCase())
    if (trouve && trouve.id !== produitId) setProduitId(trouve.id)
  }

  // Dépôts où le produit a bougé (pour le filtre).
  const depots = useMemo(() => {
    const parId = new Map<string, string>()
    for (const l of journal ?? []) parId.set(l.entrepot_id, l.entrepot_nom)
    return [...parId].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [journal])

  const calcul = useMemo(() => {
    if (!journal || !produitId) return null
    const parDepot = entrepotId !== ''
    const stockApres = (l: LigneJournal) => (parDepot ? l.stock_apres_depot : l.stock_apres)
    const lignesDepot = parDepot ? journal.filter((l) => l.entrepot_id === entrepotId) : journal
    const debut = du ? new Date(`${du}T00:00:00`).getTime() : null
    const fin = au ? new Date(`${au}T23:59:59.999`).getTime() : null
    const dansPeriode = (iso: string) => {
      const t = new Date(iso).getTime()
      return (debut == null || t >= debut) && (fin == null || t <= fin)
    }
    const avant = debut == null ? [] : lignesDepot.filter((l) => new Date(l.cree_le).getTime() < debut)
    const periodeLignes = lignesDepot.filter((l) => dansPeriode(l.cree_le))

    const stockActuel = (localisations.get(produitId) ?? [])
      .filter((loc) => !parDepot || loc.entrepot_id === entrepotId)
      .reduce((t, loc) => t + loc.quantite, 0)
    const stockInitial =
      avant.length > 0
        ? stockApres(avant[avant.length - 1])
        : lignesDepot.length > 0
          ? stockApres(lignesDepot[0]) - lignesDepot[0].delta
          : stockActuel
    const stockFinal = periodeLignes.length > 0 ? stockApres(periodeLignes[periodeLignes.length - 1]) : stockInitial
    // Le filtre par type masque des lignes, mais le stock de chaque ligne et le stock final restent réels.
    const visibles = sansFiltre(types, CATEGORIES.length) ? periodeLignes : periodeLignes.filter((l) => types.includes(categorie(l)))
    const totalEntrees = visibles.reduce((t, l) => t + l.entree, 0)
    const totalSorties = visibles.reduce((t, l) => t + l.sortie, 0)

    // Changements de statut (tous dépôts), avec le temps passé dans le statut précédent.
    const chrono = [...changements].sort((a, b) => a.date_changement.localeCompare(b.date_changement))
    const lignesStatut: Ligne[] = chrono.map((c, i) => ({
      genre: 'statut',
      date: c.date_changement,
      c,
      duree: i > 0 ? new Date(c.date_changement).getTime() - new Date(chrono[i - 1].date_changement).getTime() : null,
    }))
    const lignes: Ligne[] = [
      ...visibles.map((m): Ligne => ({ genre: 'mouvement', date: m.cree_le, m })),
      ...lignesStatut.filter((s) => s.genre === 'statut' && (sansFiltre(statuts, STATUTS_FILTRE.length) || statuts.includes(s.c.nouveau_statut)) && dansPeriode(s.date)),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.genre === 'mouvement' ? -1 : 1))

    return { parDepot, stockApres, stockInitial, stockFinal, totalEntrees, totalSorties, lignes, nbMouvements: visibles.length }
  }, [journal, produitId, entrepotId, du, au, types, statuts, changements, localisations])

  function exporter() {
    if (!calcul || !produit) return
    const colonnes = [
      { titre: 'Date', largeur: 18 },
      { titre: 'Document', largeur: 18 },
      { titre: 'Opération', largeur: 24 },
      { titre: 'Dépôt', largeur: 20 },
      { titre: 'Emplacement', largeur: 14 },
      { titre: 'Lot / Série', largeur: 14 },
      { titre: 'Entrée', largeur: 10 },
      { titre: 'Sortie', largeur: 10 },
      { titre: 'Stock', largeur: 10 },
      { titre: 'Opérateur', largeur: 20 },
      { titre: 'Motif / détail', largeur: 34 },
    ]
    const lignes: ValeurExport[][] = [
      [du ? new Date(`${du}T00:00:00`) : null, null, 'Stock initial', null, null, null, null, null, calcul.stockInitial, null, null],
      ...calcul.lignes.map((l): ValeurExport[] =>
        l.genre === 'mouvement'
          ? [
              new Date(l.m.cree_le),
              l.m.reference,
              libelleOperation(l.m),
              l.m.entrepot_nom,
              l.m.emplacement_origine_code ? `${l.m.emplacement_origine_code} > ${l.m.emplacement_code ?? ''}` : l.m.emplacement_code,
              l.m.numero_serie ?? l.m.lot,
              l.m.entree || null,
              l.m.sortie || null,
              calcul.stockApres(l.m),
              l.m.utilisateur_nom,
              l.m.motif,
            ]
          : [
              new Date(l.c.date_changement),
              l.c.reference,
              `${LIBELLE_CHANGEMENT[l.c.nouveau_statut]} (${STYLES_STATUT_STOCK[l.c.nouveau_statut].label})`,
              'Tous dépôts',
              null,
              null,
              null,
              null,
              l.c.stock,
              l.c.utilisateur_nom,
              l.duree != null ? `Après ${dureeLisible(l.duree)} en « ${STYLES_STATUT_STOCK[l.c.ancien_statut ?? 'normal'].label} »` : null,
            ],
      ),
      [au ? new Date(`${au}T23:59:59`) : new Date(), null, 'Stock final', null, null, null, calcul.totalEntrees, calcul.totalSorties, calcul.stockFinal, null, null],
    ]
    exporterExcel(nomFichierSur(`Fiche_de_stock_${produit.reference}_${dateVersInput(new Date())}`), colonnes, lignes, 'Fiche de stock').catch(
      (e) => setErreur(messageErreur(e)),
    )
  }

  const nomDepot = depots.find((d) => d.id === entrepotId)?.nom

  // Rappel des filtres actifs à côté du bouton Filtre.
  const partiesFiltre = [
    du || au ? libellePeriode(filtres) : null,
    nomDepot ?? null,
    sansFiltre(types, CATEGORIES.length) ? null : `${types.length} type(s) de mouvement`,
    sansFiltre(statuts, STATUTS_FILTRE.length) ? null : `${statuts.length} statut(s)`,
  ].filter((p): p is string => p != null)
  const nbFiltresActifs = partiesFiltre.length
  const resumeFiltres = partiesFiltre.join(' · ')

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 overflow-hidden">
      {/* Ligne 1 : bandeau produit, une seule ligne fine */}
      <div className="fiche-bandeau shrink-0 rounded-lg h-10 px-3 flex items-center gap-3">
        <Package size={16} strokeWidth={1.75} className="shrink-0 text-accent" />
        <h1 className="flex-1 min-w-0 text-[14px] font-semibold text-topbar-text truncate">
          <span className="text-topbar-muted font-normal">Fiche de stock · </span>
          {produit ? (
            <>
              <span className="font-mono">{produit.reference}</span>
              <span className="text-topbar-muted font-normal"> · {produit.designation}</span>
            </>
          ) : (
            'choisis un produit'
          )}
        </h1>
        {produit && (
          <div className="shrink-0 flex items-center gap-2 text-[12px] text-topbar-muted">
            <StatutBadge statut={produit.statut} />
            <span>
              Seuil d'alerte <span className="text-topbar-text font-semibold">{produit.seuil_reappro ?? produit.stock_min}</span>
            </span>
          </div>
        )}
        <input
          ref={champProduitRef}
          list="fiche-stock-produits"
          value={saisieProduit}
          onChange={(e) => onSaisieProduit(e.target.value)}
          placeholder="Produit (référence)..."
          aria-label="Produit"
          className="shrink-0 w-[170px] h-[26px] rounded-md bg-white/10 border border-white/15 px-2 text-xs font-mono text-topbar-text outline-none placeholder:text-topbar-muted focus:border-accent focus:ring-2 focus:ring-accent/40"
        />
        <datalist id="fiche-stock-produits">
          {produits.map((p) => (
            <option key={p.id} value={p.reference} label={p.designation} />
          ))}
        </datalist>
      </div>

      <BandeauErreur message={erreur} className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />

      {!produitId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
          Choisis le code ou la référence du produit en haut à droite pour afficher son historique.
        </div>
      ) : !calcul ? (
        <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
          {erreur ? 'Le journal ne peut pas être affiché pour le moment.' : 'Chargement du journal...'}
        </div>
      ) : (
        <>
          {/* Ligne 2 : chiffres clés sur une ligne, Filtre et Excel à droite */}
          <div key={`tuiles-${cleAnimation}`} className="shrink-0 flex items-center gap-2 flex-wrap">
            <Tuile
              couleur="var(--text-muted)"
              icone={<Flag size={13} strokeWidth={1.75} />}
              titre="Stock initial"
              valeur={calcul.stockInitial}
              aide={du ? `Stock au ${new Date(du).toLocaleDateString('fr-FR')}` : 'Stock avant le 1er mouvement'}
              index={0}
            />
            <Tuile
              couleur="var(--accent)"
              icone={<ArrowDownToLine size={13} strokeWidth={1.75} />}
              titre="Entrées"
              valeur={calcul.totalEntrees}
              signe="+"
              aide={`${calcul.nbMouvements} mouvement(s) affiché(s) sur la période`}
              index={1}
            />
            <Tuile
              couleur="var(--danger)"
              icone={<ArrowUpFromLine size={13} strokeWidth={1.75} />}
              titre="Sorties"
              valeur={calcul.totalSorties}
              signe="-"
              aide="Y compris les mises en quarantaine"
              index={2}
            />
            <Tuile
              couleur="var(--info)"
              icone={<Scale size={13} strokeWidth={1.75} />}
              titre="Stock final"
              valeur={calcul.stockFinal}
              aide={nomDepot ? `Dépôt ${nomDepot}` : 'Tous dépôts, hors quarantaine'}
              index={3}
            />

            <div className="ml-auto flex items-center gap-1.5">
              {resumeFiltres && (
                <span className="text-[11.5px] text-text-muted truncate max-w-[260px]" title={resumeFiltres}>
                  {resumeFiltres}
                </span>
              )}
              <button
                type="button"
                onClick={() => setBrouillon(filtres)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold transition-colors ${
                  nbFiltresActifs > 0 ? 'bg-accent-soft border-accent/50 text-accent-deep' : 'bg-card border-border text-text hover:bg-muted'
                }`}
              >
                <Filter size={13} strokeWidth={1.75} /> Filtre
                {nbFiltresActifs > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4 h-4 rounded-full bg-accent text-accent-contrast text-[10px] font-bold px-1">
                    {nbFiltresActifs}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={exporter}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-card border border-border text-xs font-semibold text-text hover:bg-muted"
              >
                <FileSpreadsheet size={13} strokeWidth={1.75} className="text-accent-deep" /> Excel
              </button>
            </div>
          </div>
          {statutsIndisponibles && (
            <p className="shrink-0 text-xs text-warn-deep">
              Les changements de statut s'afficheront après l'exécution de la migration « suivi des statuts » dans Supabase.
            </p>
          )}

          {brouillon && (
            <PanneauFiltres
              onFermer={() => setBrouillon(null)}
              onReinitialiser={() => setBrouillon(FILTRES_DEFAUT)}
              onAppliquer={() => {
                setFiltres(brouillon)
                setBrouillon(null)
              }}
            >
              <SectionFiltre
                titre="Mouvements"
                resume={sansFiltre(brouillon.types, CATEGORIES.length) ? 'Tous' : `${brouillon.types.length} sur ${CATEGORIES.length}`}
                ouvertParDefaut
              >
                <CaseFiltre
                  libelle={<span className="font-medium">Tous les mouvements</span>}
                  coche={brouillon.types.length === CATEGORIES.length}
                  onChange={(c) => setBrouillon({ ...brouillon, types: c ? CATEGORIES.map((x) => x.id) : [] })}
                />
                {CATEGORIES.map((c) => (
                  <CaseFiltre
                    key={c.id}
                    libelle={c.label}
                    coche={brouillon.types.includes(c.id)}
                    onChange={(coche) => setBrouillon({ ...brouillon, types: basculerValeur(brouillon.types, c.id, coche) })}
                  />
                ))}
              </SectionFiltre>
              <SectionFiltre
                titre="Statuts"
                resume={sansFiltre(brouillon.statuts, STATUTS_FILTRE.length) ? 'Tous' : `${brouillon.statuts.length} sur ${STATUTS_FILTRE.length}`}
              >
                <p className="text-[11.5px] text-text-muted">Changements de statut affichés dans le journal, à leur date.</p>
                <CaseFiltre
                  libelle={<span className="font-medium">Tous les statuts</span>}
                  coche={brouillon.statuts.length === STATUTS_FILTRE.length}
                  onChange={(c) => setBrouillon({ ...brouillon, statuts: c ? STATUTS_FILTRE.map((x) => x.id) : [] })}
                />
                {STATUTS_FILTRE.map((s) => (
                  <CaseFiltre
                    key={s.id}
                    libelle={s.label}
                    coche={brouillon.statuts.includes(s.id)}
                    onChange={(coche) => setBrouillon({ ...brouillon, statuts: basculerValeur(brouillon.statuts, s.id, coche) })}
                  />
                ))}
              </SectionFiltre>
              <SectionFiltre titre="Période" resume={libellePeriode(brouillon)}>
                <div className="flex flex-wrap gap-1">
                  {PERIODES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBrouillon({ ...brouillon, periode: p.id, ...datesPeriode(p.id) })}
                      className={`h-[26px] px-2.5 rounded-md text-xs font-medium border transition-all ${
                        brouillon.periode === p.id && (p.id !== 'tout' || (!brouillon.du && !brouillon.au))
                          ? 'fiche-pastille-active border-accent/60 text-text'
                          : 'border-border bg-card text-text-muted hover:text-text'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex flex-col gap-1">
                    <span className={CLASSE_LABEL}>Du</span>
                    <input
                      type="date"
                      value={brouillon.du}
                      max={brouillon.au || undefined}
                      onChange={(e) => setBrouillon({ ...brouillon, du: e.target.value, periode: 'tout' })}
                      className={CLASSE_CHAMP_COMPACT}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={CLASSE_LABEL}>Au</span>
                    <input
                      type="date"
                      value={brouillon.au}
                      min={brouillon.du || undefined}
                      onChange={(e) => setBrouillon({ ...brouillon, au: e.target.value, periode: 'tout' })}
                      className={CLASSE_CHAMP_COMPACT}
                    />
                  </label>
                </div>
              </SectionFiltre>
              <SectionFiltre titre="Dépôts" resume={depots.find((d) => d.id === brouillon.entrepotId)?.nom ?? 'Tous'}>
                {[{ id: '', nom: 'Tous les dépôts' }, ...depots].map((d) => (
                  <label key={d.id || 'tous'} className="flex items-center gap-2 h-7 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="fiche-stock-depot"
                      checked={brouillon.entrepotId === d.id}
                      onChange={() => setBrouillon({ ...brouillon, entrepotId: d.id })}
                      className="accent-[var(--accent)]"
                    />
                    {d.nom}
                  </label>
                ))}
              </SectionFiltre>
            </PanneauFiltres>
          )}

          {/* Journal */}
          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1 defilement-fin">
              <table className="tableau-dense tableau-ajuste">
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '7.5%' }} />
                  <col style={{ width: '7.5%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="text-left">
                    <th>Date</th>
                    <th title="Numéro du document qui a fait bouger le stock">Document</th>
                    <th>Opération</th>
                    <th>Dépôt / emplacement</th>
                    <th>Lot / série</th>
                    <th className="text-right" title="Quantité ajoutée au stock disponible">Entrée</th>
                    <th className="text-right" title="Quantité retirée du stock disponible">Sortie</th>
                    <th className="text-right" title="Stock disponible après l'opération">Stock</th>
                    <th>Opérateur</th>
                  </tr>
                </thead>
                <tbody key={`corps-${cleAnimation}-${entrepotId}-${du}-${au}`}>
                  <tr className="fiche-ligne fiche-ligne-borne" style={{ '--i': 0 } as CSSProperties}>
                    <td className="tabular-nums text-text-muted">{du ? new Date(du).toLocaleDateString('fr-FR') : 'Début'}</td>
                    <td />
                    <td className="font-semibold">Stock initial</td>
                    <td className="text-text-muted">{nomDepot ?? 'Tous dépôts'}</td>
                    <td />
                    <td />
                    <td />
                    <td className="text-right tabular-nums font-bold">{nombre(calcul.stockInitial)}</td>
                    <td />
                  </tr>
                  {calcul.lignes.map((l, i) =>
                    l.genre === 'mouvement' ? (
                      <LigneMouvement
                        key={l.m.id}
                        m={l.m}
                        stock={calcul.stockApres(l.m)}
                        statut={calcul.parDepot ? null : statutPour(calcul.stockApres(l.m), produit)}
                        index={i + 1}
                      />
                    ) : (
                      <LigneStatut key={`s-${l.c.id}`} c={l.c} duree={l.duree} index={i + 1} />
                    ),
                  )}
                  {calcul.lignes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-text-muted" style={{ height: 56 }}>
                        Aucun mouvement sur cette période.
                      </td>
                    </tr>
                  )}
                  <tr className="fiche-ligne fiche-ligne-borne fiche-ligne-finale" style={{ '--i': Math.min(calcul.lignes.length + 1, 30) } as CSSProperties}>
                    <td className="tabular-nums text-text-muted">{au ? new Date(au).toLocaleDateString('fr-FR') : "Aujourd'hui"}</td>
                    <td />
                    <td className="font-semibold">Stock final</td>
                    <td className="text-text-muted">{nomDepot ?? 'Tous dépôts'}</td>
                    <td />
                    <td className="text-right tabular-nums font-semibold text-accent-deep">+{nombre(calcul.totalEntrees)}</td>
                    <td className="text-right tabular-nums font-semibold text-danger-deep">-{nombre(calcul.totalSorties)}</td>
                    <td className="text-right tabular-nums font-bold">{nombre(calcul.stockFinal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Tuile({
  couleur,
  icone,
  titre,
  valeur,
  signe = '',
  aide,
  index,
}: {
  couleur: string
  icone: ReactNode
  titre: string
  valeur: number
  signe?: string
  aide: string
  index: number
}) {
  return (
    <div
      className="fiche-tuile rounded-lg bg-card h-8 px-2.5 flex items-center gap-1.5 whitespace-nowrap"
      style={{ '--c': couleur, '--i': index } as CSSProperties}
      title={aide}
    >
      <span className="fiche-tuile-icone">{icone}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{titre}</span>
      <span className="text-[15px] font-semibold tabular-nums text-text">
        {signe && valeur > 0 ? signe : ''}
        {nombre(valeur)}
      </span>
    </div>
  )
}

function LigneMouvement({ m, stock, statut, index }: { m: LigneJournal; stock: number; statut: StatutStock | null; index: number }) {
  const emplacement = m.emplacement_origine_code ? `${m.emplacement_origine_code} → ${m.emplacement_code ?? '—'}` : m.emplacement_code
  return (
    <tr className={`fiche-ligne ${m.delta > 0 ? 'fiche-ligne-entree' : m.delta < 0 ? 'fiche-ligne-sortie' : ''}`} style={{ '--i': Math.min(index, 30) } as CSSProperties}>
      <td className="tabular-nums text-text-muted">{dateHeure(m.cree_le)}</td>
      <td className="font-mono text-info-deep" title={m.reference}>
        {m.reference}
      </td>
      <td title={m.motif ?? undefined}>
        <span className="font-medium">{libelleOperation(m)}</span>
        {m.motif && <span className="text-text-muted"> · {m.motif}</span>}
      </td>
      <td title={`${m.entrepot_nom}${emplacement ? ` · ${emplacement}` : ''}`}>
        {m.entrepot_nom}
        {emplacement && <span className="text-text-muted font-mono text-[11px]"> · {emplacement}</span>}
      </td>
      <td className="font-mono text-[11px] text-text-muted">{m.numero_serie ?? m.lot ?? ''}</td>
      <td className="text-right tabular-nums font-semibold text-accent-deep">{m.entree > 0 ? `+${nombre(m.entree)}` : ''}</td>
      <td className="text-right tabular-nums font-semibold text-danger-deep">{m.sortie > 0 ? `-${nombre(m.sortie)}` : ''}</td>
      <td className={`text-right tabular-nums font-bold ${statut ? CLASSE_STOCK[statut] : ''}`}>{nombre(stock)}</td>
      <td className="text-text-muted">{m.utilisateur_nom ?? '—'}</td>
    </tr>
  )
}

function LigneStatut({ c, duree, index }: { c: ChangementStatut; duree: number | null; index: number }) {
  return (
    <tr className={`fiche-ligne fiche-ligne-statut fiche-statut-${c.nouveau_statut}`} style={{ '--i': Math.min(index, 30) } as CSSProperties}>
      <td className="tabular-nums text-text-muted">{dateHeure(c.date_changement)}</td>
      <td colSpan={8} style={{ maxWidth: 'none' }}>
        <span className="inline-flex items-center gap-2">
          <span className="fiche-statut-pastille">{LIBELLE_CHANGEMENT[c.nouveau_statut]}</span>
          {c.ancien_statut && <StatutBadge statut={c.ancien_statut} />}
          <span className="text-text-muted">→</span>
          <StatutBadge statut={c.nouveau_statut} />
          <span className="text-text-muted">
            stock {nombre(c.stock)}
            {c.seuil_alerte != null && <> · seuil {c.seuil_alerte}</>}
            {c.reference && (
              <>
                {' · '}
                <span className="text-text font-medium">{c.reference}</span>
              </>
            )}
            {duree != null && c.ancien_statut && <> · après {dureeLisible(duree)} en « {STYLES_STATUT_STOCK[c.ancien_statut].label} »</>}
            {c.origine === 'reprise' && <span title="Reconstitué à partir des anciens mouvements, avec les seuils actuels"> · reconstitué</span>}
          </span>
        </span>
      </td>
    </tr>
  )
}
