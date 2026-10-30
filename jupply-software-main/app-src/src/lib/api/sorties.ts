import { supabase } from '../supabase'

export interface LigneSortie {
  produitId: string
  emplacementId: string
  quantite: number
  /** Lot précis à sortir ; absent, la base applique l'ordre FEFO / FIFO. */
  stockLotId?: string | null
}

export interface BonSortieCree {
  id: string
  numero: string
}

export async function creerSortie(
  /** Dépôt principal ; null = celui de la première ligne (sortie sur plusieurs dépôts). */
  entrepotId: string | null,
  motif: string | null,
  lignes: LigneSortie[],
  dateMouvement?: string | null,
  recuPar?: string | null,
): Promise<BonSortieCree> {
  const { data, error } = await supabase.rpc('creer_sortie', {
    p_entrepot_id: entrepotId,
    p_motif: motif,
    p_lignes: lignes.map((l) => ({
      produit_id: l.produitId,
      emplacement_id: l.emplacementId,
      quantite: l.quantite,
      stock_lot_id: l.stockLotId ?? null,
    })),
    p_date_mouvement: dateMouvement ?? null,
    p_recu_par: recuPar ?? null,
  })
  if (error) throw error
  const id = data as string

  // La fonction renvoie l'identifiant du bon : on relit son numéro (BS-...)
  // pour l'afficher. Un échec de cette lecture ne remet pas la sortie en cause.
  const { data: bon } = await supabase.from('bons_sortie').select('numero').eq('id', id).single()
  return { id, numero: (bon?.numero as string | undefined) ?? id }
}
