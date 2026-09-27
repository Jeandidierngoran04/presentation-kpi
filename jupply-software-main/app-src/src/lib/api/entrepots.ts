import { supabase } from '../supabase'
import type { Entrepot, Emplacement } from '../../types/stock'

export interface EntrepotAvecStats extends Entrepot {
  nb_emplacements: number
  quantite_totale: number
}

export async function getEntrepots(): Promise<EntrepotAvecStats[]> {
  const { data: entrepots, error } = await supabase.from('entrepots').select('*').order('nom')
  if (error) throw error

  const { data: emplacements, error: erreurEmplacements } = await supabase.from('emplacements').select('entrepot_id')
  if (erreurEmplacements) throw erreurEmplacements

  const { data: stockParEntrepot, error: erreurStock } = await supabase
    .from('v_stock_par_entrepot')
    .select('entrepot_id, quantite_totale')
  if (erreurStock) throw erreurStock

  const nbEmplacements = new Map<string, number>()
  for (const e of emplacements ?? []) {
    nbEmplacements.set(e.entrepot_id, (nbEmplacements.get(e.entrepot_id) ?? 0) + 1)
  }
  const quantites = new Map<string, number>()
  for (const s of stockParEntrepot ?? []) {
    quantites.set(s.entrepot_id, s.quantite_totale)
  }

  return (entrepots as Entrepot[]).map((e) => ({
    ...e,
    nb_emplacements: nbEmplacements.get(e.id) ?? 0,
    quantite_totale: quantites.get(e.id) ?? 0,
  }))
}

export async function getEmplacements(entrepotId: string): Promise<Emplacement[]> {
  const { data, error } = await supabase
    .from('emplacements')
    .select('*')
    .eq('entrepot_id', entrepotId)
    .order('est_quarantaine', { ascending: false })
    .order('code')
  if (error) throw error
  return data as Emplacement[]
}

export interface NouvelEntrepot {
  entrepriseId: string
  nom: string
  adresse?: string | null
}

export async function creerEntrepot(entrepot: NouvelEntrepot): Promise<Entrepot> {
  const { data, error } = await supabase
    .from('entrepots')
    .insert({ entreprise_id: entrepot.entrepriseId, nom: entrepot.nom, adresse: entrepot.adresse ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Entrepot
}

export interface NouvelEmplacement {
  entrepotId: string
  zone?: string | null
  rayon?: string | null
  etagere?: string | null
  code: string
}

export async function creerEmplacement(emplacement: NouvelEmplacement): Promise<Emplacement> {
  const { data, error } = await supabase
    .from('emplacements')
    .insert({
      entrepot_id: emplacement.entrepotId,
      zone: emplacement.zone ?? null,
      rayon: emplacement.rayon ?? null,
      etagere: emplacement.etagere ?? null,
      code: emplacement.code,
    })
    .select()
    .single()
  if (error) throw error
  return data as Emplacement
}
