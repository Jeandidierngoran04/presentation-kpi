import { supabase } from '../supabase'

/** Document listé dans l'Historique (bon de sortie, réception, transfert...). */
export interface DocumentHistorique {
  id: string
  cree_le: string
  [colonne: string]: unknown
}

export interface FiltreHistorique {
  /** Bornes de dates au format YYYY-MM-DD (incluses). */
  du: string | null
  au: string | null
  /** Recherche sur la colonne numéro ; quand elle est renseignée, les dates sont ignorées. */
  colonneNumero?: string
  numero?: string
}

const LIMITE = 2000

/** Lit une vue v_historique_* filtrée par dates ou par numéro, du plus récent au plus ancien. */
export async function getDocumentsHistorique<T extends DocumentHistorique>(
  vue: string,
  filtre: FiltreHistorique,
): Promise<T[]> {
  let requete = supabase.from(vue).select('*').order('cree_le', { ascending: false }).limit(LIMITE)
  const numero = filtre.numero?.trim()
  if (numero && filtre.colonneNumero) {
    requete = requete.ilike(filtre.colonneNumero, `%${numero}%`)
  } else {
    if (filtre.du) requete = requete.gte('cree_le', new Date(`${filtre.du}T00:00:00`).toISOString())
    if (filtre.au) requete = requete.lte('cree_le', new Date(`${filtre.au}T23:59:59.999`).toISOString())
  }
  const { data, error } = await requete
  if (error) throw error
  return (data ?? []) as T[]
}

/** Lignes d'un document (vue v_historique_*_lignes). */
export async function getLignesDocument<L>(vueLignes: string, colonneLien: string, documentId: string): Promise<L[]> {
  const { data, error } = await supabase.from(vueLignes).select('*').eq(colonneLien, documentId)
  if (error) throw error
  return (data ?? []) as L[]
}

let nomEntrepriseEnCache: string | null = null

/** Nom de l'entreprise de l'utilisateur, imprimé en tête des documents. */
export async function getNomEntreprise(): Promise<string> {
  if (nomEntrepriseEnCache) return nomEntrepriseEnCache
  const { data } = await supabase.from('entreprises').select('nom').limit(1).maybeSingle()
  nomEntrepriseEnCache = (data?.nom as string | undefined) ?? ''
  return nomEntrepriseEnCache
}

// --- Bons de sortie ---------------------------------------------------------

export interface BonSortieHistorique extends DocumentHistorique {
  numero: string
  entrepot_nom: string
  statut: string
  motif: string | null
  recu_par: string | null
  emis_par_nom: string | null
  nb_lignes: number
  quantite_totale: number
  quantite_reintegree: number
}

export interface LigneBonSortie {
  id: string
  produit_reference: string
  produit_designation: string
  unite_mesure: string
  emplacement_code: string | null
  lot: string | null
  numero_serie: string | null
  date_expiration: string | null
  quantite: number
  quantite_reintegree: number
}

export async function getBonSortie(id: string): Promise<BonSortieHistorique | null> {
  const { data, error } = await supabase.from('v_historique_sorties').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as BonSortieHistorique | null
}

export function getLignesBonSortie(id: string): Promise<LigneBonSortie[]> {
  return getLignesDocument<LigneBonSortie>('v_historique_sorties_lignes', 'bon_sortie_id', id)
}
