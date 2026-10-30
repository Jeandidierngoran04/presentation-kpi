import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { AlertTriangle, Check, FileSpreadsheet, Import, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaisieEnCours, useTabs } from '../context/TabsContext'
import { useConfirmation } from '../context/ConfirmationContext'
import { useSelection } from '../context/SelectionContext'
import { useToast } from '../context/ToastContext'
import { messageErreur } from '../lib/erreurs'
import { peutSaisirSortie } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import { dateVersInput, dateSaisieVersISO } from '../lib/dates'
import { getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getLocalisationsProduits } from '../lib/api/produits'
import { creerSortie } from '../lib/api/sorties'
import { comparerOrdreSortie, getStockLots, lotsDepuisLocalisations } from '../lib/api/lots'
import { normaliser } from '../lib/import/entrees'
import { lireFichierSorties, telechargerModeleSorties } from '../lib/import/sorties'
import type { Entrepot, ProduitAvecStock, StockLot } from '../types/stock'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_CHAMP_COMPACT, CLASSE_CHAMP_LECTURE, CLASSE_LABEL } from '../components/ui/styles'
import { BandeauErreur } from '../components/ui/BandeauErreur'

/** Une ligne du panier : un produit, son dépôt et la quantité à sortir. Les lots sont répartis automatiquement. */
interface LignePanier {
  cle: string
  produitId: string
  entrepotId: string
  quantite: string
  /** Lot imposé par l'opérateur (clé de lot) ; null = automatique (premier périmé, premier sorti). */
  lotImpose: string | null
}

/** Seuil (en jours) sous lequel une date d'expiration est signalée comme proche. */
const JOURS_ALERTE_EXPIRATION = 30
const TOUS = ''
const SANS_CATEGORIE = 'Sans catégorie'

/** Identifie un lot à l'écran, y compris en repli sans suivi par lot (id null). */
function cleLot(lot: StockLot): string {
  return lot.id ?? `emplacement:${lot.emplacement_id}`
}

/** Numéro de lot et / ou de série ; vide si le lot n'en a pas. */
function libelleLot(lot: Pick<StockLot, 'lot' | 'numero_serie'>): string {
  if (lot.lot && lot.numero_serie) return `${lot.lot} / ${lot.numero_serie}`
  return lot.lot ?? lot.numero_serie ?? ''
}

function formaterDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—'
}

/** Nombre de jours entre la date de référence (YYYY-MM-DD) et la date d'expiration ; négatif = périmé. */
function joursAvantExpiration(dateExpiration: string, dateReference: string): number {
  return Math.round((Date.parse(dateExpiration) - Date.parse(dateReference)) / 86_400_000)
}

function CelluleExpiration({ date, reference }: { date: string | null; reference: string }) {
  if (!date) return <span className="text-text-muted">—</span>
  const jours = joursAvantExpiration(date, reference)
  const ton =
    jours < 0
      ? 'bg-danger-soft text-danger-deep'
      : jours <= JOURS_ALERTE_EXPIRATION
        ? 'bg-warn-soft text-warn-deep'
        : null
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-text">{formaterDate(date)}</span>
      {ton && (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold uppercase leading-4 ${ton}`}>
          {jours < 0 ? 'Périmé' : `${jours} j`}
        </span>
      )}
    </span>
  )
}

/** Case en erreur : fond rouge, bulle qui dit quoi faire au survol ou quand le curseur y est. */
function CaseErreur({ erreur, children, className = '' }: { erreur: string | null; children: ReactNode; className?: string }) {
  return (
    <td className={`relative group/case ${className} ${erreur ? 'bg-danger-soft/60' : ''}`} aria-invalid={erreur ? true : undefined}>
      {children}
      {erreur && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-2 top-full z-20 -mt-1 hidden whitespace-nowrap rounded-md bg-danger px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover/case:block group-focus-within/case:block"
        >
          {erreur}
        </span>
      )}
    </td>
  )
}

/**
 * Feuille de saisie d'une sortie, en deux vues :
 * - « Choix » : recherche, catégories, import ; on coche les produits (avec
 *   une quantité si on la connaît déjà), puis « Ajouter » ;
 * - « Panier » : sur toute la hauteur, on complète les quantités, dépôts et
 *   lots, puis « Valider la sortie » (ou « Ajouter d'autres produits »).
 * Les lots sont répartis automatiquement (premier périmé, premier sorti, non
 * périmés d'abord) et peuvent être imposés. « Tous les dépôts » : chaque ligne
 * sort de son propre dépôt.
 */
export function NouvelleSortie() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ongletActifId, ouvrirOnglet, fermerOnglet } = useTabs()
  const { confirmer } = useConfirmation()
  const { demandeSortieManuelle, effacerDemandeSortie, signalerSortie } = useSelection()
  const { afficherToast } = useToast()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  /** Dépôt choisi en haut ; TOUS = chaque ligne a son dépôt. */
  const [depotChoisi, setDepotChoisi] = useState(TOUS)
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [lots, setLots] = useState<Map<string, StockLot[]>>(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [vue, setVue] = useState<'choix' | 'panier'>('choix')
  const [recherche, setRecherche] = useState('')
  const [categorie, setCategorie] = useState('')
  /** Produits cochés dans la vue « Choix », avec leur quantité éventuelle (vide = à saisir dans le panier). */
  const [coches, setCoches] = useState<Map<string, string>>(new Map())

  const [panier, setPanier] = useState<LignePanier[]>([])
  const [tentative, setTentative] = useState(false)
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [motif, setMotif] = useState('')
  const [recuPar, setRecuPar] = useState('')
  const recuParRef = useRef<HTMLInputElement>(null)
  const recuParManquant = tentative && !recuPar.trim()
  // Panier ou cases cochées non validés : confirmation avant de fermer l'onglet.
  useSaisieEnCours('nouvelle-sortie', panier.length > 0 || coches.size > 0)
  const [envoi, setEnvoi] = useState(false)

  const rechercheRef = useRef<HTMLInputElement>(null)
  const listeRef = useRef<HTMLDivElement>(null)
  const panierRef = useRef<HTMLDivElement>(null)
  const fichierRef = useRef<HTMLInputElement>(null)
  const estActif = ongletActifId === 'nouvelle-sortie'

  function chargerDonnees() {
    Promise.all([getEntrepots(), getProduitsAvecStock(), getLocalisationsProduits(), getStockLots()])
      .then(([e, p, l, lotsEnBase]) => {
        setEntrepots(e.filter((ent) => peutSaisirSortie(profil?.role, ent.id, entrepotsAssignes)))
        setProduits(p)
        // Sans suivi par lot en base : une ligne "sans lot" par emplacement.
        setLots(lotsEnBase ?? lotsDepuisLocalisations(l))
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Les onglets restent montés en arrière-plan : on recharge le stock à chaque retour sur celui-ci.
  useEffect(() => {
    if (estActif) chargerDonnees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estActif])

  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])
  const depotsAutorises = useMemo(() => new Set(entrepots.map((e) => e.id)), [entrepots])
  /** Date de référence pour juger un lot périmé : la date du mouvement saisie. */
  const dateReference = dateMouvement || dateVersInput(new Date())
  const estPerime = (l: StockLot) => l.date_expiration != null && joursAvantExpiration(l.date_expiration, dateReference) < 0

  /** Lots d'un produit dans un dépôt, dans l'ordre de sortie. */
  function lotsDuDepot(produitId: string, entrepotId: string): StockLot[] {
    return (lots.get(produitId) ?? []).filter((l) => l.entrepot_id === entrepotId && l.quantite > 0).sort(comparerOrdreSortie)
  }

  /** Stock d'un produit dans un dépôt donné, ou dans tous les dépôts autorisés. */
  function stockProduit(produitId: string, entrepotId: string = depotChoisi): number {
    return (lots.get(produitId) ?? [])
      .filter((l) => (entrepotId === TOUS ? depotsAutorises.has(l.entrepot_id) : l.entrepot_id === entrepotId))
      .reduce((t, l) => t + l.quantite, 0)
  }

  /** Dépôt proposé pour un produit : celui choisi en haut, sinon le dépôt autorisé qui en a le plus. */
  function depotParDefaut(produitId: string): string {
    if (depotChoisi !== TOUS) return depotChoisi
    return [...depotsAutorises].sort((a, b) => stockProduit(produitId, b) - stockProduit(produitId, a))[0] ?? ''
  }

  /** Répartition d'une ligne sur les lots : non périmés d'abord, dans l'ordre de sortie (ou le lot imposé). */
  function repartition(ligne: LignePanier): { lot: StockLot; quantite: number }[] {
    const tous = lotsDuDepot(ligne.produitId, ligne.entrepotId)
    const candidats = ligne.lotImpose
      ? tous.filter((l) => cleLot(l) === ligne.lotImpose)
      : [...tous.filter((l) => !estPerime(l)), ...tous.filter(estPerime)]
    let reste = Number(ligne.quantite) || 0
    const resultat: { lot: StockLot; quantite: number }[] = []
    for (const lot of candidats) {
      if (reste <= 0) break
      const prise = Math.min(reste, lot.quantite)
      resultat.push({ lot, quantite: prise })
      reste -= prise
    }
    return resultat
  }

  function disponibleLigne(ligne: LignePanier): number {
    if (ligne.lotImpose) return lotsDuDepot(ligne.produitId, ligne.entrepotId).find((l) => cleLot(l) === ligne.lotImpose)?.quantite ?? 0
    return stockProduit(ligne.produitId, ligne.entrepotId)
  }

  /** Problème d'une quantité saisie (null = correct). Vide : signalé seulement si `videInterdit`. */
  function erreurQuantite(texteBrut: string, max: number, videInterdit: boolean): string | null {
    const texte = texteBrut.trim()
    if (!texte) return videInterdit ? 'Quantité manquante' : null
    const n = Number(texte)
    if (!Number.isInteger(n) || n <= 0) return 'Nombre entier plus grand que 0'
    if (n > max) return `Il n'en reste que ${max}`
    return null
  }

  const categories = useMemo(
    () => [...new Set(produits.map((p) => p.categorie_nom ?? SANS_CATEGORIE))].sort((a, b) => a.localeCompare(b)),
    [produits],
  )

  // Liste : tous les produits, filtrés par catégorie puis par la recherche ("commence par", * = "contient").
  const resultats = useMemo(
    () =>
      produits.filter(
        (p) =>
          (!categorie || (p.categorie_nom ?? SANS_CATEGORIE) === categorie) &&
          (!recherche.trim() || texteFiltre(p.reference, recherche) || texteFiltre(p.designation, recherche)),
      ),
    [produits, recherche, categorie],
  )

  const dansPanier = useMemo(() => new Set(panier.map((l) => l.produitId)), [panier])
  // Cochables : en stock et pas encore au panier.
  const cochables = resultats.filter((p) => stockProduit(p.id) > 0 && !dansPanier.has(p.id))
  const toutCoche = cochables.length > 0 && cochables.every((p) => coches.has(p.id))

  function cocher(produitId: string, coche: boolean) {
    setCoches((prev) => {
      const suivant = new Map(prev)
      if (coche) suivant.set(produitId, prev.get(produitId) ?? '')
      else suivant.delete(produitId)
      return suivant
    })
  }

  function toutCocher(coche: boolean) {
    setCoches((prev) => {
      const suivant = new Map(prev)
      for (const p of cochables) {
        if (coche) suivant.set(p.id, prev.get(p.id) ?? '')
        else suivant.delete(p.id)
      }
      return suivant
    })
  }

  // Vue « Choix » → panier : les produits cochés passent au panier, les cases se vident.
  function ajouterAuPanier() {
    const fautive = [...coches].find(([id, q]) => erreurQuantite(q, stockProduit(id), false) != null)
    if (fautive) {
      const produit = produitParId.get(fautive[0])
      setErreur(`${produit?.reference ?? 'Un produit'} : ${erreurQuantite(fautive[1], stockProduit(fautive[0]), false)!.toLowerCase()}.`)
      setTimeout(() => listeRef.current?.querySelector<HTMLInputElement>(`input[data-quantite="${fautive[0]}"]`)?.focus(), 0)
      return
    }
    setPanier((prev) => [
      ...prev,
      ...[...coches]
        .filter(([id]) => !prev.some((l) => l.produitId === id))
        .map(([produitId, quantite]) => ({
          cle: Math.random().toString(36).slice(2),
          produitId,
          entrepotId: depotParDefaut(produitId),
          quantite,
          lotImpose: null,
        })),
    ])
    setCoches(new Map())
    setRecherche('')
    setErreur(null)
    setVue('panier')
    // Le curseur va sur la première quantité à compléter.
    setTimeout(() => {
      const vide = [...(panierRef.current?.querySelectorAll<HTMLInputElement>('input[data-quantite]') ?? [])].find((i) => !i.value)
      vide?.focus()
    }, 60)
  }

  function majLigne(cle: string, champs: Partial<LignePanier>) {
    setPanier((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...champs } : l)))
    // Une correction efface le message précédent ; ce qui reste à corriger est recalculé en continu.
    setErreur(null)
  }

  function onChangerDepotChoisi(id: string) {
    setDepotChoisi(id)
    // Un dépôt précis : toutes les lignes en sortent.
    if (id !== TOUS) setPanier((prev) => prev.map((l) => ({ ...l, entrepotId: id, lotImpose: null })))
  }

  async function viderPanier() {
    const ok = await confirmer({
      titre: 'Vider le panier ?',
      message: `Les ${panier.length} produit(s) du panier seront retirés. Rien ne sort du stock.`,
      libelleConfirmer: 'Vider le panier',
      danger: true,
    })
    if (!ok) return
    setPanier([])
    setTentative(false)
    setErreur(null)
    retourAuChoix()
  }

  function retourAuChoix() {
    setVue('choix')
    setErreur(null)
    setTimeout(() => rechercheRef.current?.focus(), 30)
  }

  // Depuis Produits (« Sorties » avec un produit sélectionné) : le produit est coché dans la vue « Choix ».
  useEffect(() => {
    if (!demandeSortieManuelle?.produitId || produits.length === 0 || entrepots.length === 0) return
    const produit = produits.find((p) => p.id === demandeSortieManuelle.produitId)
    effacerDemandeSortie()
    if (!produit) return
    if (stockProduit(produit.id) <= 0) {
      setErreur(`${produit.reference} est en rupture de stock.`)
      return
    }
    setVue('choix')
    setRecherche(produit.reference)
    cocher(produit.id, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeSortieManuelle, produits.length, entrepots.length])

  // --- Import d'une liste -----------------------------------------------------

  async function onFichierChoisi(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    try {
      const importees = await lireFichierSorties(fichier)
      const parReference = new Map(produits.map((p) => [p.reference.trim().toLowerCase(), p]))
      const trouvees: LignePanier[] = []
      const problemes: string[] = []
      for (const li of importees) {
        const homonymes = li.designation ? produits.filter((p) => normaliser(p.designation) === normaliser(li.designation)) : []
        const produit = (li.reference && parReference.get(li.reference.trim().toLowerCase())) || (homonymes.length === 1 ? homonymes[0] : undefined)
        if (!produit) {
          problemes.push(`ligne ${li.numeroFichier} : produit « ${li.reference || li.designation} » introuvable`)
          continue
        }
        const depot = li.depot ? entrepots.find((d) => normaliser(d.nom) === normaliser(li.depot)) : undefined
        if (li.depot && !depot) problemes.push(`ligne ${li.numeroFichier} : dépôt « ${li.depot} » introuvable (dépôt proposé à la place)`)
        trouvees.push({
          cle: Math.random().toString(36).slice(2),
          produitId: produit.id,
          entrepotId: depot?.id ?? depotParDefaut(produit.id),
          quantite: li.quantite,
          lotImpose: null,
        })
      }
      if (trouvees.length === 0) {
        setErreur(`Aucun produit reconnu dans le fichier. ${problemes.slice(0, 3).join(' · ')}`)
        return
      }
      const ok = await confirmer({
        titre: 'Ajouter au panier ?',
        message: (
          <>
            <p>
              <span className="font-semibold">{trouvees.length}</span> produit(s) reconnu(s) dans le fichier.
            </p>
            {problemes.length > 0 && (
              <ul className="text-xs text-danger-deep list-disc pl-4">
                {problemes.slice(0, 6).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {problemes.length > 6 && <li>et {problemes.length - 6} autre(s)</li>}
              </ul>
            )}
          </>
        ),
        libelleConfirmer: 'Ajouter au panier',
      })
      if (!ok) return
      // Un produit déjà au panier est mis à jour plutôt que dupliqué.
      setPanier((prev) => {
        const suivant = prev.map((l) => ({ ...l }))
        for (const t of trouvees) {
          const existante = suivant.find((l) => l.produitId === t.produitId)
          if (existante) Object.assign(existante, { quantite: t.quantite, entrepotId: t.entrepotId, lotImpose: null })
          else suivant.push(t)
        }
        return suivant
      })
      setVue('panier')
    } catch (err) {
      setErreur(messageErreur(err))
    }
  }

  // --- Validation ---------------------------------------------------------------

  const panierContientPerime = panier.some((l) => repartition(l).some((r) => estPerime(r.lot)))

  async function onValider() {
    if (panier.length === 0) return
    setTentative(true)
    const enErreur = panier.find((l) => erreurQuantite(l.quantite, disponibleLigne(l), true) != null || !l.entrepotId)
    if (enErreur) {
      setErreur(null)
      setTimeout(() => panierRef.current?.querySelector<HTMLInputElement>(`input[data-quantite="${enErreur.produitId}"]`)?.focus(), 30)
      return
    }
    // Une sortie est toujours destinée à quelqu'un (même contrôle côté base).
    if (!recuPar.trim()) {
      recuParRef.current?.focus()
      return
    }
    if (panierContientPerime && !motif.trim()) {
      return
    }
    const lignesBon = panier.flatMap((l) =>
      repartition(l).map((r) => ({ produitId: l.produitId, emplacementId: r.lot.emplacement_id, quantite: r.quantite, stockLotId: r.lot.id })),
    )
    const unites = lignesBon.reduce((t, l) => t + l.quantite, 0)
    const depots = [...new Set(panier.map((l) => entrepots.find((d) => d.id === l.entrepotId)?.nom ?? '—'))]
    const ok = await confirmer({
      titre: 'Valider la sortie ?',
      message: `${panier.length} produit(s), ${unites.toLocaleString('fr-FR')} unité(s) vont sortir du stock (${depots.join(', ')}) et le bon de sortie sera créé. Une sortie validée ne peut plus être modifiée.`,
      libelleConfirmer: 'Valider la sortie',
    })
    if (!ok) return
    setErreur(null)
    setEnvoi(true)
    try {
      const bon = await creerSortie(
        depotChoisi === TOUS ? panier[0].entrepotId : depotChoisi,
        motif.trim() || null,
        lignesBon,
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
        recuPar.trim(),
      )
      afficherToast(`Sortie effectuée : ${bon.numero}`)
      signalerSortie({ id: bon.id, numero: bon.numero, nbLignes: lignesBon.length, quantite: unites, recuPar: recuPar.trim() })
      // Retour sur la liste des sorties, puis fermeture de cet onglet.
      ouvrirOnglet('sorties', 'Sorties')
      fermerOnglet('nouvelle-sortie')
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
  }

  const quantiteTotale = panier.reduce((total, l) => total + (Number(l.quantite) || 0), 0)
  const nbACorriger = panier.filter((l) => erreurQuantite(l.quantite, disponibleLigne(l), tentative) != null).length

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête compact sur une ligne, commun aux deux vues. */}
      <div className="shrink-0 bg-muted/50 rounded-lg border border-border px-3 py-2 grid grid-cols-2 lg:grid-cols-[200px_170px_150px_minmax(180px,1fr)_minmax(220px,1.4fr)] gap-x-4 gap-y-2">
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Dépôt</span>
          <select value={depotChoisi} onChange={(e) => onChangerDepotChoisi(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
            <option value={TOUS}>Tous les dépôts</option>
            {entrepots.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Opérateur</span>
          <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
        </div>
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Date du mouvement</span>
          <input
            type="date"
            value={dateMouvement}
            max={dateVersInput(new Date())}
            onChange={(e) => setDateMouvement(e.target.value)}
            className={CLASSE_CHAMP_COMPACT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>
            Reçu par <span className="text-danger-deep">*</span>
          </span>
          <input
            ref={recuParRef}
            list="sortie-recu-par"
            value={recuPar}
            onChange={(e) => setRecuPar(e.target.value)}
            placeholder="Personne ou service"
            aria-required="true"
            aria-invalid={recuParManquant}
            title={recuParManquant ? 'Obligatoire : une personne, ou un service comme Logistique' : undefined}
            className={`${CLASSE_CHAMP_COMPACT} ${recuParManquant ? 'border-danger bg-danger-soft/60 focus:ring-danger/30' : ''}`}
          />
          <datalist id="sortie-recu-par">
            <option value="Logistique" />
            <option value="Supply chain" />
            <option value="Magasin" />
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>
            Motif / affectation
            {panierContientPerime && <span className="text-danger-deep"> · obligatoire (lot périmé)</span>}
          </span>
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={panierContientPerime ? 'Ex. mise au rebut' : 'Ex. Outillages Q400'}
            className={`${CLASSE_CHAMP_COMPACT} ${tentative && panierContientPerime && !motif.trim() ? 'border-danger bg-danger-soft/60' : ''}`}
          />
        </label>
      </div>

      {/* Reçu par et motif : messages recalculés en continu, ils disparaissent dès que le champ est rempli. */}
      <BandeauErreur
        message={
          erreur ??
          (recuParManquant
            ? 'Indique qui reçoit la sortie dans « Reçu par » : une personne, ou un service (ex. Logistique).'
            : tentative && panierContientPerime && !motif.trim()
              ? 'Un lot périmé va sortir : renseigne le motif (ex. mise au rebut) avant de valider.'
              : null)
        }
        className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2"
      />
      {vue === 'panier' && tentative && nbACorriger > 0 && (
        <div role="alert" className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">
          {nbACorriger} ligne(s) à corriger : complète les quantités en rouge.
        </div>
      )}

      {vue === 'choix' ? (
        <>
          {/* Vue « Choix » : recherche, catégories, import, puis la liste à cocher. */}
          <div className="shrink-0 flex items-start gap-2">
            <div className="flex-1 flex items-center gap-2 border border-border rounded-lg px-3 h-10 bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
              <Search size={16} strokeWidth={1.75} className="text-text-muted shrink-0" />
              <input
                ref={rechercheRef}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Recherche"
                title="Code ou désignation ; * devant un mot = contient"
                className="text-[13px] bg-transparent text-text placeholder:text-text-muted outline-none w-full"
              />
              {recherche && (
                <button type="button" onClick={() => setRecherche('')} className="text-text-muted hover:text-text" title="Effacer">
                  <X size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className={`shrink-0 h-10 px-3 rounded-lg border text-[13px] font-semibold outline-none cursor-pointer max-w-[240px] ${
                categorie ? 'bg-accent-soft border-accent/50 text-accent-deep' : 'bg-card border-border text-text'
              }`}
            >
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="shrink-0 flex flex-col items-center gap-0.5">
              <button
                type="button"
                onClick={() => fichierRef.current?.click()}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border bg-card text-[13px] font-semibold text-text hover:bg-muted"
              >
                <Import size={15} strokeWidth={1.75} /> Import
              </button>
              <button
                type="button"
                onClick={() => telechargerModeleSorties().catch((e) => setErreur(messageErreur(e)))}
                className="inline-flex items-center gap-1 text-[11px] text-info-deep hover:underline"
              >
                <FileSpreadsheet size={11} strokeWidth={1.75} /> Télécharger le modèle
              </button>
              <input ref={fichierRef} type="file" accept=".xlsx,.csv" onChange={onFichierChoisi} className="hidden" />
            </div>
            {panier.length > 0 && (
              <button
                type="button"
                onClick={() => setVue('panier')}
                className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border bg-card text-[13px] font-semibold text-text hover:bg-muted"
                title="Voir le panier"
              >
                <ShoppingCart size={15} strokeWidth={1.75} /> Panier
                <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-accent text-accent-contrast text-[11px] font-bold px-1.5">
                  {panier.length}
                </span>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div ref={listeRef} className="flex-1 overflow-auto defilement-fin">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                    <th className="h-8 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={toutCoche}
                        disabled={cochables.length === 0}
                        onChange={(e) => toutCocher(e.target.checked)}
                        title="Tout cocher"
                        aria-label="Tout cocher"
                        className="accent-[var(--accent)] w-4 h-4 align-middle"
                      />
                    </th>
                    <th className="font-semibold h-8 px-3">Référence</th>
                    <th className="font-semibold h-8 px-3">Désignation</th>
                    <th className="font-semibold h-8 px-3">Catégorie</th>
                    <th className="font-semibold h-8 px-3 text-right">Stock</th>
                    <th className="font-semibold h-8 px-3 w-32 text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-text-muted text-center py-6">
                        Aucun produit trouvé.
                      </td>
                    </tr>
                  )}
                  {resultats.map((p) => {
                    const stock = stockProduit(p.id)
                    const rupture = stock <= 0
                    const auPanier = dansPanier.has(p.id)
                    const coche = coches.has(p.id)
                    const bloque = rupture || auPanier
                    const erreurQte = coche ? erreurQuantite(coches.get(p.id) ?? '', stock, false) : null
                    return (
                      <tr
                        key={p.id}
                        onClick={() => !bloque && cocher(p.id, !coche)}
                        title={rupture ? 'Rupture de stock' : auPanier ? 'Déjà au panier' : undefined}
                        className={`h-10 border-t border-border ${
                          rupture
                            ? 'opacity-45 cursor-not-allowed'
                            : auPanier
                              ? 'bg-muted/60 cursor-default'
                              : coche
                                ? 'bg-accent-soft/60 cursor-pointer'
                                : 'hover:bg-muted cursor-pointer'
                        }`}
                      >
                        <td className="px-3" onClick={(e) => e.stopPropagation()}>
                          {auPanier ? (
                            <Check size={16} strokeWidth={2.25} className="text-accent-deep" aria-label="Déjà au panier" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={coche}
                              disabled={rupture}
                              onChange={(e) => cocher(p.id, e.target.checked)}
                              aria-label={`Sélectionner ${p.reference}`}
                              className="accent-[var(--accent)] w-4 h-4 align-middle disabled:cursor-not-allowed"
                            />
                          )}
                        </td>
                        <td className="px-3 font-mono text-xs text-text-muted">{p.reference}</td>
                        <td className="px-3 font-medium text-text">{p.designation}</td>
                        <td className="px-3 text-text-muted">{p.categorie_nom ?? '—'}</td>
                        <td className={`px-3 text-right font-semibold ${rupture ? 'text-danger-deep' : 'text-text'}`}>{stock}</td>
                        <CaseErreur erreur={erreurQte} className="px-3 py-1">
                          <span onClick={(e) => e.stopPropagation()}>
                            {coche && (
                              <input
                                type="number"
                                min="1"
                                max={stock}
                                data-quantite={p.id}
                                value={coches.get(p.id) ?? ''}
                                onChange={(e) => setCoches((prev) => new Map(prev).set(p.id, e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') ajouterAuPanier()
                                }}
                                className={`${CLASSE_CHAMP_COMPACT} text-right ${erreurQte ? 'border-danger' : ''}`}
                              />
                            )}
                          </span>
                        </CaseErreur>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-muted/50">
              {coches.size > 0 && (
                <button
                  type="button"
                  onClick={() => setCoches(new Map())}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-text hover:bg-muted"
                >
                  Tout décocher
                </button>
              )}
              <button type="button" onClick={ajouterAuPanier} disabled={coches.size === 0} className={`${CLASSE_BOUTON_PRIMAIRE} inline-flex items-center gap-1.5`}>
                <Plus size={15} strokeWidth={1.75} /> Ajouter{coches.size > 0 ? ` (${coches.size})` : ''}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Vue « Panier » : sur toute la hauteur. */
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={retourAuChoix}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-text hover:bg-muted"
              >
                <Plus size={14} strokeWidth={1.75} /> Ajouter d'autres produits
              </button>
              <span className="text-[13px] font-semibold text-text">Panier de sortie</span>
              <span className="text-xs text-text-muted">
                <span className="font-semibold text-text">{panier.length}</span> produit(s) · Quantité totale{' '}
                <span className="font-semibold text-text">{quantiteTotale.toLocaleString('fr-FR')}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={viderPanier}
                disabled={panier.length === 0}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
              >
                <Trash2 size={14} strokeWidth={1.75} /> Vider le panier
              </button>
              <button onClick={onValider} disabled={envoi || panier.length === 0} className={CLASSE_BOUTON_PRIMAIRE}>
                {envoi ? 'Validation...' : 'Valider la sortie'}
              </button>
            </div>
          </div>
          <div ref={panierRef} className="overflow-auto flex-1 defilement-fin">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-semibold h-9 px-3 w-10">#</th>
                  <th className="font-semibold h-9 px-3">Référence</th>
                  <th className="font-semibold h-9 px-3">Désignation</th>
                  <th className="font-semibold h-9 px-3">Dépôt</th>
                  <th className="font-semibold h-9 px-3 w-32 text-right">Quantité</th>
                  <th className="font-semibold h-9 px-3">Lot / N° série</th>
                  <th className="font-semibold h-9 px-3">Expiration</th>
                  <th className="font-semibold h-9 px-3">Localisation</th>
                  <th className="h-9 px-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {panier.map((l, index) => {
                  const produit = produitParId.get(l.produitId)
                  const rep = repartition(l)
                  const lotsDepot = lotsDuDepot(l.produitId, l.entrepotId)
                  const lotsNumerotes = lotsDepot.filter((x) => libelleLot(x) !== '')
                  // Seuls les lots qui ont un numéro s'affichent (rien sinon).
                  const lotsAffiches = rep
                    .filter((r) => libelleLot(r.lot) !== '')
                    .map((r) => (rep.length > 1 ? `${libelleLot(r.lot)} (${r.quantite})` : libelleLot(r.lot)))
                    .join(' + ')
                  const erreurQte = erreurQuantite(l.quantite, disponibleLigne(l), tentative)
                  const depotsAvecStock = entrepots.filter((d) => stockProduit(l.produitId, d.id) > 0 || d.id === l.entrepotId)
                  const expirations = rep.map((r) => r.lot.date_expiration).filter((d): d is string => d != null).sort()
                  const lotImpose = l.lotImpose ? lotsDepot.find((y) => cleLot(y) === l.lotImpose) : undefined
                  // Lot imposé alors qu'un lot non périmé devait sortir avant : avertissement (non bloquant).
                  const imposeHorsOrdre =
                    lotImpose != null && lotsDepot.some((x) => cleLot(x) !== l.lotImpose && !estPerime(x) && comparerOrdreSortie(x, lotImpose) < 0)
                  return (
                    <tr key={l.cle} className="h-11 border-t border-border">
                      <td className="px-3 text-text-muted">{index + 1}</td>
                      <td className="px-3 font-mono text-xs text-text-muted">{produit?.reference}</td>
                      <td className="px-3 font-medium text-text">{produit?.designation}</td>
                      <td className="px-3 py-1">
                        {depotChoisi === TOUS ? (
                          <select
                            value={l.entrepotId}
                            onChange={(e) => majLigne(l.cle, { entrepotId: e.target.value, lotImpose: null })}
                            className={`${CLASSE_CHAMP_COMPACT} max-w-[200px]`}
                          >
                            {depotsAvecStock.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.nom} ({stockProduit(l.produitId, d.id)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-text-muted">{entrepots.find((d) => d.id === l.entrepotId)?.nom ?? '—'}</span>
                        )}
                      </td>
                      <CaseErreur erreur={erreurQte} className="px-3 py-1">
                        <input
                          type="number"
                          min="1"
                          data-quantite={l.produitId}
                          value={l.quantite}
                          onChange={(e) => majLigne(l.cle, { quantite: e.target.value })}
                          aria-invalid={erreurQte != null}
                          className={`${CLASSE_CHAMP_COMPACT} text-right ${erreurQte ? 'border-danger' : ''}`}
                        />
                      </CaseErreur>
                      <td className="px-3 py-1">
                        {lotsNumerotes.length > 1 ? (
                          <span className="inline-flex items-center gap-1">
                            <select
                              value={l.lotImpose ?? ''}
                              onChange={(e) => majLigne(l.cle, { lotImpose: e.target.value || null })}
                              title={rep.length > 0 ? rep.map((r) => `${libelleLot(r.lot)} : ${r.quantite}`).join(' · ') : undefined}
                              className={`${CLASSE_CHAMP_COMPACT} font-mono text-xs max-w-[240px]`}
                            >
                              <option value="">{lotsAffiches || 'Automatique'}</option>
                              {lotsNumerotes.map((lot) => (
                                <option key={cleLot(lot)} value={cleLot(lot)}>
                                  {libelleLot(lot)}
                                  {lot.date_expiration ? ` · exp. ${formaterDate(lot.date_expiration)}` : ''}
                                </option>
                              ))}
                            </select>
                            {imposeHorsOrdre && (
                              <span title="Un lot plus ancien (ou qui expire avant) devrait sortir en premier" className="text-warn-deep">
                                <AlertTriangle size={14} strokeWidth={1.75} />
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-text-muted">{lotsAffiches}</span>
                        )}
                      </td>
                      <td className="px-3 text-xs">
                        <CelluleExpiration date={expirations[0] ?? null} reference={dateReference} />
                      </td>
                      <td className="px-3 text-text-muted font-mono text-xs">
                        {[...new Set((rep.length > 0 ? rep.map((r) => r.lot) : lotsDepot.slice(0, 1)).map((x) => x.emplacement_code))].join(', ') || '—'}
                      </td>
                      <td className="px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPanier((prev) => prev.filter((x) => x.cle !== l.cle))}
                          className="text-text-muted hover:text-danger"
                          title="Retirer du panier"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {panier.length === 0 && <p className="text-sm text-text-muted py-10 text-center">Panier vide</p>}
          </div>
        </div>
      )}
    </div>
  )
}
