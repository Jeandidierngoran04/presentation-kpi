import { supabase } from '../supabase'
import type { Reception, ReceptionLigne } from '../../types/stock'

export interface ReceptionAffichee extends Reception {
  entrepot_nom: string
  fournisseur_nom: string | null
}

interface LigneReceptionBrute {
  entrepots: { nom: string } | null
  fournisseurs: { nom: string } | null
  [cle: string]: unknown
}

export async function getReceptions(): Promise<ReceptionAffichee[]> {
  const { data, error } = await supabase
    .from('receptions')
    .select('*, entrepots(nom), fournisseurs(nom)')
    .order('cree_le', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as LigneReceptionBrute[]).map((r) => ({
    ...(r as unknown as Reception),
    entrepot_nom: r.entrepots?.nom ?? '',
    fournisseur_nom: r.fournisseurs?.nom ?? null,
  }))
}

export async function getLignesReception(receptionId: string): Promise<ReceptionLigne[]> {
  const { data, error } = await supabase
    .from('receptions_lignes')
    .select('*')
    .eq('reception_id', receptionId)
    .order('cree_le')
  if (error) throw error
  return data as ReceptionLigne[]
}

export interface NouvelleLigneReception {
  produitId: string
  emplacementId: string
  quantiteAttendue: number
  quantiteRecue: number
  lot?: string | null
  numeroSerie?: string | null
  dateExpiration?: string | null
  prixUnitaire: number
  anomalie: boolean
}

export interface NouvelleReception {
  entrepotId: string
  fournisseurId: string | null
  numeroPo: string | null
  lignes: NouvelleLigneReception[]
}

export async function creerReception(donnees: NouvelleReception): Promise<string> {
  const { data, error } = await supabase.rpc('creer_reception', {
    p_entrepot_id: donnees.entrepotId,
    p_fournisseur_id: donnees.fournisseurId,
    p_numero_po: donnees.numeroPo,
    p_lignes: donnees.lignes.map((l) => ({
      produit_id: l.produitId,
      emplacement_id: l.emplacementId,
      quantite_attendue: l.quantiteAttendue,
      quantite_recue: l.quantiteRecue,
      lot: l.lot ?? null,
      numero_serie: l.numeroSerie ?? null,
      date_expiration: l.dateExpiration ?? null,
      prix_unitaire: l.prixUnitaire,
      anomalie: l.anomalie,
    })),
  })
  if (error) throw error
  return data as string
}

export async function validerReception(receptionId: string): Promise<void> {
  const { error } = await supabase.rpc('valider_reception', { p_reception_id: receptionId })
  if (error) throw error
}
