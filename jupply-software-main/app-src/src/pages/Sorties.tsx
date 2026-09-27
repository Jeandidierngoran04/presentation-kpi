import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSelection } from '../context/SelectionContext'
import { peutSaisirSortie } from '../lib/permissions'
import { texteFiltre } from '../lib/filtreTexte'
import { dateVersInput, dateSaisieVersISO } from '../lib/dates'
import { getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getLocalisationsProduits } from '../lib/api/produits'
import { creerSortie } from '../lib/api/sorties'
import type { Entrepot, LocalisationProduit, ProduitAvecStock } from '../types/stock'

const CLASSE_INPUT = 'border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 h-[26px]'
const CLASSE_CHAMP_LECTURE = 'bg-muted rounded-md px-2 py-1 text-xs text-text h-[26px] flex items-center'
const CLASSE_LABEL = 'text-[9px] font-medium text-text-muted uppercase tracking-wide leading-none'
const CLASSE_BOUTON_PRIMAIRE =
  'bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 px-5 transition-colors disabled:opacity-60'

interface LignePanierSortie {
  cle: string
  produitId: string
  reference: string
  designation: string
  emplacementId: string
  emplacementCode: string
  quantite: number
}

export function Sorties() {
  const { profil, entrepotsAssignes } = useAuth()
  const { demandeSortieManuelle } = useSelection()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [entrepotId, setEntrepotId] = useState('')
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [recherche, setRecherche] = useState('')
  const [produitEnPreparation, setProduitEnPreparation] = useState<ProduitAvecStock | null>(null)
  const [emplacementChoisi, setEmplacementChoisi] = useState('')
  const [quantiteChoisie, setQuantiteChoisie] = useState('1')
  const [panier, setPanier] = useState<LignePanierSortie[]>([])
  const [panierSelectionneCle, setPanierSelectionneCle] = useState<string | null>(null)
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [notes, setNotes] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [dernierNumero, setDernierNumero] = useState<string | null>(null)

  function chargerDonnees() {
    setChargement(true)
    Promise.all([getEntrepots(), getProduitsAvecStock(), getLocalisationsProduits()])
      .then(([e, p, l]) => {
        const autorises = e.filter((ent) => peutSaisirSortie(profil?.role, ent.id, entrepotsAssignes))
        setEntrepots(autorises)
        setProduits(p)
        setLocalisations(l)
        setEntrepotId((prev) => prev || autorises[0]?.id || '')
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  useEffect(chargerDonnees, [])

  // Reagit au clic sur "Sorties Manuelles" dans le ruban : si un produit etait
  // selectionne dans Produits, le prend en compte ici (meme si l'onglet
  // Sortie etait deja ouvert).
  useEffect(() => {
    if (!demandeSortieManuelle?.produitId || produits.length === 0) return
    const produit = produits.find((p) => p.id === demandeSortieManuelle.produitId)
    if (!produit) return
    setProduitEnPreparation(produit)
    setRecherche('')
    const localisationsProduit = localisations.get(produit.id) ?? []
    const entrepotAvecStock = localisationsProduit[0]?.entrepot_id
    if (entrepotAvecStock) setEntrepotId(entrepotAvecStock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeSortieManuelle])

  const localisationsProduitEnPreparation = produitEnPreparation ? localisations.get(produitEnPreparation.id) ?? [] : []
  const emplacementsDisponibles = localisationsProduitEnPreparation.filter((l) => l.entrepot_id === entrepotId)

  useEffect(() => {
    setEmplacementChoisi(emplacementsDisponibles[0]?.emplacement_id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitEnPreparation, entrepotId])

  const produitsDisponibles = useMemo(() => produits.filter((p) => p.stock_actuel > 0), [produits])

  const produitsFiltres = useMemo(
    () => produitsDisponibles.filter((p) => texteFiltre(p.reference, recherche)),
    [produitsDisponibles, recherche],
  )

  const emplacementChoisiDetail = emplacementsDisponibles.find((l) => l.emplacement_id === emplacementChoisi)

  function onChangerEntrepot(nouvelEntrepotId: string) {
    setEntrepotId(nouvelEntrepotId)
    setPanier([])
    setProduitEnPreparation(null)
  }

  function onAjouterAuPanier() {
    if (!produitEnPreparation || !emplacementChoisi) return
    const quantite = Number(quantiteChoisie)
    if (!quantite || quantite <= 0) {
      setErreur('Saisis une quantité valide.')
      return
    }
    if (emplacementChoisiDetail && quantite > emplacementChoisiDetail.quantite) {
      setErreur('Quantité supérieure au stock disponible à cet emplacement.')
      return
    }
    setErreur(null)
    setPanier((prev) => [
      ...prev,
      {
        cle: Math.random().toString(36).slice(2),
        produitId: produitEnPreparation.id,
        reference: produitEnPreparation.reference,
        designation: produitEnPreparation.designation,
        emplacementId: emplacementChoisi,
        emplacementCode: emplacementChoisiDetail?.emplacement_code ?? '',
        quantite,
      },
    ])
    setProduitEnPreparation(null)
    setRecherche('')
    setQuantiteChoisie('1')
  }

  function onSupprimerDuPanier() {
    if (!panierSelectionneCle) return
    setPanier((prev) => prev.filter((l) => l.cle !== panierSelectionneCle))
    setPanierSelectionneCle(null)
  }

  async function onValider() {
    if (panier.length === 0) {
      setErreur('Ajoute au moins un produit au panier.')
      return
    }
    setErreur(null)
    setEnvoi(true)
    try {
      const numero = await creerSortie(
        entrepotId,
        notes || null,
        panier.map((l) => ({ produitId: l.produitId, emplacementId: l.emplacementId, quantite: l.quantite })),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
      )
      setDernierNumero(numero)
      setPanier([])
      setNotes('')
      setDateMouvement(dateVersInput(new Date()))
      chargerDonnees()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
  }

  return (
    <div className="h-full flex flex-col gap-1.5 p-3 overflow-y-auto">
      <div className="shrink-0 flex items-baseline justify-between gap-3">
        <h1 className="text-base font-bold text-text">Sorties Manuelles</h1>
        <p className="text-[11px] text-text-muted">Le stock est déduit immédiatement à la validation</p>
      </div>

      <div className="shrink-0 bg-card rounded-lg border border-border px-3 py-2 grid grid-cols-[260px_1fr] gap-x-6">
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Référence</span>
            <div className={CLASSE_CHAMP_LECTURE}>{produitEnPreparation?.reference ?? '—'}</div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Désignation</span>
            <div className={CLASSE_CHAMP_LECTURE}>{produitEnPreparation?.designation ?? '—'}</div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Dépôt</span>
            <select value={entrepotId} onChange={(e) => onChangerEntrepot(e.target.value)} className={CLASSE_INPUT}>
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Localisation</span>
            <select
              value={emplacementChoisi}
              onChange={(e) => setEmplacementChoisi(e.target.value)}
              disabled={!produitEnPreparation}
              className={`${CLASSE_INPUT} disabled:bg-muted disabled:text-text-muted`}
            >
              {emplacementsDisponibles.length === 0 && <option value="">—</option>}
              {emplacementsDisponibles.map((l) => (
                <option key={l.emplacement_id} value={l.emplacement_id}>
                  {l.emplacement_code} ({l.quantite} disponible)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Quantité maxi disponible</span>
            <div className={CLASSE_CHAMP_LECTURE}>{emplacementChoisiDetail?.quantite ?? '—'}</div>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={CLASSE_LABEL}>Quantité à sortir</span>
            <input
              type="number"
              min="1"
              max={emplacementChoisiDetail?.quantite ?? undefined}
              value={quantiteChoisie}
              onChange={(e) => setQuantiteChoisie(e.target.value)}
              disabled={!produitEnPreparation}
              className={`${CLASSE_INPUT} disabled:bg-muted disabled:text-text-muted`}
            />
          </label>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-x-6 py-1">
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-0.5">
              <span className={CLASSE_LABEL}>Opérateur</span>
              <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={CLASSE_LABEL}>Bon de sortie</span>
              <div className={CLASSE_CHAMP_LECTURE}>{dernierNumero ?? 'Généré à la validation'}</div>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={CLASSE_LABEL}>Date du mouvement</span>
              <input
                type="date"
                value={dateMouvement}
                onChange={(e) => setDateMouvement(e.target.value)}
                className={CLASSE_INPUT}
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5 min-h-0">
            <span className={CLASSE_LABEL}>Notes / destinataire</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 flex-1 resize-none"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,280px)_1fr] gap-1.5">
        <div className="bg-card rounded-lg border border-border p-2 flex flex-col gap-1.5 min-h-0">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            Rechercher une référence <span className="normal-case text-text-muted">(* = contient)</span>
          </div>
          <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-2">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Référence..."
              className="text-sm outline-none w-full"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                  <th className="font-medium py-0.5">Référence</th>
                  <th className="font-medium py-0.5 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {produitsFiltres.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-text-muted text-center py-6">
                      Aucun produit en stock.
                    </td>
                  </tr>
                )}
                {produitsFiltres.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setProduitEnPreparation(p)}
                    className={`cursor-pointer border-t border-border ${
                      produitEnPreparation?.id === p.id ? 'bg-accent-soft' : 'hover:bg-muted'
                    }`}
                    title={p.designation}
                  >
                    <td className="py-0.5 font-mono text-text">{p.reference}</td>
                    <td className="py-0.5 text-right font-semibold text-text">{p.stock_actuel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 flex flex-col gap-1">
            <button
              type="button"
              onClick={onAjouterAuPanier}
              disabled={!produitEnPreparation || emplacementsDisponibles.length === 0}
              className="text-xs font-semibold bg-card border border-border rounded-md py-1 hover:border-text-muted disabled:opacity-60"
            >
              Ajouter
            </button>
            <button
              type="button"
              onClick={onSupprimerDuPanier}
              disabled={!panierSelectionneCle}
              className="text-xs font-semibold bg-card border border-border rounded-md py-1 hover:border-text-muted disabled:opacity-60"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div className="flex flex-col min-h-0 bg-card rounded-lg border border-border overflow-hidden">
          <div className="shrink-0 text-[11px] font-semibold text-text-muted uppercase tracking-wide px-2 py-1 border-b border-border">
            Panier de sortie ({panier.length})
          </div>
          <div className="overflow-auto flex-1">
            {panier.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">Aucun produit ajouté pour l'instant.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                    <th className="font-medium py-1 px-2">Référence</th>
                    <th className="font-medium py-1 px-2">Désignation</th>
                    <th className="font-medium py-1 px-2">Localisation</th>
                    <th className="font-medium py-1 px-2">Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {panier.map((l) => (
                    <tr
                      key={l.cle}
                      onClick={() => setPanierSelectionneCle(l.cle)}
                      className={`border-t border-border cursor-pointer ${
                        panierSelectionneCle === l.cle ? 'bg-accent-soft' : 'hover:bg-muted'
                      }`}
                    >
                      <td className="py-1 px-2 font-mono text-text-muted">{l.reference}</td>
                      <td className="py-1 px-2 text-text">{l.designation}</td>
                      <td className="py-1 px-2 text-text-muted">{l.emplacementCode}</td>
                      <td className="py-1 px-2 font-semibold text-text">{l.quantite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-3">
        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}
        <button onClick={onValider} disabled={envoi || panier.length === 0} className={CLASSE_BOUTON_PRIMAIRE}>
          {envoi ? 'Validation...' : `Valider la sortie (${panier.length})`}
        </button>
      </div>
    </div>
  )
}
