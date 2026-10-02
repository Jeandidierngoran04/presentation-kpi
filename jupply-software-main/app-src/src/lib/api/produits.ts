import { supabase } from '../supabase'
import type {
  Categorie,
  Fournisseur,
  LocalisationProduit,
  MouvementAffiche,
  Produit,
  ProduitEquivalent,
  TypeProduit,
} from '../../types/stock'

export async function getCategories(): Promise<Categorie[]> {
  const { data, error } = await supabase.from('categories').select('*').order('nom')
  if (error) throw error
  return data as Categorie[]
}

export async function getFournisseurs(): Promise<Fournisseur[]> {
  const { data, error } = await supabase.from('fournisseurs').select('*').order('nom')
  if (error) throw error
  return data as Fournisseur[]
}

interface LigneStockLocalisation {
  produit_id: string
  entrepot_id: string
  emplacement_id: string
  quantite: number
  entrepots: { nom: string } | null
  emplacements: { code: string; est_quarantaine: boolean } | null
}

/** Stock par produit, hors emplacements de Quarantaine, groupé par produit. */
export async function getLocalisationsProduits(): Promise<Map<string, LocalisationProduit[]>> {
  const { data, error } = await supabase
    .from('stock_produits')
    .select('produit_id, entrepot_id, emplacement_id, quantite, entrepots(nom), emplacements(code, est_quarantaine)')
    .gt('quantite', 0)
  if (error) throw error

  const parProduit = new Map<string, LocalisationProduit[]>()
  for (const ligne of (data ?? []) as unknown as LigneStockLocalisation[]) {
    if (ligne.emplacements?.est_quarantaine) continue
    const liste = parProduit.get(ligne.produit_id) ?? []
    liste.push({
      produit_id: ligne.produit_id,
      entrepot_id: ligne.entrepot_id,
      entrepot_nom: ligne.entrepots?.nom ?? '',
      emplacement_id: ligne.emplacement_id,
      emplacement_code: ligne.emplacements?.code ?? '',
      quantite: ligne.quantite,
    })
    parProduit.set(ligne.produit_id, liste)
  }
  return parProduit
}

/** Quantité restant attendue sur les réceptions non encore validées, par produit. */
export async function getCommandesProduits(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('v_produits_commandes').select('produit_id, quantite_commandee')
  if (error) throw error
  return new Map((data ?? []).map((d) => [d.produit_id as string, d.quantite_commandee as number]))
}

export async function getMouvementsProduit(produitId: string, limite = 20): Promise<MouvementAffiche[]> {
  const { data, error } = await supabase
    .from('v_mouvements_recents')
    .select('*')
    .eq('produit_id', produitId)
    .order('cree_le', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data as MouvementAffiche[]
}

export async function getFournisseursProduit(produitId: string): Promise<Fournisseur[]> {
  const { data: liens, error } = await supabase
    .from('produits_fournisseurs')
    .select('fournisseur_id')
    .eq('produit_id', produitId)
  if (error) throw error
  const ids = (liens ?? []).map((l) => l.fournisseur_id)
  if (ids.length === 0) return []
  const { data, error: erreurFournisseurs } = await supabase.from('fournisseurs').select('*').in('id', ids)
  if (erreurFournisseurs) throw erreurFournisseurs
  return data as Fournisseur[]
}

/** Toutes les liaisons d'équivalence de l'entreprise, produit_id -> liste d'ids équivalents. */
export async function getToutesLesEquivalences(): Promise<Map<string, string[]>> {
  const { data, error } = await supabase.from('produits_equivalents').select('produit_id, produit_equivalent_id')
  if (error) throw error
  const parProduit = new Map<string, string[]>()
  for (const lien of data ?? []) {
    const liste = parProduit.get(lien.produit_id) ?? []
    liste.push(lien.produit_equivalent_id)
    parProduit.set(lien.produit_id, liste)
  }
  return parProduit
}

export async function getEquivalents(produitId: string): Promise<ProduitEquivalent[]> {
  const { data: liens, error } = await supabase
    .from('produits_equivalents')
    .select('produit_equivalent_id')
    .eq('produit_id', produitId)
  if (error) throw error
  const ids = (liens ?? []).map((l) => l.produit_equivalent_id)
  if (ids.length === 0) return []
  const { data, error: erreurProduits } = await supabase
    .from('produits')
    .select('id, reference, designation')
    .in('id', ids)
  if (erreurProduits) throw erreurProduits
  return data as ProduitEquivalent[]
}

export interface NouveauProduit {
  entrepriseId: string
  reference: string
  designation: string
  categorieId: string | null
  type: TypeProduit
  uniteMesure: string
  prix: number
  stockMin: number
  stockMax: number | null
  seuilReappro: number | null
  gereLot: boolean
  gereNumeroSerie: boolean
  gereExpiration: boolean
  fournisseurIds: string[]
}

export async function creerProduit(donnees: NouveauProduit): Promise<Produit> {
  const { data, error } = await supabase
    .from('produits')
    .insert({
      entreprise_id: donnees.entrepriseId,
      reference: donnees.reference,
      designation: donnees.designation,
      categorie_id: donnees.categorieId,
      type: donnees.type,
      unite_mesure: donnees.uniteMesure,
      prix_moyen_pondere: donnees.prix,
      stock_min: donnees.stockMin,
      stock_max: donnees.stockMax,
      seuil_reappro: donnees.seuilReappro,
      gere_lot: donnees.gereLot,
      gere_numero_serie: donnees.gereNumeroSerie,
      gere_expiration: donnees.gereExpiration,
    })
    .select()
    .single()
  if (error) throw error
  const produit = data as Produit

  if (donnees.fournisseurIds.length > 0) {
    const { error: erreurLiens } = await supabase
      .from('produits_fournisseurs')
      .insert(donnees.fournisseurIds.map((fournisseurId) => ({ produit_id: produit.id, fournisseur_id: fournisseurId })))
    if (erreurLiens) throw erreurLiens
  }

  return produit
}

export async function creerCategorie(entrepriseId: string, nom: string): Promise<Categorie> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ entreprise_id: entrepriseId, nom })
    .select()
    .single()
  if (error) throw error
  return data as Categorie
}

export type CoordonneesFournisseur = Partial<
  Pick<Fournisseur, 'contact' | 'telephone' | 'email' | 'adresse' | 'ville' | 'pays'>
>

export async function creerFournisseur(
  entrepriseId: string,
  nom: string,
  coordonnees: CoordonneesFournisseur = {},
): Promise<Fournisseur> {
  // Seules les coordonnées renseignées sont envoyées (champs vides -> non transmis).
  const renseignees = Object.fromEntries(Object.entries(coordonnees).filter(([, v]) => v != null && v !== ''))
  const { data, error } = await supabase
    .from('fournisseurs')
    .insert({ entreprise_id: entrepriseId, nom, ...renseignees })
    .select()
    .single()
  if (error) throw error
  return data as Fournisseur
}

export async function lierEquivalent(produitId: string, autreProduitId: string): Promise<void> {
  const { error } = await supabase.from('produits_equivalents').insert([
    { produit_id: produitId, produit_equivalent_id: autreProduitId },
    { produit_id: autreProduitId, produit_equivalent_id: produitId },
  ])
  if (error) throw error
}

export async function supprimerProduit(produitId: string): Promise<void> {
  const { error } = await supabase.from('produits').delete().eq('id', produitId)
  if (error) throw error
}

export async function delierEquivalent(produitId: string, autreProduitId: string): Promise<void> {
  const { error: e1 } = await supabase
    .from('produits_equivalents')
    .delete()
    .eq('produit_id', produitId)
    .eq('produit_equivalent_id', autreProduitId)
  if (e1) throw e1
  const { error: e2 } = await supabase
    .from('produits_equivalents')
    .delete()
    .eq('produit_id', autreProduitId)
    .eq('produit_equivalent_id', produitId)
  if (e2) throw e2
}
