import { supabase } from '../supabase'

export interface LigneSortie {
  produitId: string
  emplacementId: string
  quantite: number
}

export async function creerSortie(
  entrepotId: string,
  motif: string | null,
  lignes: LigneSortie[],
  dateMouvement?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('creer_sortie', {
    p_entrepot_id: entrepotId,
    p_motif: motif,
    p_lignes: lignes.map((l) => ({
      produit_id: l.produitId,
      emplacement_id: l.emplacementId,
      quantite: l.quantite,
    })),
    p_date_mouvement: dateMouvement ?? null,
  })
  if (error) throw error
  return data as string
}
