import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Plus, Search, Trash2 } from 'lucide-react'
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
import type { Entrepot, LocalisationProduit, ProduitAvecStock, StockLot } from '../types/stock'
import {
  CLASSE_BOUTON_PRIMAIRE,
  CLASSE_BOUTON_PRIMAIRE_PETIT,
  CLASSE_CHAMP_COMPACT,
  CLASSE_CHAMP_LECTURE,
  CLASSE_LABEL,
} from '../components/ui/styles'

interface LignePanierSortie {
  cle: string
  produitId: string
  reference: string
  designation: string
  emplacementId: string
  emplacementCode: string
  /** Clé du lot dans l'écran (voir cleLot). */
  cleLot: string
  stockLotId: string | null
  lotLibelle: string
  dateExpiration: string | null
  quantite: number
}

/** Seuil (en jours) sous lequel une date d'expiration est signalée comme proche. */
const JOURS_ALERTE_EXPIRATION = 30

/** Identifie un lot à l'écran, y compris en repli sans suivi par lot (id null). */
function cleLot(lot: StockLot): string {
  return lot.id ?? `emplacement:${lot.emplacement_id}`
}

function libelleLot(lot: Pick<StockLot, 'lot' | 'numero_serie'>): string {
  if (lot.lot && lot.numero_serie) return `${lot.lot} / ${lot.numero_serie}`
  return lot.lot ?? lot.numero_serie ?? 'Sans lot'
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
    <span className="inline-flex items-center gap-1.5">
      <span className="text-text">{formaterDate(date)}</span>
      {ton && (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${ton}`}>
          {jours < 0 ? 'Périmé' : `${jours} j`}
        </span>
      )}
    </span>
  )
}

/**
 * Feuille de saisie d'une sortie, ouverte dans son propre onglet depuis la
 * liste des sorties du jour. À la validation, l'onglet se ferme et la liste
 * affiche le bon créé (bulle de confirmation + proposition d'impression).
 */
export function NouvelleSortie() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ongletActifId, ouvrirOnglet, fermerOnglet } = useTabs()
  const { confirmer } = useConfirmation()
  const { demandeSortieManuelle, effacerDemandeSortie, signalerSortie } = useSelection()
  const { afficherToast } = useToast()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [entrepotId, setEntrepotId] = useState('')
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [lots, setLots] = useState<Map<string, StockLot[]>>(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [avertissement, setAvertissement] = useState<string | null>(null)

  const [recherche, setRecherche] = useState('')
  const [produitEnPreparation, setProduitEnPreparation] = useState<ProduitAvecStock | null>(null)
  /** Quantité à sortir saisie pour chaque lot du produit en préparation (clé = cleLot). */
  const [quantites, setQuantites] = useState<Record<string, string>>({})
  const [panier, setPanier] = useState<LignePanierSortie[]>([])
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [motif, setMotif] = useState('')
  const [recuPar, setRecuPar] = useState('')
  // Panier non validé : confirmation avant de fermer l'onglet.
  useSaisieEnCours('nouvelle-sortie', panier.length > 0)
  const [envoi, setEnvoi] = useState(false)

  const rechercheRef = useRef<HTMLInputElement>(null)
  const lotsRef = useRef<HTMLDivElement>(null)
  const estActif = ongletActifId === 'nouvelle-sortie'

  function chargerDonnees() {
    Promise.all([getEntrepots(), getProduitsAvecStock(), getLocalisationsProduits(), getStockLots()])
      .then(([e, p, l, lotsEnBase]) => {
        const autorises = e.filter((ent) => peutSaisirSortie(profil?.role, ent.id, entrepotsAssignes))
        setEntrepots(autorises)
        setProduits(p)
        setLocalisations(l)
        // Sans suivi par lot en base (migration non exécutée) : une ligne "sans lot" par emplacement.
        setLots(lotsEnBase ?? lotsDepuisLocalisations(l))
        setEntrepotId((prev) => prev || autorises[0]?.id || '')
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Les onglets restent montés en arrière-plan : on recharge le stock à chaque
  // retour sur celui-ci (une réception a pu être validée entre-temps).
  useEffect(() => {
    if (estActif) chargerDonnees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estActif])

  /** Stock disponible (hors Quarantaine) de chaque produit dans le dépôt choisi. */
  const stockDepot = useMemo(() => {
    const parProduit = new Map<string, number>()
    for (const [produitId, lignes] of localisations) {
      const total = lignes.filter((l) => l.entrepot_id === entrepotId).reduce((somme, l) => somme + l.quantite, 0)
      if (total > 0) parProduit.set(produitId, total)
    }
    return parProduit
  }, [localisations, entrepotId])

  /** Stock disponible (hors Quarantaine) d'un produit dans chaque dépôt. */
  function stocksParDepot(produitId: string): Map<string, number> {
    const parDepot = new Map<string, number>()
    for (const l of localisations.get(produitId) ?? []) {
      parDepot.set(l.entrepot_id, (parDepot.get(l.entrepot_id) ?? 0) + l.quantite)
    }
    return parDepot
  }

  function quantiteAuPanier(cle: string): number {
    return panier.filter((l) => l.cleLot === cle).reduce((total, l) => total + l.quantite, 0)
  }

  /** Lots du produit en préparation dans ce dépôt, dans l'ordre de sortie, avec ce qu'il reste une fois le panier déduit. */
  const lotsDisponibles = (produitEnPreparation ? lots.get(produitEnPreparation.id) ?? [] : [])
    .filter((l) => l.entrepot_id === entrepotId)
    .map((l) => ({ ...l, cle: cleLot(l), restant: l.quantite - quantiteAuPanier(cleLot(l)) }))

  function selectionnerProduit(produit: ProduitAvecStock, depotId = entrepotId) {
    const stockParDepot = stocksParDepot(produit.id)
    setAvertissement(null)
    if ((stockParDepot.get(depotId) ?? 0) <= 0) {
      // Précise où se trouve le stock, s'il y en a dans un autre dépôt.
      const ailleurs = [...stockParDepot.entries()]
        .filter(([id, quantite]) => id !== depotId && quantite > 0)
        .map(([id, quantite]) => `${entrepots.find((e) => e.id === id)?.nom ?? 'autre dépôt'} : ${quantite}`)
      setProduitEnPreparation(null)
      setErreur(
        `${produit.reference} (${produit.designation}) est en rupture de stock dans ce dépôt : sortie impossible.` +
          (ailleurs.length > 0 ? ` Stock disponible ailleurs (${ailleurs.join(', ')}) : change de dépôt en haut à gauche.` : ''),
      )
      return
    }
    setErreur(null)
    setProduitEnPreparation(produit)
    setQuantites({})
    // Laisse le tableau des lots s'afficher avant de placer le curseur sur le premier lot à sortir.
    setTimeout(() => lotsRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus(), 0)
  }

  // Reagit au clic sur "Sorties Manuelles" dans le Sub-Header : si un produit
  // etait selectionne dans Produits, le prend en compte ici (meme si l'onglet
  // Sortie etait deja ouvert).
  useEffect(() => {
    if (!demandeSortieManuelle?.produitId || produits.length === 0) return
    const produit = produits.find((p) => p.id === demandeSortieManuelle.produitId)
    if (!produit) return
    setRecherche('')
    // On reste dans le dépôt en cours s'il a du stock pour ce produit ; sinon
    // on bascule sur le dépôt autorisé qui en a le plus.
    const stockParDepot = stocksParDepot(produit.id)
    const meilleurDepot = [...stockParDepot.entries()]
      .filter(([depotId]) => entrepots.some((e) => e.id === depotId))
      .sort((a, b) => b[1] - a[1])[0]?.[0]
    const depotCible = (stockParDepot.get(entrepotId) ?? 0) > 0 ? entrepotId : (meilleurDepot ?? entrepotId)
    if (depotCible !== entrepotId) {
      setEntrepotId(depotCible)
      setPanier([])
    }
    selectionnerProduit(produit, depotCible)
    effacerDemandeSortie()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeSortieManuelle, produits.length])

  // Recherche sur la référence ou la désignation ("commence par", * = "contient").
  const produitsFiltres = useMemo(
    () => produits.filter((p) => texteFiltre(p.reference, recherche) || texteFiltre(p.designation, recherche)),
    [produits, recherche],
  )

  function onChangerEntrepot(nouvelEntrepotId: string) {
    setEntrepotId(nouvelEntrepotId)
    setPanier([])
    setProduitEnPreparation(null)
    setErreur(null)
    setAvertissement(null)
  }

  function onValiderRecherche() {
    const terme = recherche.trim().toLowerCase()
    if (!terme) return
    const exact = produits.find((p) => p.reference.toLowerCase() === terme)
    const cible = exact ?? (produitsFiltres.length === 1 ? produitsFiltres[0] : null)
    if (cible) selectionnerProduit(cible)
    else if (produitsFiltres.length === 0) setErreur(`Aucune référence ne correspond à "${recherche}".`)
  }

  // Une ligne de panier par lot saisi : le bon de sortie détaille ainsi la
  // quantité prise dans chaque lot.
  function onAjouterAuPanier() {
    if (!produitEnPreparation) return
    const saisies = lotsDisponibles
      .filter((l) => (quantites[l.cle] ?? '').trim() !== '')
      .map((l) => ({ lot: l, quantite: Number(quantites[l.cle]) }))
    if (saisies.length === 0) {
      setErreur('Saisis une quantité à sortir sur au moins un lot.')
      return
    }
    for (const { lot, quantite } of saisies) {
      if (!Number.isInteger(quantite) || quantite <= 0) {
        setErreur(`Lot ${libelleLot(lot)} : quantité invalide.`)
        return
      }
      if (quantite > lot.restant) {
        setErreur(`Lot ${libelleLot(lot)} : quantité supérieure au disponible (${lot.restant}).`)
        return
      }
    }

    // Ordre conseillé (FEFO puis FIFO) : on prévient si un lot prioritaire est
    // laissé de côté alors qu'un lot moins prioritaire est sorti. Non bloquant.
    const quantiteSaisie = new Map(saisies.map((x) => [x.lot.cle, x.quantite]))
    const saute = lotsDisponibles.find(
      (prioritaire, i) =>
        prioritaire.restant - (quantiteSaisie.get(prioritaire.cle) ?? 0) > 0 &&
        lotsDisponibles
          .slice(i + 1)
          .some((suivant) => quantiteSaisie.has(suivant.cle) && comparerOrdreSortie(prioritaire, suivant) < 0),
    )
    setAvertissement(
      saute
        ? `Ordre de sortie non respecté pour ${produitEnPreparation.reference} : le lot ${libelleLot(saute)} (${
            saute.date_expiration
              ? `expire le ${formaterDate(saute.date_expiration)}`
              : `entré le ${formaterDate(saute.date_entree)}`
          }) devrait sortir en premier. Les lignes ont tout de même été ajoutées.`
        : null,
    )

    setErreur(null)
    setPanier((prev) => [
      ...prev,
      ...saisies.map(({ lot, quantite }) => ({
        cle: Math.random().toString(36).slice(2),
        produitId: produitEnPreparation.id,
        reference: produitEnPreparation.reference,
        designation: produitEnPreparation.designation,
        emplacementId: lot.emplacement_id,
        emplacementCode: lot.emplacement_code,
        cleLot: lot.cle,
        stockLotId: lot.id,
        lotLibelle: libelleLot(lot),
        dateExpiration: lot.date_expiration,
        quantite,
      })),
    ])
    setProduitEnPreparation(null)
    setQuantites({})
    setRecherche('')
    rechercheRef.current?.focus()
  }

  /** Date de référence pour juger un lot périmé : la date du mouvement saisie. */
  const dateReference = dateMouvement || dateVersInput(new Date())
  const panierContientPerime = panier.some(
    (l) => l.dateExpiration != null && joursAvantExpiration(l.dateExpiration, dateReference) < 0,
  )

  function onRetirerDuPanier(cle: string) {
    setPanier((prev) => prev.filter((l) => l.cle !== cle))
  }

  async function onValider() {
    if (panier.length === 0) {
      setErreur('Ajoute au moins un produit au panier.')
      return
    }
    if (panierContientPerime && !motif.trim()) {
      setErreur('Le panier contient un lot périmé : renseigne le motif (ex. mise au rebut) avant de valider.')
      return
    }
    const unites = panier.reduce((t, l) => t + l.quantite, 0)
    const ok = await confirmer({
      titre: 'Valider la sortie ?',
      message: `${panier.length} ligne(s), ${unites.toLocaleString('fr-FR')} unité(s) vont sortir du stock et le bon de sortie sera créé. Une sortie validée ne peut plus être modifiée.`,
      libelleConfirmer: 'Valider la sortie',
    })
    if (!ok) return
    setErreur(null)
    setEnvoi(true)
    try {
      const bon = await creerSortie(
        entrepotId,
        motif.trim() || null,
        panier.map((l) => ({
          produitId: l.produitId,
          emplacementId: l.emplacementId,
          quantite: l.quantite,
          stockLotId: l.stockLotId,
        })),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
        recuPar.trim() || null,
      )
      afficherToast(`Sortie effectuée : ${bon.numero}`)
      signalerSortie({
        id: bon.id,
        numero: bon.numero,
        nbLignes: panier.length,
        quantite: panier.reduce((total, l) => total + l.quantite, 0),
        recuPar: recuPar.trim() || null,
      })
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

  const quantiteTotalePanier = panier.reduce((total, l) => total + l.quantite, 0)

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête compact sur une ligne : laisse toute la hauteur à la recherche et au panier. */}
      <div className="shrink-0 bg-muted/50 rounded-lg border border-border px-3 py-2 grid grid-cols-2 lg:grid-cols-[200px_170px_150px_minmax(180px,1fr)_minmax(220px,1.4fr)] gap-x-4 gap-y-2">
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Dépôt</span>
          <select value={entrepotId} onChange={(e) => onChangerEntrepot(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
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
          <span className={CLASSE_LABEL}>Reçu par</span>
          <input
            value={recuPar}
            onChange={(e) => setRecuPar(e.target.value)}
            placeholder="Nom de la personne qui reçoit"
            className={CLASSE_CHAMP_COMPACT}
          />
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
            className={CLASSE_CHAMP_COMPACT}
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,320px)_1fr] gap-2">
        {/* Colonne gauche : recherche et liste des références */}
        <div className="bg-card rounded-lg border border-border p-2 flex flex-col gap-1.5 min-h-0">
          <div className="shrink-0 flex items-center gap-2 border border-border rounded-lg px-2.5 h-9 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
            <Search size={14} strokeWidth={1.75} className="text-text-muted shrink-0" />
            <input
              ref={rechercheRef}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onValiderRecherche()
              }}
              placeholder="Référence ou désignation..."
              className="text-[13px] bg-transparent text-text placeholder:text-text-muted outline-none w-full"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-semibold h-8 px-2">Référence</th>
                  <th className="font-semibold h-8 px-2">Désignation</th>
                  <th className="font-semibold h-8 px-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {produitsFiltres.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-text-muted text-center py-6">
                      Aucune référence trouvée.
                    </td>
                  </tr>
                )}
                {produitsFiltres.map((p) => {
                  const stock = stockDepot.get(p.id) ?? 0
                  return (
                    <tr
                      key={p.id}
                      onClick={() => selectionnerProduit(p)}
                      className={`h-8 cursor-pointer border-t border-border ${
                        produitEnPreparation?.id === p.id ? 'bg-accent-soft' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <td className={`px-2 font-mono ${stock > 0 ? 'text-text' : 'text-text-muted'}`}>{p.reference}</td>
                      <td className={`px-2 truncate max-w-[130px] ${stock > 0 ? 'text-text' : 'text-text-muted'}`} title={p.designation}>
                        {p.designation}
                      </td>
                      <td className={`px-2 text-right font-semibold ${stock > 0 ? 'text-text' : 'text-danger-deep'}`}>
                        {stock}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Colonne droite : ligne en préparation, puis le panier sur toute la hauteur restante */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="shrink-0 bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 grid grid-cols-[150px_minmax(0,1fr)_auto] gap-x-3 items-end">
              <div className="flex flex-col gap-1">
                <span className={CLASSE_LABEL}>Référence</span>
                <div className={`${CLASSE_CHAMP_LECTURE} font-mono`}>{produitEnPreparation?.reference ?? '—'}</div>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className={CLASSE_LABEL}>Désignation</span>
                <div className={`${CLASSE_CHAMP_LECTURE} truncate`}>{produitEnPreparation?.designation ?? '—'}</div>
              </div>
              <button
                type="button"
                onClick={onAjouterAuPanier}
                disabled={!produitEnPreparation}
                className={`${CLASSE_BOUTON_PRIMAIRE_PETIT} h-[26px]`}
              >
                <Plus size={13} strokeWidth={1.75} /> Ajouter au panier
              </button>
            </div>

            {/* Lots du produit, dans l'ordre de sortie : premier périmé d'abord, puis premier entré. */}
            <div ref={lotsRef} className="max-h-[30vh] overflow-auto border-t border-border">
              {!produitEnPreparation ? (
                <p className="text-xs text-text-muted py-4 text-center">
                  Choisis une référence à gauche pour voir ses lots, dans l'ordre où ils doivent sortir.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                      <th className="font-semibold h-8 px-3 w-14">Ordre</th>
                      <th className="font-semibold h-8 px-3">Lot / N° série</th>
                      <th className="font-semibold h-8 px-3">Expiration</th>
                      <th className="font-semibold h-8 px-3">Entré le</th>
                      <th className="font-semibold h-8 px-3">Localisation</th>
                      <th className="font-semibold h-8 px-3 text-right">Disponible</th>
                      <th className="font-semibold h-8 px-3 w-32 text-right">Qté à sortir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotsDisponibles.map((l, index) => (
                      <tr key={l.cle} className={`h-9 border-t border-border ${index === 0 ? 'bg-accent-soft/40' : ''}`}>
                        <td className="px-3 font-semibold text-text-muted">{index + 1}</td>
                        <td className={`px-3 font-mono ${l.lot || l.numero_serie ? 'text-text' : 'text-text-muted'}`}>
                          {libelleLot(l)}
                        </td>
                        <td className="px-3">
                          <CelluleExpiration date={l.date_expiration} reference={dateReference} />
                        </td>
                        <td className="px-3 text-text-muted">{formaterDate(l.date_entree)}</td>
                        <td className="px-3 font-mono text-text-muted">{l.emplacement_code}</td>
                        <td className="px-3 text-right font-semibold text-text">{l.restant}</td>
                        <td className="px-3">
                          <input
                            type="number"
                            min="1"
                            max={l.restant}
                            value={quantites[l.cle] ?? ''}
                            onChange={(e) => setQuantites((q) => ({ ...q, [l.cle]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onAjouterAuPanier()
                            }}
                            disabled={l.restant <= 0}
                            className={`${CLASSE_CHAMP_COMPACT} text-right`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {avertissement && (
            <div className="shrink-0 flex items-start gap-2 text-xs bg-warn-soft text-warn-deep rounded-lg px-3 py-2">
              <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0 mt-px" />
              {avertissement}
            </div>
          )}

          {erreur && <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}

          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
              <div className="flex items-baseline gap-3">
                <span className="text-[13px] font-semibold text-text">Panier de sortie</span>
                <span className="text-xs text-text-muted">
                  <span className="font-semibold text-text">{panier.length}</span> ligne(s) · Quantité totale{' '}
                  <span className="font-semibold text-text">{quantiteTotalePanier.toLocaleString('fr-FR')}</span>
                </span>
              </div>
              <button onClick={onValider} disabled={envoi || panier.length === 0} className={CLASSE_BOUTON_PRIMAIRE}>
                {envoi ? 'Validation...' : 'Valider la sortie'}
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                    <th className="font-semibold h-8 px-3 w-10">#</th>
                    <th className="font-semibold h-8 px-3">Référence</th>
                    <th className="font-semibold h-8 px-3">Désignation</th>
                    <th className="font-semibold h-8 px-3">Lot / N° série</th>
                    <th className="font-semibold h-8 px-3">Expiration</th>
                    <th className="font-semibold h-8 px-3">Localisation</th>
                    <th className="font-semibold h-8 px-3 text-right">Quantité</th>
                    <th className="h-8 px-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {panier.map((l, index) => (
                    <tr key={l.cle} className="h-9 border-t border-border hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-3 text-text-muted">{index + 1}</td>
                      <td className="px-3 font-mono text-xs text-text-muted">{l.reference}</td>
                      <td className="px-3 font-medium text-text">{l.designation}</td>
                      <td className="px-3 font-mono text-xs text-text-muted">{l.lotLibelle}</td>
                      <td className="px-3 text-xs">
                        <CelluleExpiration date={l.dateExpiration} reference={dateReference} />
                      </td>
                      <td className="px-3 text-text-muted font-mono text-xs">{l.emplacementCode}</td>
                      <td className="px-3 text-right font-semibold text-text">{l.quantite}</td>
                      <td className="px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onRetirerDuPanier(l.cle)}
                          className="text-text-muted hover:text-danger"
                          title="Retirer du panier"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {panier.length === 0 && (
                <p className="text-sm text-text-muted py-10 text-center">
                  Le panier est vide. Choisis une référence à gauche, saisis la quantité à sortir par lot, puis ajoute-la.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
