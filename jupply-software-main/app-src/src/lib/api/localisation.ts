import { supabase } from '../supabase'

function genererReference(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36).toUpperCase()}`
}

export interface AffectationLocalisation {
  produitId: string
  entrepotId: string
  emplacementId: string
  quantite: number
}

export async function affecterLocalisation(donnees: AffectationLocalisation): Promise<void> {
  const { error } = await supabase.rpc('affecter_localisation', {
    p_produit_id: donnees.produitId,
    p_entrepot_id: donnees.entrepotId,
    p_emplacement_id: donnees.emplacementId,
    p_quantite: donnees.quantite,
    p_reference: genererReference('AFF'),
  })
  if (error) throw error
}

export interface DeplacementStock {
  produitId: string
  entrepotId: string
  emplacementSourceId: string
  emplacementDestinationId: string
  quantite: number
}

export async function deplacerStock(donnees: DeplacementStock): Promise<void> {
  const { error } = await supabase.rpc('deplacer_stock', {
    p_produit_id: donnees.produitId,
    p_entrepot_id: donnees.entrepotId,
    p_emplacement_source_id: donnees.emplacementSourceId,
    p_emplacement_destination_id: donnees.emplacementDestinationId,
    p_quantite: donnees.quantite,
    p_reference: genererReference('DEP'),
  })
  if (error) throw error
}
