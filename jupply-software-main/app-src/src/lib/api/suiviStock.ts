import { supabase } from '../supabase'
import type { StatutStock, TypeMouvement } from '../../types/stock'

/** Un changement de statut d'un produit (journal alimenté par la base). */
export interface ChangementStatut {
  id: string
  produit_id: string
  ancien_statut: StatutStock | null
  nouveau_statut: StatutStock
  stock: number
  seuil_alerte: number | null
  date_changement: string
  reference: string | null
  /** 'mouvement' (automatique), 'seuils' (seuils modifiés), 'reprise' (reconstitué à l'installation). */
  origine: 'mouvement' | 'seuils' | 'reprise'
  utilisateur_nom: string | null
  type_mouvement: TypeMouvement | null
  motif_mouvement: string | null
}

/** Une ligne de la fiche de stock : un mouvement et le stock disponible après lui. */
export interface LigneJournal {
  id: string
  produit_id: string
  entrepot_id: string
  entrepot_nom: string
  type: TypeMouvement
  quantite: number
  reference: string
  motif: string | null
  lot: string | null
  numero_serie: string | null
  prix_unitaire: number | null
  cree_le: string
  utilisateur_nom: string | null
  emplacement_code: string | null
  emplacement_origine_code: string | null
  /** Effet sur le stock disponible (hors quarantaine) : positif = entrée, négatif = sortie. */
  delta: number
  entree: number
  sortie: number
  /** Stock disponible du produit (tous dépôts) après ce mouvement. */
  stock_apres: number
  /** Stock disponible du produit dans ce dépôt après ce mouvement. */
  stock_apres_depot: number
}

const LIMITE_JOURNAL = 5000

/** Changements de statut d'un produit, du plus récent au plus ancien. */
export async function getChangementsStatut(produitId: string, limite = 50): Promise<ChangementStatut[]> {
  const { data, error } = await supabase
    .from('v_historique_statuts_stock')
    .select('*')
    .eq('produit_id', produitId)
    .order('date_changement', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as ChangementStatut[]
}

/** Dernier passage en alerte et en rupture de chaque produit demandé (écran Alertes stock). */
export interface PassagesAlerte {
  alerte: string | null
  rupture: string | null
}

export async function getDerniersPassagesAlerte(produitIds: string[]): Promise<Map<string, PassagesAlerte>> {
  const resultat = new Map<string, PassagesAlerte>()
  if (produitIds.length === 0) return resultat
  const { data, error } = await supabase
    .from('v_historique_statuts_stock')
    .select('produit_id, nouveau_statut, date_changement')
    .in('produit_id', produitIds)
    .in('nouveau_statut', ['faible', 'rupture'])
    .order('date_changement', { ascending: false })
  if (error) throw error
  // Du plus récent au plus ancien : la première date rencontrée est la dernière.
  for (const c of data ?? []) {
    const p = resultat.get(c.produit_id as string) ?? { alerte: null, rupture: null }
    if (c.nouveau_statut === 'faible') p.alerte ??= c.date_changement as string
    else p.rupture ??= c.date_changement as string
    resultat.set(c.produit_id as string, p)
  }
  return resultat
}

/** Tous les mouvements d'un produit, du plus ancien au plus récent, avec le stock après chacun. */
export async function getJournalStock(produitId: string): Promise<LigneJournal[]> {
  const { data, error } = await supabase
    .from('v_journal_stock')
    .select('*')
    .eq('produit_id', produitId)
    .order('cree_le', { ascending: true })
    .order('id', { ascending: true })
    .limit(LIMITE_JOURNAL)
  if (error) throw error
  return (data ?? []).map((l) => ({ ...l, prix_unitaire: l.prix_unitaire == null ? null : Number(l.prix_unitaire) })) as LigneJournal[]
}
