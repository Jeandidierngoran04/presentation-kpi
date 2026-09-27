import { supabase } from '../supabase'
import type { TransfertAffiche, TransfertLigneAffichee } from '../../types/stock'

export async function getTransferts(): Promise<TransfertAffiche[]> {
  const { data, error } = await supabase.from('v_transferts').select('*').order('cree_le', { ascending: false })
  if (error) throw error
  return data as TransfertAffiche[]
}

export async function getLignesTransfert(transfertId: string): Promise<TransfertLigneAffichee[]> {
  const { data, error } = await supabase
    .from('v_transferts_lignes')
    .select('*')
    .eq('transfert_id', transfertId)
  if (error) throw error
  return data as TransfertLigneAffichee[]
}

export interface LigneDemandeTransfert {
  produitId: string
  quantite: number
}

export async function demanderTransfert(
  entrepotSourceId: string,
  entrepotDestinationId: string,
  lignes: LigneDemandeTransfert[],
): Promise<string> {
  const { data, error } = await supabase.rpc('demander_transfert', {
    p_entrepot_source_id: entrepotSourceId,
    p_entrepot_destination_id: entrepotDestinationId,
    p_lignes: lignes.map((l) => ({ produit_id: l.produitId, quantite: l.quantite })),
  })
  if (error) throw error
  return data as string
}

export async function validerTransfert(transfertId: string): Promise<void> {
  const { error } = await supabase.rpc('valider_transfert', { p_transfert_id: transfertId })
  if (error) throw error
}

export interface LigneExpedition {
  transfertLigneId: string
  emplacementSourceId: string
}

export async function expedierTransfert(
  transfertId: string,
  lignes: LigneExpedition[],
  dateMouvement?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('expedier_transfert', {
    p_transfert_id: transfertId,
    p_lignes: lignes.map((l) => ({
      transfert_ligne_id: l.transfertLigneId,
      emplacement_source_id: l.emplacementSourceId,
    })),
    p_date_mouvement: dateMouvement ?? null,
  })
  if (error) throw error
}

export interface LigneReception {
  transfertLigneId: string
  emplacementDestinationId: string
  quantiteRecue: number
}

export async function receptionnerTransfert(
  transfertId: string,
  lignes: LigneReception[],
  dateMouvement?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('receptionner_transfert', {
    p_transfert_id: transfertId,
    p_lignes: lignes.map((l) => ({
      transfert_ligne_id: l.transfertLigneId,
      emplacement_destination_id: l.emplacementDestinationId,
      quantite_recue: l.quantiteRecue,
    })),
    p_date_mouvement: dateMouvement ?? null,
  })
  if (error) throw error
}
