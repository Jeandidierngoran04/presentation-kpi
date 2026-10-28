// Fiche de stock d'un produit : tout son historique, comme un livre de compte.
// Stock initial, puis chaque entrée / sortie ajuste le stock ligne après
// ligne, avec les changements de statut intercalés. Lecture seule.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CalendarRange, FileSpreadsheet, Flag, Package, Scale } from 'lucide-react'
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

type Periode = 'tout' | '7' | '30' | '90' | 'annee'

const PERIODES: { id: Periode; label: string }[] = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: '90', label: '3 mois' },
  { id: 'annee', label: 'Cette année' },
  { id: 'tout', label: 'Tout' },
]

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
  const [journal, setJournal] = useState<LigneJournal[] | null>(null)
  const [changements, setChangements] = useState<ChangementStatut[]>([])
  const [statutsIndisponibles, setStatutsIndisponibles] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [periode, setPeriode] = useState<Periode>('tout')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [entrepotId, setEntrepotId] = useState('')
  const [afficherStatuts, setAfficherStatuts] = useState(true)
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

  function choisirPeriode(p: Periode) {
    setPeriode(p)
    const aujourdhui = new Date()
    if (p === 'tout') {
      setDu('')
      setAu('')
      return
    }
    const debut = new Date(aujourdhui)
    if (p === 'annee') debut.setMonth(0, 1)
    else debut.setDate(debut.getDate() - Number(p) + 1)
    setDu(dateVersInput(debut))
    setAu(dateVersInput(aujourdhui))
  }

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
    const totalEntrees = periodeLignes.reduce((t, l) => t + l.entree, 0)
    const totalSorties = periodeLignes.reduce((t, l) => t + l.sortie, 0)

    // Changements de statut (tous dépôts), avec le temps passé dans le statut précédent.
    const chrono = [...changements].sort((a, b) => a.date_changement.localeCompare(b.date_changement))
    const statuts: Ligne[] = chrono.map((c, i) => ({
      genre: 'statut',
      date: c.date_changement,
      c,
      duree: i > 0 ? new Date(c.date_changement).getTime() - new Date(chrono[i - 1].date_changement).getTime() : null,
    }))
    const lignes: Ligne[] = [
      ...periodeLignes.map((m): Ligne => ({ genre: 'mouvement', date: m.cree_le, m })),
      ...(afficherStatuts ? statuts.filter((s) => dansPeriode(s.date)) : []),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.genre === 'mouvement' ? -1 : 1))

    return { parDepot, stockApres, stockInitial, stockFinal, totalEntrees, totalSorties, lignes, nbMouvements: periodeLignes.length }
  }, [journal, produitId, entrepotId, du, au, changements, afficherStatuts, localisations])

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

  return (
    <div className="h-full flex flex-col gap-3 p-[var(--content-padding)] overflow-hidden">
      {/* Bandeau produit */}
      <div className="fiche-bandeau shrink-0 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-white/10 flex items-center justify-center">
          <Package size={20} strokeWidth={1.75} className="text-accent" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] uppercase tracking-wide text-topbar-muted">Fiche de stock</p>
          <h1 className="text-[17px] font-semibold text-topbar-text leading-tight truncate">
            {produit ? (
              <>
                <span className="font-mono">{produit.reference}</span>
                <span className="text-topbar-muted font-normal"> · {produit.designation}</span>
              </>
            ) : (
              'Choisis un produit'
            )}
          </h1>
        </div>
        {produit && (
          <div className="flex items-center gap-2 text-[12px] text-topbar-muted">
            <StatutBadge statut={produit.statut} />
            <span>
              Seuil d'alerte <span className="text-topbar-text font-semibold">{produit.seuil_reappro ?? produit.stock_min}</span>
            </span>
          </div>
        )}
        <label className="flex flex-col gap-1 w-[200px]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-topbar-muted">Produit</span>
          <input
            list="fiche-stock-produits"
            value={saisieProduit}
            onChange={(e) => onSaisieProduit(e.target.value)}
            placeholder="Référence..."
            className="h-[26px] rounded-md bg-white/10 border border-white/15 px-2 text-xs font-mono text-topbar-text outline-none placeholder:text-topbar-muted focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          <datalist id="fiche-stock-produits">
            {produits.map((p) => (
              <option key={p.id} value={p.reference} label={p.designation} />
            ))}
          </datalist>
        </label>
      </div>

      {erreur && <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}

      {!produitId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
          Ouvre la fiche depuis la fenêtre Info d'un produit (bouton « Avancé »), ou tape une référence ci-dessus.
        </div>
      ) : !calcul ? (
        <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
          {erreur ? 'Le journal ne peut pas être affiché pour le moment.' : 'Chargement du journal...'}
        </div>
      ) : (
        <>
          {/* Chiffres clés de la période */}
          <div key={`tuiles-${cleAnimation}`} className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Tuile
              couleur="var(--text-muted)"
              icone={<Flag size={15} strokeWidth={1.75} />}
              titre="Stock initial"
              valeur={calcul.stockInitial}
              aide={du ? `au ${new Date(du).toLocaleDateString('fr-FR')}` : 'avant le 1er mouvement'}
              index={0}
            />
            <Tuile
              couleur="var(--accent)"
              icone={<ArrowDownToLine size={15} strokeWidth={1.75} />}
              titre="Entrées"
              valeur={calcul.totalEntrees}
              signe="+"
              aide={`${calcul.nbMouvements} mouvement(s) sur la période`}
              index={1}
            />
            <Tuile
              couleur="var(--danger)"
              icone={<ArrowUpFromLine size={15} strokeWidth={1.75} />}
              titre="Sorties"
              valeur={calcul.totalSorties}
              signe="-"
              aide="y compris mises en quarantaine"
              index={2}
            />
            <Tuile
              couleur="var(--info)"
              icone={<Scale size={15} strokeWidth={1.75} />}
              titre="Stock final"
              valeur={calcul.stockFinal}
              aide={nomDepot ? `dépôt ${nomDepot}` : 'tous dépôts, hors quarantaine'}
              index={3}
            />
          </div>

          {/* Filtres avancés */}
          <div className="shrink-0 flex items-end gap-3 flex-wrap bg-muted/60 border border-border rounded-lg px-3 py-2">
            <div className="flex flex-col gap-1">
              <span className={`${CLASSE_LABEL} inline-flex items-center gap-1`}>
                <CalendarRange size={11} /> Période
              </span>
              <div className="flex items-center gap-1">
                {PERIODES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choisirPeriode(p.id)}
                    className={`h-[26px] px-2.5 rounded-md text-xs font-medium border transition-all ${
                      periode === p.id ? 'fiche-pastille-active border-accent/60 text-text' : 'border-border bg-card text-text-muted hover:text-text'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Du</span>
              <input
                type="date"
                value={du}
                max={au || undefined}
                onChange={(e) => {
                  setDu(e.target.value)
                  setPeriode('tout')
                }}
                className={`${CLASSE_CHAMP_COMPACT} w-[140px]`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Au</span>
              <input
                type="date"
                value={au}
                min={du || undefined}
                onChange={(e) => {
                  setAu(e.target.value)
                  setPeriode('tout')
                }}
                className={`${CLASSE_CHAMP_COMPACT} w-[140px]`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Dépôt</span>
              <select value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)} className={`${CLASSE_CHAMP_COMPACT} w-[170px]`}>
                <option value="">Tous les dépôts</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 h-[26px] text-xs text-text cursor-pointer select-none">
              <input type="checkbox" checked={afficherStatuts} onChange={(e) => setAfficherStatuts(e.target.checked)} className="accent-[var(--accent)]" />
              Changements de statut
            </label>
            <button
              type="button"
              onClick={exporter}
              className="ml-auto inline-flex items-center gap-1.5 h-[26px] px-3 rounded-md bg-card border border-border text-xs font-semibold text-text hover:bg-muted"
            >
              <FileSpreadsheet size={13} strokeWidth={1.75} className="text-accent-deep" /> Excel
            </button>
          </div>
          {statutsIndisponibles && (
            <p className="shrink-0 text-xs text-warn-deep">
              Les changements de statut s'afficheront après l'exécution de la migration « suivi des statuts » dans Supabase.
            </p>
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
    <div className="fiche-tuile rounded-xl bg-card px-3.5 py-2.5" style={{ '--c': couleur, '--i': index } as CSSProperties}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <span className="fiche-tuile-icone">{icone}</span>
        {titre}
      </div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums text-text leading-none">
        {signe && valeur > 0 ? signe : ''}
        {nombre(valeur)}
      </div>
      <div className="mt-1 text-[11px] text-text-muted truncate">{aide}</div>
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
