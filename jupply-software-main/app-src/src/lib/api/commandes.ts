import { supabase } from '../supabase'
import type { TonBadge } from '../../components/ui/Badge'

export type StatutCommande = 'fait' | 'envoye' | 'en_transit' | 'en_cours_reception' | 'completee' | 'cloturee'

// Vert = terminé, bleu = en cours, gris = en attente ou arrêté.
export const STATUTS_COMMANDE: Record<StatutCommande, { label: string; ton: TonBadge }> = {
  fait: { label: 'Fait', ton: 'neutre' },
  envoye: { label: 'Envoyé', ton: 'info' },
  en_transit: { label: 'En transit', ton: 'info' },
  en_cours_reception: { label: 'En cours de réception', ton: 'info' },
  completee: { label: 'Complétée', ton: 'succes' },
  cloturee: { label: 'Clôturée', ton: 'neutre' },
}

/** Commande terminée : grisée, plus aucune réception ni changement possible. */
export function commandeTerminee(statut: StatutCommande): boolean {
  return statut === 'completee' || statut === 'cloturee'
}

/** Une réception est possible une fois la commande envoyée, tant qu'elle n'est pas terminée. */
export function commandeReceptionnable(statut: StatutCommande): boolean {
  return statut === 'envoye' || statut === 'en_transit' || statut === 'en_cours_reception'
}

export interface CommandeFournisseur {
  id: string
  numero: string
  fournisseur_id: string
  fournisseur_nom: string
  entrepot_id: string
  entrepot_nom: string
  statut: StatutCommande
  date_commande: string
  date_livraison_prevue: string | null
  notes: string | null
  motif_cloture: string | null
  cree_par_nom: string | null
  cree_le: string
  envoye_le: string | null
  transit_le: string | null
  completee_le: string | null
  cloturee_le: string | null
  nb_lignes: number
  quantite_commandee: number
  quantite_recue: number
  montant: number
  pourcentage_recu: number
  nb_receptions: number
}

export interface LigneCommande {
  id: string
  commande_id: string
  produit_id: string
  produit_reference: string
  produit_designation: string
  unite_mesure: string
  gere_expiration: boolean
  quantite_commandee: number
  quantite_recue: number
  quantite_restante: number
  prix_unitaire: number
  montant: number
}

export interface ReceptionDeCommande {
  id: string
  numero: string
  statut: string
  cree_le: string
}

export async function getCommandes(): Promise<CommandeFournisseur[]> {
  const { data, error } = await supabase
    .from('v_commandes_fournisseurs')
    .select('*')
    .order('cree_le', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => ({ ...c, montant: Number(c.montant) })) as CommandeFournisseur[]
}

export async function getLignesCommande(commandeId: string): Promise<LigneCommande[]> {
  const { data, error } = await supabase
    .from('v_commandes_fournisseurs_lignes')
    .select('*')
    .eq('commande_id', commandeId)
    .order('produit_reference')
  if (error) throw error
  return (data ?? []).map((l) => ({ ...l, prix_unitaire: Number(l.prix_unitaire), montant: Number(l.montant) })) as LigneCommande[]
}

export async function getReceptionsCommande(commandeId: string): Promise<ReceptionDeCommande[]> {
  const { data, error } = await supabase
    .from('receptions')
    .select('id, numero, statut, cree_le')
    .eq('commande_id', commandeId)
    .order('cree_le')
  if (error) throw error
  return (data ?? []) as ReceptionDeCommande[]
}

/** Une commande en cours sur un produit, vue depuis la fenêtre Info du produit. */
export interface CommandeEnCoursProduit {
  commande_id: string
  numero: string
  fournisseur_nom: string
  statut: StatutCommande
  date_livraison_prevue: string | null
  quantite_commandee: number
  quantite_recue: number
  quantite_restante: number
}

/** Commandes non terminées qui attendent encore ce produit, de la livraison la plus proche à la plus lointaine. */
export async function getCommandesEnCoursProduit(produitId: string): Promise<CommandeEnCoursProduit[]> {
  return (await chargerCommandesEnCours(produitId)).get(produitId) ?? []
}

/** Commandes en cours de tous les produits, regroupées par produit (écran Alertes stock). */
export function getCommandesEnCoursParProduit(): Promise<Map<string, CommandeEnCoursProduit[]>> {
  return chargerCommandesEnCours()
}

async function chargerCommandesEnCours(produitId?: string): Promise<Map<string, CommandeEnCoursProduit[]>> {
  let requete = supabase
    .from('v_commandes_fournisseurs_lignes')
    .select('produit_id, commande_id, quantite_commandee, quantite_recue, quantite_restante')
    .gt('quantite_restante', 0)
  if (produitId) requete = requete.eq('produit_id', produitId)
  const { data: lignes, error } = await requete
  if (error) throw error
  const resultat = new Map<string, CommandeEnCoursProduit[]>()
  if (!lignes || lignes.length === 0) return resultat
  const { data: commandes, error: erreurCommandes } = await supabase
    .from('v_commandes_fournisseurs')
    .select('id, numero, fournisseur_nom, statut, date_livraison_prevue')
    .in('id', [...new Set(lignes.map((l) => l.commande_id as string))])
    .in('statut', ['fait', 'envoye', 'en_transit', 'en_cours_reception'])
  if (erreurCommandes) throw erreurCommandes
  const parId = new Map((commandes ?? []).map((c) => [c.id as string, c]))
  for (const l of lignes) {
    const c = parId.get(l.commande_id as string)
    if (!c) continue
    const liste = resultat.get(l.produit_id as string) ?? []
    liste.push({
      commande_id: c.id as string,
      numero: c.numero as string,
      fournisseur_nom: c.fournisseur_nom as string,
      statut: c.statut as StatutCommande,
      date_livraison_prevue: (c.date_livraison_prevue as string | null) ?? null,
      quantite_commandee: l.quantite_commandee as number,
      quantite_recue: l.quantite_recue as number,
      quantite_restante: l.quantite_restante as number,
    })
    resultat.set(l.produit_id as string, liste)
  }
  for (const liste of resultat.values()) {
    liste.sort((a, b) => (a.date_livraison_prevue ?? '9999').localeCompare(b.date_livraison_prevue ?? '9999'))
  }
  return resultat
}

export interface NouvelleLigneCommande {
  produitId: string
  quantiteCommandee: number
  prixUnitaire: number
}

export async function creerCommande(donnees: {
  entrepotId: string
  fournisseurId: string
  dateLivraisonPrevue: string | null
  notes: string | null
  lignes: NouvelleLigneCommande[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('creer_commande_fournisseur', {
    p_entrepot_id: donnees.entrepotId,
    p_fournisseur_id: donnees.fournisseurId,
    p_lignes: donnees.lignes.map((l) => ({
      produit_id: l.produitId,
      quantite_commandee: l.quantiteCommandee,
      prix_unitaire: l.prixUnitaire,
    })),
    p_date_livraison_prevue: donnees.dateLivraisonPrevue,
    p_notes: donnees.notes,
  })
  if (error) throw error
  return data as string
}

export async function changerStatutCommande(commandeId: string, statut: 'envoye' | 'en_transit'): Promise<void> {
  const { error } = await supabase.rpc('changer_statut_commande', { p_commande_id: commandeId, p_statut: statut })
  if (error) throw error
}

export async function cloturerCommande(commandeId: string, motif: string): Promise<void> {
  const { error } = await supabase.rpc('cloturer_commande', { p_commande_id: commandeId, p_motif: motif })
  if (error) throw error
}

export interface LigneReceptionCommande {
  commandeLigneId: string
  emplacementId: string
  quantiteRecue: number
  lot: string | null
  numeroSerie: string | null
  dateExpiration: string | null
  quantiteNonConforme: number
  motifNonConformite: string | null
  constatNonConformite: string | null
}

/** Enregistre et valide en une fois une réception sur la commande ; renvoie l'id de la réception. */
export async function receptionnerCommande(
  commandeId: string,
  lignes: LigneReceptionCommande[],
  notes: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('receptionner_commande', {
    p_commande_id: commandeId,
    p_lignes: lignes.map((l) => ({
      commande_ligne_id: l.commandeLigneId,
      emplacement_id: l.emplacementId,
      quantite_recue: l.quantiteRecue,
      lot: l.lot,
      numero_serie: l.numeroSerie,
      date_expiration: l.dateExpiration,
      quantite_non_conforme: l.quantiteNonConforme,
      motif_non_conformite: l.motifNonConformite,
      constat_non_conformite: l.constatNonConformite,
    })),
    p_notes: notes,
  })
  if (error) throw error
  return data as string
}
