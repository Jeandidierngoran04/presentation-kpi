import { supabase } from '../supabase'
import type { SortieAReintegrer } from '../../types/stock'

export interface FiltreDatesSorties {
  dateDebut?: string | null
  dateFin?: string | null
}

/** Lignes de sortie confirmées, encore (partiellement) réintégrables, pour un entrepôt donné. */
export async function getSortiesAReintegrer(
  entrepotId: string,
  filtre: FiltreDatesSorties = {},
): Promise<SortieAReintegrer[]> {
  let requete = supabase
    .from('v_sorties_a_reintegrer')
    .select('*')
    .eq('entrepot_id', entrepotId)
    .order('sortie_le', { ascending: false })
  if (filtre.dateDebut) requete = requete.gte('sortie_le', filtre.dateDebut)
  if (filtre.dateFin) requete = requete.lte('sortie_le', filtre.dateFin)
  const { data, error } = await requete
  if (error) throw error
  return data as SortieAReintegrer[]
}

export interface LigneReintegration {
  bonSortieLigneId: string
  emplacementId: string
  quantite: number
  notes?: string | null
}

export async function creerReintegration(
  entrepotId: string,
  notes: string | null,
  lignes: LigneReintegration[],
  dateMouvement?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('creer_reintegration', {
    p_entrepot_id: entrepotId,
    p_notes: notes,
    p_lignes: lignes.map((l) => ({
      bon_sortie_ligne_id: l.bonSortieLigneId,
      emplacement_id: l.emplacementId,
      quantite: l.quantite,
      notes: l.notes ?? null,
    })),
    p_date_mouvement: dateMouvement ?? null,
  })
  if (error) throw error
  return data as string
}
