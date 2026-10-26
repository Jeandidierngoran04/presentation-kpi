import { supabase } from '../supabase'
import type { Reception, ReceptionLigne } from '../../types/stock'

export interface ReceptionAffichee extends Reception {
  entrepot_nom: string
  fournisseur_nom: string | null
  /** Opérateur qui a enregistré la réception dans le système. */
  cree_par_nom: string
  /** Opérateur qui a validé la réception (null tant qu'elle n'est pas validée). */
  valide_par_nom: string | null
}

interface LigneReceptionBrute {
  entrepots: { nom: string } | null
  fournisseurs: { nom: string } | null
  [cle: string]: unknown
}

export async function getReceptions(): Promise<ReceptionAffichee[]> {
  // receptions a deux liens vers profiles (cree_par, valide_par) : les noms
  // sont résolus à part plutôt que par jointure imbriquée ambiguë.
  const [{ data, error }, { data: profils, error: erreurProfils }] = await Promise.all([
    supabase.from('receptions').select('*, entrepots(nom), fournisseurs(nom)').order('cree_le', { ascending: false }),
    supabase.from('profiles').select('id, nom_complet'),
  ])
  if (error) throw error
  if (erreurProfils) throw erreurProfils
  const nomParProfil = new Map((profils ?? []).map((p) => [p.id as string, p.nom_complet as string]))
  return ((data ?? []) as unknown as LigneReceptionBrute[]).map((r) => {
    const reception = r as unknown as Reception
    return {
      ...reception,
      entrepot_nom: r.entrepots?.nom ?? '',
      fournisseur_nom: r.fournisseurs?.nom ?? null,
      cree_par_nom: nomParProfil.get(reception.cree_par) ?? '—',
      valide_par_nom: reception.valide_par ? (nomParProfil.get(reception.valide_par) ?? '—') : null,
    }
  })
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
  /** Quantité déclarée non conforme : part en quarantaine avec un dossier NC à la validation. */
  quantiteNonConforme: number
  motifNonConformite: string | null
  constatNonConformite: string | null
}

export interface NouvelleReception {
  entrepotId: string
  fournisseurId: string | null
  numeroPo: string | null
  notes: string | null
  /** Date du mouvement (ISO), par défaut maintenant. */
  dateMouvement: string | null
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
      quantite_non_conforme: l.quantiteNonConforme,
      motif_non_conformite: l.motifNonConformite,
      constat_non_conformite: l.constatNonConformite,
    })),
    p_notes: donnees.notes,
    p_date_mouvement: donnees.dateMouvement,
  })
  if (error) throw error
  return data as string
}

export async function validerReception(receptionId: string): Promise<void> {
  const { error } = await supabase.rpc('valider_reception', { p_reception_id: receptionId })
  if (error) throw error
}
