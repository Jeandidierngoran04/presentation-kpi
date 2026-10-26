import { supabase } from '../supabase'

export type MotifNonConformite =
  | 'endommage'
  | 'avarie_transport'
  | 'non_conforme_commande'
  | 'surplus'
  | 'perime'
  | 'documents_manquants'
  | 'defaut_qualite'
  | 'autre'

export const MOTIFS_NC: { valeur: MotifNonConformite; label: string }[] = [
  { valeur: 'endommage', label: 'Endommagé / casse' },
  { valeur: 'avarie_transport', label: 'Avarie de transport' },
  { valeur: 'non_conforme_commande', label: 'Non conforme à la commande' },
  { valeur: 'surplus', label: 'Surplus de livraison' },
  { valeur: 'perime', label: 'Périmé / date trop courte' },
  { valeur: 'documents_manquants', label: 'Documents manquants' },
  { valeur: 'defaut_qualite', label: 'Défaut qualité' },
  { valeur: 'autre', label: 'Autre' },
]

export function libelleMotif(motif: string | null | undefined): string {
  return MOTIFS_NC.find((m) => m.valeur === motif)?.label ?? motif ?? '—'
}

export type DecisionNc = 'liberation' | 'retour_fournisseur' | 'rebut' | 'reparation'

export const DECISIONS_NC: { valeur: DecisionNc; label: string; aide: string; libelleReference: string }[] = [
  {
    valeur: 'liberation',
    label: 'Libérer en stock',
    aide: 'Vérifié conforme : le produit redevient disponible, à l\'emplacement choisi.',
    libelleReference: 'Référence (facultatif)',
  },
  {
    valeur: 'retour_fournisseur',
    label: 'Retour fournisseur',
    aide: 'Le produit est renvoyé au fournisseur et sort du stock.',
    libelleReference: 'N° de retour / avoir',
  },
  {
    valeur: 'rebut',
    label: 'Mise au rebut',
    aide: 'Le produit est détruit et sort du stock.',
    libelleReference: 'N° de PV de destruction',
  },
  {
    valeur: 'reparation',
    label: 'Réparation',
    aide: 'Le produit reste bloqué en quarantaine en attendant la réparation.',
    libelleReference: 'N° d\'ordre de réparation',
  },
]

export function libelleDecision(decision: string): string {
  return DECISIONS_NC.find((d) => d.valeur === decision)?.label ?? decision
}

export type StatutNc = 'ouverte' | 'en_cours' | 'en_reparation' | 'cloturee'

export const STATUTS_NC: Record<StatutNc, { label: string; ton: 'neutre' | 'succes' | 'info' | 'alerte' | 'danger' }> = {
  ouverte: { label: 'Ouvert', ton: 'danger' },
  en_cours: { label: 'En cours', ton: 'info' },
  en_reparation: { label: 'En réparation', ton: 'info' },
  cloturee: { label: 'Clôturé', ton: 'succes' },
}

export const ORIGINES_NC: Record<string, string> = {
  reception: 'Réception',
  stock: 'Déclaration en stock',
  reprise: 'Reprise (à qualifier)',
}

/** Dossier de non-conformité tel que renvoyé par la vue v_quarantaine. */
export interface NonConformite {
  id: string
  numero: string
  entrepot_id: string
  entrepot_nom: string
  emplacement_id: string
  produit_id: string
  produit_reference: string
  produit_designation: string
  unite_mesure: string
  lot: string | null
  numero_serie: string | null
  date_expiration: string | null
  origine: string
  reception_id: string | null
  reception_numero: string | null
  fournisseur_id: string | null
  fournisseur_nom: string | null
  numero_po: string | null
  motif: MotifNonConformite
  constat: string | null
  quantite_initiale: number
  quantite_restante: number
  quantite_en_reparation: number
  statut: StatutNc
  declare_par_nom: string | null
  cree_le: string
  cloture_le: string | null
  age_jours: number
  valeur_bloquee: number
  nb_traitements: number
  dernier_traitement_le: string | null
}

export interface TraitementNc {
  id: string
  non_conformite_id: string
  decision: DecisionNc
  source: 'a_traiter' | 'reparation'
  quantite: number
  emplacement_destination_code: string | null
  reference_document: string | null
  commentaire: string
  traite_par_nom: string | null
  cree_le: string
}

export async function getNonConformites(): Promise<NonConformite[]> {
  const { data, error } = await supabase.from('v_quarantaine').select('*').order('cree_le', { ascending: false })
  if (error) throw error
  return ((data ?? []) as NonConformite[]).map((nc) => ({ ...nc, valeur_bloquee: Number(nc.valeur_bloquee) }))
}

export async function getTraitementsNc(nonConformiteId: string): Promise<TraitementNc[]> {
  const { data, error } = await supabase
    .from('v_quarantaine_traitements')
    .select('*')
    .eq('non_conformite_id', nonConformiteId)
    .order('cree_le')
  if (error) throw error
  return (data ?? []) as TraitementNc[]
}

/** Nombre de dossiers non clôturés (bouton d'Alertes stock, Dashboard). Null si la base n'a pas encore la quarantaine. */
export async function compterDossiersOuverts(): Promise<{ dossiers: number; unites: number } | null> {
  const { data, error } = await supabase.from('non_conformites').select('quantite_restante').neq('statut', 'cloturee')
  if (error) return null
  return { dossiers: data.length, unites: data.reduce((total, d) => total + (d.quantite_restante as number), 0) }
}

export interface DecisionSaisie {
  decision: DecisionNc
  quantite: number
  source: 'a_traiter' | 'reparation'
  emplacementDestinationId?: string | null
  referenceDocument?: string | null
}

export async function traiterNonConformite(
  nonConformiteId: string,
  decisions: DecisionSaisie[],
  commentaire: string,
  dateMouvement?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('traiter_non_conformite', {
    p_non_conformite_id: nonConformiteId,
    p_decisions: decisions.map((d) => ({
      decision: d.decision,
      quantite: d.quantite,
      source: d.source,
      emplacement_destination_id: d.emplacementDestinationId ?? null,
      reference_document: d.referenceDocument ?? null,
    })),
    p_commentaire: commentaire,
    p_date_mouvement: dateMouvement ?? null,
  })
  if (error) throw error
}

export interface DeclarationNc {
  entrepotId: string
  produitId: string
  emplacementId: string
  stockLotId: string | null
  quantite: number
  motif: MotifNonConformite
  constat: string
  fournisseurId: string | null
  numeroPo: string | null
}

export async function declarerNonConformite(d: DeclarationNc): Promise<string> {
  const { data, error } = await supabase.rpc('declarer_non_conformite', {
    p_entrepot_id: d.entrepotId,
    p_produit_id: d.produitId,
    p_emplacement_id: d.emplacementId,
    p_quantite: d.quantite,
    p_motif: d.motif,
    p_constat: d.constat,
    p_stock_lot_id: d.stockLotId,
    p_fournisseur_id: d.fournisseurId,
    p_numero_po: d.numeroPo,
  })
  if (error) throw error
  return data as string
}
