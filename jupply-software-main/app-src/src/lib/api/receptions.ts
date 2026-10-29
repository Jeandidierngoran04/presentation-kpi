import { supabase } from '../supabase'
import type { Reception, ReceptionLigne, StatutReception } from '../../types/stock'
import type { TonBadge } from '../../components/ui/Badge'

// Vert = terminé, bleu = en cours, gris = en attente ou arrêté, rouge = problème.
export const STATUTS_RECEPTION: Record<StatutReception, { label: string; ton: TonBadge }> = {
  en_attente: { label: 'En attente', ton: 'neutre' },
  validee: { label: 'Validée', ton: 'succes' },
  partielle: { label: 'Partielle', ton: 'info' },
  anomalie: { label: 'Anomalie', ton: 'danger' },
  annulee: { label: 'Annulée', ton: 'neutre' },
}

export interface ReceptionAffichee extends Reception {
  entrepot_nom: string
  /** Tous les dépôts concernés par les lignes (une entrée peut en couvrir plusieurs). */
  depots_noms: string[]
  fournisseur_nom: string | null
  /** Opérateur qui a enregistré la réception dans le système. */
  cree_par_nom: string
  /** Opérateur qui a validé la réception (null tant qu'elle n'est pas validée). */
  valide_par_nom: string | null
  /** Opérateur qui a annulé l'entrée (null sinon). */
  annulee_par_nom: string | null
}

interface LigneReceptionBrute {
  entrepots: { nom: string } | null
  fournisseurs: { nom: string } | null
  [cle: string]: unknown
}

export async function getReceptions(): Promise<ReceptionAffichee[]> {
  // receptions a deux liens vers profiles (cree_par, valide_par) : les noms
  // sont résolus à part plutôt que par jointure imbriquée ambiguë.
  const [{ data, error }, { data: profils, error: erreurProfils }, { data: lignesDepots, error: erreurLignes }] = await Promise.all([
    supabase.from('receptions').select('*, entrepots(nom), fournisseurs(nom)').order('cree_le', { ascending: false }),
    supabase.from('profiles').select('id, nom_complet'),
    // Dépôt de chaque ligne = dépôt de sa localisation.
    supabase.from('receptions_lignes').select('reception_id, emplacements(entrepots(nom))'),
  ])
  if (error) throw error
  if (erreurProfils) throw erreurProfils
  if (erreurLignes) throw erreurLignes
  const nomParProfil = new Map((profils ?? []).map((p) => [p.id as string, p.nom_complet as string]))
  const depotsParReception = new Map<string, Set<string>>()
  for (const l of (lignesDepots ?? []) as unknown as { reception_id: string; emplacements: { entrepots: { nom: string } | null } | null }[]) {
    const nom = l.emplacements?.entrepots?.nom
    if (!nom) continue
    const noms = depotsParReception.get(l.reception_id) ?? new Set<string>()
    noms.add(nom)
    depotsParReception.set(l.reception_id, noms)
  }
  return ((data ?? []) as unknown as LigneReceptionBrute[]).map((r) => {
    const reception = r as unknown as Reception
    return {
      ...reception,
      entrepot_nom: r.entrepots?.nom ?? '',
      depots_noms: [...(depotsParReception.get(reception.id) ?? [r.entrepots?.nom ?? ''])].sort((a, b) => a.localeCompare(b)),
      fournisseur_nom: r.fournisseurs?.nom ?? null,
      cree_par_nom: nomParProfil.get(reception.cree_par) ?? '—',
      valide_par_nom: reception.valide_par ? (nomParProfil.get(reception.valide_par) ?? '—') : null,
      annulee_par_nom: reception.annulee_par ? (nomParProfil.get(reception.annulee_par) ?? '—') : null,
    }
  })
}

/** Ligne d'entrée avec sa localisation et son dépôt, pour le détail. */
export interface ReceptionLigneAffichee extends ReceptionLigne {
  emplacement_code: string | null
  entrepot_nom: string | null
}

export async function getLignesReception(receptionId: string): Promise<ReceptionLigneAffichee[]> {
  const { data, error } = await supabase
    .from('receptions_lignes')
    .select('*, emplacements(code, entrepots(nom))')
    .eq('reception_id', receptionId)
    .order('cree_le')
  if (error) throw error
  return ((data ?? []) as unknown as (ReceptionLigne & { emplacements: { code: string; entrepots: { nom: string } | null } | null })[]).map(
    ({ emplacements, ...l }) => ({ ...l, emplacement_code: emplacements?.code ?? null, entrepot_nom: emplacements?.entrepots?.nom ?? null }),
  )
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
  /** Dépôt principal (celui de la première ligne) ; chaque ligne va dans le dépôt de sa localisation. */
  entrepotId: string
  fournisseurId: string | null
  numeroPo: string | null
  notes: string | null
  /** Date du mouvement (ISO), par défaut maintenant. */
  dateMouvement: string | null
  lignes: NouvelleLigneReception[]
}

function ligneVersJson(l: NouvelleLigneReception) {
  return {
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
  }
}

export async function creerReception(donnees: NouvelleReception): Promise<string> {
  const { data, error } = await supabase.rpc('creer_reception', {
    p_entrepot_id: donnees.entrepotId,
    p_fournisseur_id: donnees.fournisseurId,
    p_numero_po: donnees.numeroPo,
    p_lignes: donnees.lignes.map(ligneVersJson),
    p_notes: donnees.notes,
    p_date_mouvement: donnees.dateMouvement,
  })
  if (error) throw error
  return data as string
}

/** Une entrée, avec ses noms (fournisseur, auteurs). */
export async function getReception(receptionId: string): Promise<ReceptionAffichee | null> {
  return (await getReceptions()).find((r) => r.id === receptionId) ?? null
}

/** Annule une entrée en attente (aucun effet sur le stock). Motif obligatoire. */
export async function annulerReception(receptionId: string, motif: string): Promise<void> {
  const { error } = await supabase.rpc('annuler_reception', { p_reception_id: receptionId, p_motif: motif })
  if (error) throw error
}

/** Remplace le contenu d'une entrée en attente (le numéro est conservé). */
export async function modifierReception(receptionId: string, donnees: Omit<NouvelleReception, 'entrepotId' | 'numeroPo'>): Promise<void> {
  const { error } = await supabase.rpc('modifier_reception', {
    p_reception_id: receptionId,
    p_fournisseur_id: donnees.fournisseurId,
    p_lignes: donnees.lignes.map(ligneVersJson),
    p_notes: donnees.notes,
    p_date_mouvement: donnees.dateMouvement,
  })
  if (error) throw error
}

export async function validerReception(receptionId: string): Promise<void> {
  const { error } = await supabase.rpc('valider_reception', { p_reception_id: receptionId })
  if (error) throw error
}
