import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, FileCheck2, ListChecks, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaisieEnCours, useTabs } from '../context/TabsContext'
import { useConfirmation } from '../context/ConfirmationContext'
import { useToast } from '../context/ToastContext'
import { messageErreur } from '../lib/erreurs'
import { peutReintegrer } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import { dateVersInput, dateSaisieVersISO } from '../lib/dates'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { creerReintegration, getSortiesAReintegrer, type LigneReintegration } from '../lib/api/reintegrations'
import type { Emplacement, Entrepot, ProduitAvecStock, SortieAReintegrer } from '../types/stock'
import { useEtatPersistant } from '../lib/etatPersistant'
import { BandeauErreur } from '../components/ui/BandeauErreur'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_CHAMP_COMPACT, CLASSE_CHAMP_LECTURE, CLASSE_LABEL } from '../components/ui/styles'

/**
 * Ce qui a été sorti d'un produit, dans un dépôt, pour un même lot / N° de
 * série (ou sans lot) : une ou plusieurs lignes de sortie, de la plus récente
 * à la plus ancienne.
 */
interface Groupe {
  cle: string
  produitId: string
  reference: string
  designation: string
  entrepotId: string
  lot: string | null
  numeroSerie: string | null
  lignes: SortieAReintegrer[]
}

/** Une ligne du panier : un groupe (ou la part d'un bon), la quantité qui revient et où elle est rangée. */
interface LignePanier {
  cle: string
  groupe: Groupe
  /** Saisie par l'opérateur (vide au départ, sauf « bon entier »). */
  quantite: string
  emplacementId: string
}

/** Un bon de sortie qui a encore quelque chose à réintégrer. */
interface BonAReintegrer {
  id: string
  numero: string
  date: string
  lignes: SortieAReintegrer[]
}

const TOUS = ''

function libelleLot(l: { lot: string | null; numero_serie?: string | null; numeroSerie?: string | null }): string {
  const serie = l.numero_serie ?? l.numeroSerie ?? null
  if (l.lot && serie) return `${l.lot} / ${serie}`
  return l.lot ?? serie ?? ''
}

const cleGroupe = (l: SortieAReintegrer) => `${l.produit_id}|${l.entrepot_id}|${l.lot ?? ''}|${l.numero_serie ?? ''}`
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')
const reste = (lignes: SortieAReintegrer[]) => lignes.reduce((t, l) => t + l.quantite_disponible, 0)
const numerosBons = (lignes: SortieAReintegrer[]) => [...new Set(lignes.map((l) => l.bon_sortie_numero))].join(', ')

/** Regroupe des lignes de sortie par produit, dépôt et lot / N° de série ; les plus récentes d'abord. */
function regrouper(lignes: SortieAReintegrer[]): Groupe[] {
  const parCle = new Map<string, Groupe>()
  for (const l of lignes) {
    const cle = cleGroupe(l)
    const g = parCle.get(cle) ?? {
      cle,
      produitId: l.produit_id,
      reference: l.produit_reference,
      designation: l.produit_designation,
      entrepotId: l.entrepot_id,
      lot: l.lot,
      numeroSerie: l.numero_serie,
      lignes: [],
    }
    g.lignes.push(l)
    parCle.set(cle, g)
  }
  for (const g of parCle.values()) g.lignes.sort((a, b) => b.sortie_le.localeCompare(a.sortie_le))
  return [...parCle.values()]
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
 * Réintégration (retour en stock de tout ou partie de ce qui est sorti), en deux vues :
 * - « Choix » : la liste des produits s'ouvre avec « Créer » → « Saisir les
 *   éléments » ; seuls les produits sortis (et pas encore entièrement
 *   réintégrés) se cochent. Un produit sorti avec plusieurs lots / N° de série
 *   (ou de plusieurs dépôts) se déplie pour choisir lesquels ;
 * - « Panier » : la quantité qui revient et où elle est rangée, puis valider.
 * « Créer » propose aussi de reprendre un bon de sortie entier.
 * La quantité d'une ligne du panier est répartie sur les sorties d'origine,
 * de la plus récente à la plus ancienne.
 */
export function Reintegration() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ongletActifId } = useTabs()
  const { confirmer } = useConfirmation()
  const { afficherToast } = useToast()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [depotChoisi, setDepotChoisi] = useEtatPersistant('reintegration:depot', TOUS)
  const [lignesDispo, setLignesDispo] = useState<SortieAReintegrer[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [vue, setVue] = useEtatPersistant<'choix' | 'panier'>('reintegration:vue', 'choix')
  const [recherche, setRecherche] = useEtatPersistant('reintegration:recherche', '')
  const rechercheRef = useRef<HTMLInputElement>(null)
  /** La recherche et la liste des produits s'affichent avec « Créer » → « Saisir les éléments ». */
  const [listeVisible, setListeVisible] = useEtatPersistant('reintegration:liste', false)
  /** Groupes cochés dans la vue « Choix ». */
  const [coches, setCoches] = useEtatPersistant<Map<string, string>>('reintegration:coches', () => new Map())
  /** « Ajouter » a été tenté : les quantités manquantes passent en rouge. */
  const [tentativeChoix, setTentativeChoix] = useState(false)
  const [deplies, setDeplies] = useEtatPersistant<Set<string>>('reintegration:deplies', () => new Set())

  const [panier, setPanier] = useEtatPersistant<LignePanier[]>('reintegration:panier', [])
  const [tentative, setTentative] = useState(false)
  const [dateMouvement, setDateMouvement] = useEtatPersistant('reintegration:date', () => dateVersInput(new Date()))
  const [avecNote, setAvecNote] = useEtatPersistant('reintegration:avec-note', false)
  const [notes, setNotes] = useEtatPersistant('reintegration:notes', '')
  const [envoi, setEnvoi] = useState(false)
  // Panier ou cases cochées non validés : confirmation avant de fermer l'onglet.
  useSaisieEnCours('reintegration', panier.length > 0 || coches.size > 0)

  // Bulle « Créer » : bon de sortie entier ou saisie des éléments.
  const [bulleOuverte, setBulleOuverte] = useState(false)
  const [etapeBulle, setEtapeBulle] = useState<'choix' | 'bon'>('choix')
  const [rechercheBon, setRechercheBon] = useState('')

  const panierRef = useRef<HTMLDivElement>(null)
  const listeRef = useRef<HTMLDivElement>(null)
  const bulleRef = useRef<HTMLDivElement>(null)
  const estActif = ongletActifId === 'reintegration'

  function charger() {
    Promise.all([getEntrepots(), getProduitsAvecStock()])
      .then(async ([e, p]) => {
        const autorises = e.filter((ent) => peutReintegrer(profil?.role, ent.id, entrepotsAssignes))
        setEntrepots(autorises)
        setProduits(p)
        const [lignes, parDepot] = await Promise.all([
          getSortiesAReintegrer(null),
          Promise.all(autorises.map((ent) => getEmplacements(ent.id))),
        ])
        const depots = new Set(autorises.map((a) => a.id))
        const fraiches = lignes.filter((l) => depots.has(l.entrepot_id))
        setLignesDispo(fraiches)
        // Panier repris (actualisation, retour sur l'onglet) : on le recale sur les soldes du moment ;
        // ce qui a été réintégré entre-temps disparaît.
        const parId = new Map(fraiches.map((l) => [l.bon_sortie_ligne_id, l]))
        setPanier((prev) =>
          prev
            .map((p) => ({
              ...p,
              groupe: { ...p.groupe, lignes: p.groupe.lignes.flatMap((l) => parId.get(l.bon_sortie_ligne_id) ?? []) },
            }))
            .filter((p) => p.groupe.lignes.length > 0),
        )
        // Localisations de retour possibles, la Quarantaine exclue.
        setEmplacements(parDepot.flat().filter((em) => !em.est_quarantaine))
      })
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setChargement(false))
  }

  // Les onglets restent montés en arrière-plan : on recharge à chaque retour (une sortie a pu être faite entre-temps).
  useEffect(() => {
    if (estActif) charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estActif])

  const nomDepot = (id: string) => entrepots.find((e) => e.id === id)?.nom ?? '—'
  const dansPanier = useMemo(
    () => new Set(panier.flatMap((p) => p.groupe.lignes.map((l) => l.bon_sortie_ligne_id))),
    [panier],
  )
  const libres = (lignes: SortieAReintegrer[]) => lignes.filter((l) => !dansPanier.has(l.bon_sortie_ligne_id))

  const lignesDuDepot = useMemo(
    () => (depotChoisi === TOUS ? lignesDispo : lignesDispo.filter((l) => l.entrepot_id === depotChoisi)),
    [lignesDispo, depotChoisi],
  )

  // Ce qui peut revenir, par produit.
  const groupesParProduit = useMemo(() => {
    const parProduit = new Map<string, Groupe[]>()
    for (const g of regrouper(lignesDuDepot)) {
      parProduit.set(g.produitId, [...(parProduit.get(g.produitId) ?? []), g])
    }
    return parProduit
  }, [lignesDuDepot])

  // Liste des produits : ceux qu'on peut réintégrer d'abord, filtrés par la recherche
  // (référence, désignation, lot / N° de série ou n° de bon).
  const resultats = useMemo(() => {
    const terme = recherche.trim()
    return produits
      .filter((p) => {
        if (!terme) return true
        if (texteFiltre(p.reference, terme) || texteFiltre(p.designation, terme)) return true
        return (groupesParProduit.get(p.id) ?? []).some(
          (g) => texteFiltre(libelleLot(g), terme) || g.lignes.some((l) => texteFiltre(l.bon_sortie_numero, terme)),
        )
      })
      .sort((a, b) => Number(groupesParProduit.has(b.id)) - Number(groupesParProduit.has(a.id)))
  }, [produits, groupesParProduit, recherche])

  // Bons de sortie (bulle « Créer »), du plus récent au plus ancien, avec au moins une ligne hors panier.
  const bonsBulle = useMemo(() => {
    const parBon = new Map<string, BonAReintegrer>()
    for (const l of lignesDuDepot) {
      const bon = parBon.get(l.bon_sortie_id) ?? { id: l.bon_sortie_id, numero: l.bon_sortie_numero, date: l.sortie_le, lignes: [] }
      bon.lignes.push(l)
      parBon.set(l.bon_sortie_id, bon)
    }
    const terme = rechercheBon.trim()
    return [...parBon.values()]
      .filter((b) => b.lignes.some((l) => !dansPanier.has(l.bon_sortie_ligne_id)) && (!terme || texteFiltre(b.numero, terme)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [lignesDuDepot, dansPanier, rechercheBon])

  /** Coche (ou décoche) des groupes ; cocher met le curseur sur la première quantité à renseigner. */
  function cocherGroupes(cles: string[], coche: boolean, produitId?: string) {
    setCoches((prev) => {
      const suivant = new Map(prev)
      for (const cle of cles) {
        if (coche) suivant.set(cle, prev.get(cle) ?? '')
        else suivant.delete(cle)
      }
      return suivant
    })
    if (!coche || cles.length === 0) return
    // Produit à plusieurs lots : on le déplie pour saisir la quantité de chacun.
    if (produitId && cles.length > 1) setDeplies((prev) => new Set(prev).add(produitId))
    setTimeout(() => listeRef.current?.querySelector<HTMLInputElement>(`input[data-coche="${cles[0]}"]`)?.focus(), 30)
  }

  /** Problème de la quantité saisie dans la liste (null = correct). */
  function erreurQteChoix(cle: string, max: number): string | null {
    const texte = (coches.get(cle) ?? '').trim()
    if (!texte) return tentativeChoix ? 'Quantité à réintégrer manquante' : null
    const n = Number(texte)
    if (!Number.isInteger(n) || n <= 0) return 'Nombre entier plus grand que 0'
    if (n > max) return `Au plus ${max}`
    return null
  }

  /** Case de quantité de la liste, pour un groupe coché. */
  function caseQuantite(g: Groupe, max: number) {
    const erreurQte = erreurQteChoix(g.cle, max)
    return (
      <CaseErreur erreur={erreurQte} className="px-3 py-1">
        <span onClick={(e) => e.stopPropagation()}>
          <input
            type="number"
            min="1"
            max={max}
            data-coche={g.cle}
            value={coches.get(g.cle) ?? ''}
            onChange={(e) => {
              const valeur = e.target.value
              setCoches((prev) => new Map(prev).set(g.cle, valeur))
              setErreur(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ajouterAuPanier()
            }}
            aria-invalid={erreurQte != null}
            className={`${CLASSE_CHAMP_COMPACT} text-right ${erreurQte ? 'border-danger' : ''}`}
          />
        </span>
      </CaseErreur>
    )
  }

  function basculerDeplie(id: string) {
    setDeplies((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  /** Localisation de retour proposée : celle de la sortie la plus récente, sinon la première du dépôt. */
  function emplacementParDefaut(g: Groupe): string {
    const origine = g.lignes.find((l) => l.emplacement_id && emplacements.some((e) => e.id === l.emplacement_id))
    return origine?.emplacement_id ?? emplacements.find((e) => e.entrepot_id === g.entrepotId)?.id ?? ''
  }

  /** Groupes ajoutés au panier (sans les lignes déjà dedans), puis vue « Panier ». */
  function passerAuPanier(groupes: Groupe[], quantiteDe: (g: Groupe, resteLibre: number) => string) {
    const nouvelles: LignePanier[] = []
    for (const g of groupes) {
      const lignes = libres(g.lignes)
      if (lignes.length === 0) continue
      const groupe = { ...g, lignes }
      nouvelles.push({
        cle: Math.random().toString(36).slice(2),
        groupe,
        quantite: quantiteDe(g, reste(lignes)),
        emplacementId: emplacementParDefaut(groupe),
      })
    }
    setPanier((prev) => [...prev, ...nouvelles])
    setRecherche('')
    setErreur(null)
    setVue('panier')
    setTimeout(() => {
      const vide = [...(panierRef.current?.querySelectorAll<HTMLInputElement>('input[data-quantite]') ?? [])].find((i) => !i.value)
      vide?.focus()
    }, 60)
  }

  // Vue « Choix » → récapitulatif : chaque case cochée doit avoir sa quantité.
  function ajouterAuPanier() {
    const groupes = [...groupesParProduit.values()].flat().filter((g) => coches.has(g.cle))
    const fautif = groupes.find((g) => {
      const texte = (coches.get(g.cle) ?? '').trim()
      const n = Number(texte)
      return !texte || !Number.isInteger(n) || n <= 0 || n > reste(libres(g.lignes))
    })
    if (fautif) {
      setTentativeChoix(true)
      setDeplies((prev) => new Set(prev).add(fautif.produitId))
      setTimeout(() => listeRef.current?.querySelector<HTMLInputElement>(`input[data-coche="${fautif.cle}"]`)?.focus(), 30)
      return
    }
    passerAuPanier(groupes, (g) => (coches.get(g.cle) ?? '').trim())
    setCoches(new Map())
    setTentativeChoix(false)
  }

  /** Bulle « Créer » → bon entier : tout le reste du bon part au panier, quantités déjà remplies. */
  function reintegrerBonEntier(b: BonAReintegrer) {
    passerAuPanier(regrouper(b.lignes), (_g, resteLibre) => String(resteLibre))
    fermerBulle()
  }

  function ouvrirListe() {
    setListeVisible(true)
    setVue('choix')
    setTimeout(() => rechercheRef.current?.focus(), 30)
  }

  function saisirElements() {
    fermerBulle()
    ouvrirListe()
  }

  function fermerBulle() {
    setBulleOuverte(false)
    setEtapeBulle('choix')
    setRechercheBon('')
  }

  // Bulle « Créer » : se ferme au clic à côté ou sur Échap.
  useEffect(() => {
    if (!bulleOuverte) return
    function onClic(e: MouseEvent) {
      if (!bulleRef.current?.contains(e.target as Node)) fermerBulle()
    }
    function onTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') fermerBulle()
    }
    document.addEventListener('mousedown', onClic)
    window.addEventListener('keydown', onTouche)
    return () => {
      document.removeEventListener('mousedown', onClic)
      window.removeEventListener('keydown', onTouche)
    }
  }, [bulleOuverte])

  function majLigne(cle: string, champs: Partial<LignePanier>) {
    setPanier((prev) => prev.map((p) => (p.cle === cle ? { ...p, ...champs } : p)))
    setErreur(null)
  }

  /** Problème de quantité (null = correct). « Manquante » seulement après un essai de validation. */
  function erreurQuantite(p: LignePanier): string | null {
    const texte = p.quantite.trim()
    if (!texte) return tentative ? 'Quantité à réintégrer manquante' : null
    const n = Number(texte)
    if (!Number.isInteger(n) || n <= 0) return 'Nombre entier plus grand que 0'
    const max = reste(p.groupe.lignes)
    if (n > max) return `Au plus ${max}`
    return null
  }

  /** Répartit la quantité d'une ligne du panier sur ses sorties d'origine, les plus récentes d'abord. */
  function lignesEnvoyees(p: LignePanier): LigneReintegration[] {
    let resteARepartir = Number(p.quantite)
    const resultat: LigneReintegration[] = []
    for (const l of p.groupe.lignes) {
      if (resteARepartir <= 0) break
      const prise = Math.min(resteARepartir, l.quantite_disponible)
      if (prise > 0) resultat.push({ bonSortieLigneId: l.bon_sortie_ligne_id, emplacementId: p.emplacementId, quantite: prise })
      resteARepartir -= prise
    }
    return resultat
  }

  async function viderPanier() {
    const ok = await confirmer({
      titre: 'Vider le panier ?',
      message: `Les ${panier.length} ligne(s) du panier seront retirées. Rien ne revient en stock.`,
      libelleConfirmer: 'Vider le panier',
      danger: true,
    })
    if (!ok) return
    setPanier([])
    setTentative(false)
    setErreur(null)
    setVue('choix')
  }

  async function onValider() {
    if (panier.length === 0) return
    setTentative(true)
    const enErreur = panier.find((p) => {
      const n = Number(p.quantite.trim())
      return !p.quantite.trim() || !Number.isInteger(n) || n <= 0 || n > reste(p.groupe.lignes) || !p.emplacementId
    })
    if (enErreur) {
      setTimeout(() => panierRef.current?.querySelector<HTMLInputElement>(`input[data-quantite="${enErreur.cle}"]`)?.focus(), 30)
      return
    }
    const unites = panier.reduce((t, p) => t + Number(p.quantite), 0)
    const depots = [...new Set(panier.map((p) => nomDepot(p.groupe.entrepotId)))]
    const ok = await confirmer({
      titre: 'Valider la réintégration ?',
      message: `${panier.length} ligne(s), ${unites.toLocaleString('fr-FR')} unité(s) vont revenir en stock (${depots.join(', ')}). Une réintégration validée ne peut plus être modifiée.`,
      libelleConfirmer: 'Oui, valider',
    })
    if (!ok) return
    setErreur(null)
    setEnvoi(true)
    try {
      await creerReintegration(
        depotChoisi === TOUS ? panier[0].groupe.entrepotId : depotChoisi,
        avecNote ? notes.trim() || null : null,
        panier.flatMap(lignesEnvoyees),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
      )
      afficherToast('Réintégration effectuée')
      setPanier([])
      setTentative(false)
      setNotes('')
      setAvecNote(false)
      setVue('choix')
      charger()
    } catch (err) {
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
  }

  const nbACorriger = panier.filter((p) => erreurQuantite(p) != null).length
  const quantiteTotale = panier.reduce((t, p) => t + (Number(p.quantite) || 0), 0)

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête sur une ligne : dépôt, opérateur, date, note, Créer, Panier. */}
      <div className="shrink-0 bg-muted/50 rounded-lg border border-border px-3 py-2 flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1 w-[170px]">
          <span className={CLASSE_LABEL}>Dépôt</span>
          <select value={depotChoisi} onChange={(e) => setDepotChoisi(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
            <option value={TOUS}>Tous les dépôts</option>
            {entrepots.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 w-[160px]">
          <span className={CLASSE_LABEL}>Opérateur</span>
          <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
        </div>
        <label className="flex flex-col gap-1 w-[140px]">
          <span className={CLASSE_LABEL}>Date du mouvement</span>
          <input
            type="date"
            value={dateMouvement}
            max={dateVersInput(new Date())}
            onChange={(e) => setDateMouvement(e.target.value)}
            className={CLASSE_CHAMP_COMPACT}
          />
        </label>
        <label className="h-[26px] flex items-center gap-1.5 text-xs text-text cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={avecNote} onChange={(e) => setAvecNote(e.target.checked)} className="accent-[var(--accent)]" />
          Ajouter une note
        </label>
        {avecNote && (
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
            placeholder="Note (ex. retour de chantier)"
            className={`${CLASSE_CHAMP_COMPACT} w-[200px]`}
          />
        )}

        <div ref={bulleRef} className="relative shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => (bulleOuverte ? fermerBulle() : setBulleOuverte(true))}
            aria-expanded={bulleOuverte}
            className={`${CLASSE_BOUTON_PRIMAIRE} h-[30px] py-0`}
          >
            <Plus size={15} strokeWidth={1.75} /> Créer
          </button>
          {bulleOuverte && (
            <div className="absolute right-0 top-full mt-2 z-30 w-[360px] bg-card border border-border rounded-xl shadow-lg p-2 text-[13px]">
              <span className="absolute -top-1.5 right-6 w-3 h-3 rotate-45 bg-card border-l border-t border-border" />
              {etapeBulle === 'choix' ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setEtapeBulle('bon')}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted focus:bg-muted outline-none"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-accent-soft text-accent-deep inline-flex items-center justify-center">
                      <FileCheck2 size={16} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-text">Bon de sortie entier</span>
                      <span className="block text-xs text-text-muted">Tout ce qui reste du bon</span>
                    </span>
                    <ChevronRight size={15} strokeWidth={1.75} className="text-text-muted" />
                  </button>
                  <button
                    type="button"
                    onClick={saisirElements}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted focus:bg-muted outline-none"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-info-soft text-info-deep inline-flex items-center justify-center">
                      <ListChecks size={16} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-text">Saisir les éléments</span>
                      <span className="block text-xs text-text-muted">Choisir les produits et les quantités</span>
                    </span>
                    <ChevronRight size={15} strokeWidth={1.75} className="text-text-muted" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEtapeBulle('choix')
                        setRechercheBon('')
                      }}
                      className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-muted"
                      title="Retour"
                    >
                      <ChevronLeft size={16} strokeWidth={1.75} />
                    </button>
                    <span className="font-semibold text-text">Bon de sortie entier</span>
                  </div>
                  <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 h-9 bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
                    <Search size={14} strokeWidth={1.75} className="text-text-muted shrink-0" />
                    <input
                      autoFocus
                      value={rechercheBon}
                      onChange={(e) => setRechercheBon(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && bonsBulle.length > 0) reintegrerBonEntier(bonsBulle[0])
                      }}
                      placeholder="N° de bon"
                      className="text-[13px] bg-transparent text-text placeholder:text-text-muted outline-none w-full"
                    />
                  </div>
                  <div className="max-h-[260px] overflow-auto defilement-fin -mx-1">
                    {bonsBulle.length === 0 && <p className="text-xs text-text-muted text-center py-4">Aucun bon</p>}
                    {bonsBulle.map((b) => {
                      const restants = libres(b.lignes)
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => reintegrerBonEntier(b)}
                          className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-accent-soft/60 focus:bg-accent-soft/60 outline-none"
                        >
                          <span className="font-mono text-xs text-info-deep">{b.numero}</span>
                          <span className="text-xs text-text-muted">{dateCourte(b.date)}</span>
                          <span className="flex-1 text-right text-xs text-text-muted">
                            {restants.length} ligne(s) · <span className="font-semibold text-text">{reste(restants)}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {panier.length > 0 && vue === 'choix' && (
          <button
            type="button"
            onClick={() => setVue('panier')}
            className="shrink-0 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-lg border border-border bg-card text-[13px] font-semibold text-text hover:bg-muted"
            title="Voir le panier"
          >
            <ShoppingCart size={15} strokeWidth={1.75} /> Panier
            <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-accent text-accent-contrast text-[11px] font-bold px-1.5">
              {panier.length}
            </span>
          </button>
        )}
      </div>

      <BandeauErreur
        message={erreur ?? (vue === 'panier' && tentative && nbACorriger > 0 ? `${nbACorriger} ligne(s) à corriger : complète les quantités en rouge.` : null)}
        className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2"
      />

      {vue === 'choix' ? (
        !listeVisible ? (
          <div className="flex-1 min-h-0" />
        ) : (
          /* Vue « Choix » : la recherche, puis les produits, cochables seulement s'il y a eu une sortie à réintégrer. */
          <>
          <div className="shrink-0 flex items-center gap-2 border border-border rounded-lg px-3 h-10 bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
            <Search size={16} strokeWidth={1.75} className="text-text-muted shrink-0" />
            <input
              ref={rechercheRef}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Recherche"
              title="Référence, désignation, lot / N° de série ou n° de bon ; * devant un mot = contient"
              className="text-[13px] bg-transparent text-text placeholder:text-text-muted outline-none w-full"
            />
            {recherche && (
              <button type="button" onClick={() => setRecherche('')} className="text-text-muted hover:text-text" title="Effacer">
                <X size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div ref={listeRef} className="flex-1 overflow-auto defilement-fin">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                    <th className="h-8 px-3 w-10" />
                    <th className="h-8 w-8" />
                    <th className="font-semibold h-8 px-3">Référence</th>
                    <th className="font-semibold h-8 px-3">Désignation</th>
                    <th className="font-semibold h-8 px-3">Catégorie</th>
                    <th className="font-semibold h-8 px-3 text-right">Sorties</th>
                    <th className="font-semibold h-8 px-3 text-right">À réintégrer</th>
                    <th className="font-semibold h-8 px-3 w-32 text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-text-muted text-center py-8">
                        Aucun produit trouvé.
                      </td>
                    </tr>
                  )}
                  {resultats.map((p) => {
                    const groupes = groupesParProduit.get(p.id) ?? []
                    const groupesLibres = groupes.filter((g) => libres(g.lignes).length > 0)
                    const sansSortie = groupes.length === 0
                    const toutAuPanier = !sansSortie && groupesLibres.length === 0
                    const nbCoches = groupesLibres.filter((g) => coches.has(g.cle)).length
                    const produitCoche = groupesLibres.length > 0 && nbCoches === groupesLibres.length
                    // Plusieurs lots / N° de série ou plusieurs dépôts : on choisit lesquels.
                    const detaillable = groupes.length > 1 || groupes.some((g) => libelleLot(g) !== '')
                    const deplie = detaillable && deplies.has(p.id)
                    const toutesLignes = groupes.flatMap((g) => g.lignes)
                    const nbSorties = new Set(toutesLignes.map((l) => l.bon_sortie_id)).size
                    const bloque = sansSortie || toutAuPanier
                    return (
                      <Fragment key={p.id}>
                        <tr
                          onClick={() => !bloque && cocherGroupes(groupesLibres.map((g) => g.cle), !produitCoche, p.id)}
                          title={sansSortie ? 'Aucune sortie à réintégrer' : toutAuPanier ? 'Déjà au panier' : undefined}
                          className={`h-10 border-t border-border ${
                            sansSortie
                              ? 'opacity-45 cursor-not-allowed'
                              : toutAuPanier
                                ? 'bg-muted/60 cursor-default'
                                : produitCoche || nbCoches > 0
                                  ? 'bg-accent-soft/60 cursor-pointer'
                                  : 'hover:bg-muted cursor-pointer'
                          }`}
                        >
                          <td className="px-3" onClick={(e) => e.stopPropagation()}>
                            {toutAuPanier ? (
                              <Check size={16} strokeWidth={2.25} className="text-accent-deep" aria-label="Déjà au panier" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={produitCoche}
                                disabled={sansSortie}
                                ref={(el) => {
                                  if (el) el.indeterminate = nbCoches > 0 && !produitCoche
                                }}
                                onChange={(e) => cocherGroupes(groupesLibres.map((g) => g.cle), e.target.checked, p.id)}
                                aria-label={`Sélectionner ${p.reference}`}
                                className="accent-[var(--accent)] w-4 h-4 align-middle disabled:cursor-not-allowed"
                              />
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {detaillable && (
                              <button
                                type="button"
                                onClick={() => basculerDeplie(p.id)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-muted"
                                title={deplie ? 'Replier' : 'Lots / N° de série'}
                                aria-expanded={deplie}
                              >
                                <ChevronRight size={15} strokeWidth={1.75} className={`transition-transform ${deplie ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                          </td>
                          <td className="px-3 font-mono text-xs text-text-muted">{p.reference}</td>
                          <td className="px-3 font-medium text-text">{p.designation}</td>
                          <td className="px-3 text-text-muted">{p.categorie_nom ?? '—'}</td>
                          <td className="px-3 text-right text-text-muted">{sansSortie ? '—' : nbSorties}</td>
                          <td className="px-3 text-right font-semibold text-text">{sansSortie ? '—' : reste(libres(toutesLignes))}</td>
                          {/* Une seule ligne de sortie possible (sans lot) : la quantité se saisit ici ; sinon, lot par lot. */}
                          {!detaillable && groupesLibres.length === 1 && coches.has(groupesLibres[0].cle) ? (
                            caseQuantite(groupesLibres[0], reste(libres(groupesLibres[0].lignes)))
                          ) : (
                            <td />
                          )}
                        </tr>
                        {deplie &&
                          groupes.map((g) => {
                            const lignesLibres = libres(g.lignes)
                            const auPanier = lignesLibres.length === 0
                            const coche = coches.has(g.cle)
                            return (
                              <tr
                                key={g.cle}
                                onClick={() => !auPanier && cocherGroupes([g.cle], !coche)}
                                className={`h-9 border-t border-border/60 text-[12.5px] ${
                                  auPanier ? 'bg-muted/40' : coche ? 'bg-accent-soft/40 cursor-pointer' : 'hover:bg-muted/60 cursor-pointer'
                                }`}
                              >
                                <td />
                                <td className="px-1" onClick={(e) => e.stopPropagation()}>
                                  {auPanier ? (
                                    <Check size={14} strokeWidth={2.25} className="text-accent-deep" aria-label="Déjà au panier" />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={coche}
                                      onChange={(e) => cocherGroupes([g.cle], e.target.checked)}
                                      aria-label={`Sélectionner ${libelleLot(g) || 'sans lot'}`}
                                      className="accent-[var(--accent)] w-3.5 h-3.5 align-middle"
                                    />
                                  )}
                                </td>
                                <td className="px-3 font-mono text-xs text-text">{libelleLot(g) || '—'}</td>
                                <td className="px-3 font-mono text-[11px] text-info-deep truncate max-w-[320px]" title={numerosBons(g.lignes)}>
                                  {numerosBons(g.lignes)}
                                </td>
                                <td className="px-3 text-text-muted">{nomDepot(g.entrepotId)}</td>
                                <td className="px-3 text-right text-text-muted">{new Set(g.lignes.map((l) => l.bon_sortie_id)).size}</td>
                                <td className="px-3 text-right font-semibold text-text">{reste(lignesLibres)}</td>
                                {coche ? caseQuantite(g, reste(lignesLibres)) : <td />}
                              </tr>
                            )
                          })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-muted/50">
              {coches.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCoches(new Map())
                    setTentativeChoix(false)
                  }}
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
        )
      ) : (
        /* Vue « Panier » : sur toute la hauteur. */
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={ouvrirListe}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-text hover:bg-muted"
              >
                <Plus size={14} strokeWidth={1.75} /> Ajouter d'autres produits
              </button>
              <span className="text-[13px] font-semibold text-text">Récapitulatif</span>
              <span className="text-xs text-text-muted">
                <span className="font-semibold text-text">{panier.length}</span> ligne(s) · Quantité totale{' '}
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
                {envoi ? 'Validation...' : 'Valider'}
              </button>
            </div>
          </div>
          <div ref={panierRef} className="overflow-auto flex-1 defilement-fin">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-semibold h-9 px-3">Référence</th>
                  <th className="font-semibold h-9 px-3">Désignation</th>
                  <th className="font-semibold h-9 px-3">Dépôt</th>
                  <th className="font-semibold h-9 px-3">Lot / N° série</th>
                  <th className="font-semibold h-9 px-3">Bon(s) de sortie</th>
                  <th className="font-semibold h-9 px-3 text-right">Reste</th>
                  <th className="font-semibold h-9 px-3 w-32 text-right">Quantité</th>
                  <th className="font-semibold h-9 px-3">Localisation de retour</th>
                  <th className="h-9 px-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {panier.map((p) => {
                  const erreurQte = erreurQuantite(p)
                  const localisations = emplacements.filter((e) => e.entrepot_id === p.groupe.entrepotId)
                  return (
                    <tr key={p.cle} className="h-11 border-t border-border">
                      <td className="px-3 font-mono text-xs text-text-muted">{p.groupe.reference}</td>
                      <td className="px-3 font-medium text-text">{p.groupe.designation}</td>
                      <td className="px-3 text-text-muted">{nomDepot(p.groupe.entrepotId)}</td>
                      <td className="px-3 font-mono text-xs text-text">{libelleLot(p.groupe)}</td>
                      <td className="px-3 font-mono text-[11px] text-info-deep truncate max-w-[220px]" title={numerosBons(p.groupe.lignes)}>
                        {numerosBons(p.groupe.lignes)}
                      </td>
                      <td className="px-3 text-right font-semibold text-text">{reste(p.groupe.lignes)}</td>
                      <CaseErreur erreur={erreurQte} className="px-3 py-1">
                        <input
                          type="number"
                          min="1"
                          max={reste(p.groupe.lignes)}
                          data-quantite={p.cle}
                          value={p.quantite}
                          onChange={(e) => majLigne(p.cle, { quantite: e.target.value })}
                          aria-invalid={erreurQte != null}
                          className={`${CLASSE_CHAMP_COMPACT} text-right ${erreurQte ? 'border-danger' : ''}`}
                        />
                      </CaseErreur>
                      <td className="px-3 py-1">
                        <select
                          value={p.emplacementId}
                          onChange={(e) => majLigne(p.cle, { emplacementId: e.target.value })}
                          className={`${CLASSE_CHAMP_COMPACT} max-w-[180px] font-mono text-xs`}
                        >
                          {localisations.map((em) => (
                            <option key={em.id} value={em.id}>
                              {em.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPanier((prev) => prev.filter((x) => x.cle !== p.cle))}
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
