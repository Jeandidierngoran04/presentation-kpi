import { supabase } from '../supabase'
import type { LocalisationProduit, StockLot } from '../../types/stock'

interface LigneStockLot {
  id: string
  produit_id: string
  entrepot_id: string
  emplacement_id: string
  lot: string | null
  numero_serie: string | null
  date_expiration: string | null
  date_entree: string
  quantite: number
  emplacements: { code: string; est_quarantaine: boolean } | null
}

/**
 * Ordre de sortie : premier périmé, premier sorti (FEFO), les lots sans date
 * d'expiration ensuite, puis premier entré, premier sorti (FIFO).
 * Même règle que `synchroniser_lots` côté base.
 */
export function comparerOrdreSortie(a: StockLot, b: StockLot): number {
  if (a.date_expiration !== b.date_expiration) {
    if (!a.date_expiration) return 1
    if (!b.date_expiration) return -1
    return a.date_expiration < b.date_expiration ? -1 : 1
  }
  return (a.date_entree ?? '').localeCompare(b.date_entree ?? '')
}

/**
 * Lots en stock (hors Quarantaine), groupés par produit et triés dans l'ordre
 * de sortie. Renvoie null si la base n'a pas encore le suivi par lot
 * (migration non exécutée) : l'appelant se replie sur le stock par emplacement.
 * Avec produitId, ne lit que les lots de ce produit.
 */
export async function getStockLots(produitId?: string): Promise<Map<string, StockLot[]> | null> {
  let requete = supabase
    .from('stock_lots')
    .select(
      'id, produit_id, entrepot_id, emplacement_id, lot, numero_serie, date_expiration, date_entree, quantite, emplacements(code, est_quarantaine)',
    )
    .gt('quantite', 0)
  // Un seul produit (fenêtre Info) ou tous.
  if (produitId) requete = requete.eq('produit_id', produitId)
  const { data, error } = await requete
  if (error) return null

  const parProduit = new Map<string, StockLot[]>()
  for (const ligne of (data ?? []) as unknown as LigneStockLot[]) {
    if (ligne.emplacements?.est_quarantaine) continue
    const liste = parProduit.get(ligne.produit_id) ?? []
    liste.push({
      id: ligne.id,
      produit_id: ligne.produit_id,
      entrepot_id: ligne.entrepot_id,
      emplacement_id: ligne.emplacement_id,
      emplacement_code: ligne.emplacements?.code ?? '',
      lot: ligne.lot,
      numero_serie: ligne.numero_serie,
      date_expiration: ligne.date_expiration,
      date_entree: ligne.date_entree,
      quantite: ligne.quantite,
    })
    parProduit.set(ligne.produit_id, liste)
  }
  for (const liste of parProduit.values()) liste.sort(comparerOrdreSortie)
  return parProduit
}

/** Repli sans suivi par lot : une ligne "sans lot" par emplacement. */
export function lotsDepuisLocalisations(localisations: Map<string, LocalisationProduit[]>): Map<string, StockLot[]> {
  const parProduit = new Map<string, StockLot[]>()
  for (const [produitId, lignes] of localisations) {
    parProduit.set(
      produitId,
      lignes.map((l) => ({
        id: null,
        produit_id: l.produit_id,
        entrepot_id: l.entrepot_id,
        emplacement_id: l.emplacement_id,
        emplacement_code: l.emplacement_code,
        lot: null,
        numero_serie: null,
        date_expiration: null,
        date_entree: null,
        quantite: l.quantite,
      })),
    )
  }
  return parProduit
}
