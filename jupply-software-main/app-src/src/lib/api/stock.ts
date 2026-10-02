import { supabase } from '../supabase'
import type {
  ProduitAvecStock,
  MouvementAffiche,
  StockParCategorie,
  StockParEntrepot,
  TopProduitMouvemente,
} from '../../types/stock'

export async function getProduitsAvecStock(): Promise<ProduitAvecStock[]> {
  const { data, error } = await supabase.from('v_produits_stock').select('*').order('designation')
  if (error) throw error
  return data as ProduitAvecStock[]
}

/** Stock d'alerte d'un produit : seuil de réapprovisionnement, à défaut stock minimum (même règle que `v_produits_stock`). */
export function stockAlerte(produit: Pick<ProduitAvecStock, 'seuil_reappro' | 'stock_min'>): number {
  return produit.seuil_reappro ?? produit.stock_min
}

export async function getMouvementsRecents(limite = 10): Promise<MouvementAffiche[]> {
  const { data, error } = await supabase
    .from('v_mouvements_recents')
    .select('*')
    .order('cree_le', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data as MouvementAffiche[]
}

export async function getStockParEntrepot(): Promise<StockParEntrepot[]> {
  const { data, error } = await supabase.from('v_stock_par_entrepot').select('*').order('entrepot_nom')
  if (error) throw error
  return data as StockParEntrepot[]
}

export function calculerStockParCategorie(produits: ProduitAvecStock[]): StockParCategorie[] {
  const groupes = new Map<string, StockParCategorie>()
  for (const produit of produits) {
    const cle = produit.categorie_id ?? 'sans-categorie'
    const nom = produit.categorie_nom ?? 'Sans categorie'
    const existant = groupes.get(cle)
    if (existant) {
      existant.quantite_totale += produit.stock_actuel
    } else {
      groupes.set(cle, {
        categorie_id: produit.categorie_id,
        categorie_nom: nom,
        quantite_totale: produit.stock_actuel,
      })
    }
  }
  return Array.from(groupes.values()).sort((a, b) => b.quantite_totale - a.quantite_totale)
}

export type PeriodeFiltre = 'jour' | 'semaine' | 'mois' | 'annee'

function dateDebutPeriode(periode: PeriodeFiltre): Date {
  const maintenant = new Date()
  const debut = new Date(maintenant)
  switch (periode) {
    case 'jour':
      debut.setHours(0, 0, 0, 0)
      break
    case 'semaine':
      debut.setDate(maintenant.getDate() - 7)
      break
    case 'mois':
      debut.setMonth(maintenant.getMonth() - 1)
      break
    case 'annee':
      debut.setFullYear(maintenant.getFullYear() - 1)
      break
  }
  return debut
}

export async function getTopProduitsMouvementes(
  periode: PeriodeFiltre,
  limite = 5,
): Promise<TopProduitMouvemente[]> {
  const depuis = dateDebutPeriode(periode)
  const { data, error } = await supabase
    .from('v_mouvements_recents')
    .select('produit_id, produit_designation, type, quantite')
    .gte('cree_le', depuis.toISOString())
  if (error) throw error

  const groupes = new Map<string, TopProduitMouvemente>()
  for (const mvt of data ?? []) {
    const existant = groupes.get(mvt.produit_id) ?? {
      produit_id: mvt.produit_id,
      produit_designation: mvt.produit_designation,
      quantite_entree: 0,
      quantite_sortie: 0,
      nb_mouvements: 0,
    }
    if (mvt.type === 'entree') existant.quantite_entree += mvt.quantite
    else if (mvt.type === 'sortie') existant.quantite_sortie += mvt.quantite
    existant.nb_mouvements += 1
    groupes.set(mvt.produit_id, existant)
  }
  return Array.from(groupes.values())
    .sort((a, b) => b.nb_mouvements - a.nb_mouvements)
    .slice(0, limite)
}

export interface KpisStock {
  totalProduits: number
  stockTotal: number
  stockFaible: number
  enRupture: number
  entreesAujourdhui: number
  sortiesAujourdhui: number
}

export async function getMouvementsAujourdhui(): Promise<{ type: string; quantite: number }[]> {
  const debut = dateDebutPeriode('jour')
  const { data, error } = await supabase
    .from('mouvements_stock')
    .select('type, quantite')
    .gte('cree_le', debut.toISOString())
  if (error) throw error
  return data ?? []
}

export function calculerKpis(
  produits: ProduitAvecStock[],
  mouvementsAujourdhui: { type: string; quantite: number }[],
): KpisStock {
  return {
    totalProduits: produits.length,
    stockTotal: produits.reduce((total, p) => total + p.stock_actuel, 0),
    stockFaible: produits.filter((p) => p.statut === 'faible').length,
    enRupture: produits.filter((p) => p.statut === 'rupture').length,
    entreesAujourdhui: mouvementsAujourdhui
      .filter((m) => m.type === 'entree')
      .reduce((total, m) => total + m.quantite, 0),
    sortiesAujourdhui: mouvementsAujourdhui
      .filter((m) => m.type === 'sortie')
      .reduce((total, m) => total + m.quantite, 0),
  }
}
