export type TypeMouvement =
  | 'entree'
  | 'sortie'
  | 'transfert'
  | 'ajustement'
  | 'inventaire'
  | 'deplacement'
  | 'reintegration'
export type StatutStock = 'normal' | 'faible' | 'rupture'
export type TypeProduit = 'consommable' | 'outillage' | 'rotable'
export type Role = 'administrateur' | 'superviseur_entrepot' | 'gestionnaire_entrepot' | 'magasinier'

export interface Entreprise {
  id: string
  nom: string
}

export interface Entrepot {
  id: string
  entreprise_id: string
  nom: string
  adresse: string | null
}

export interface Emplacement {
  id: string
  entrepot_id: string
  zone: string | null
  rayon: string | null
  etagere: string | null
  code: string
  est_quarantaine: boolean
}

export interface Categorie {
  id: string
  entreprise_id: string
  nom: string
}

export interface Fournisseur {
  id: string
  entreprise_id: string
  nom: string
  /** Personne à contacter chez le fournisseur. */
  contact: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  ville: string | null
  pays: string | null
}

export interface Produit {
  id: string
  entreprise_id: string
  reference: string
  designation: string
  categorie_id: string | null
  type: TypeProduit
  unite_mesure: string
  prix_moyen_pondere: number
  stock_min: number
  stock_max: number | null
  seuil_reappro: number | null
  gere_lot: boolean
  gere_numero_serie: boolean
  gere_expiration: boolean
  groupe_variante_id: string | null
}

export interface MouvementStock {
  id: string
  entreprise_id: string
  produit_id: string
  entrepot_id: string
  emplacement_id: string | null
  emplacement_origine_id: string | null
  type: TypeMouvement
  quantite: number
  stock_avant: number
  stock_apres: number
  utilisateur_id: string
  reference: string
  motif: string | null
  lot: string | null
  numero_serie: string | null
  prix_unitaire: number | null
  cree_le: string
}

/** Vue enrichie d'un mouvement pour l'affichage (jointures resolues côté requête). */
export interface MouvementAffiche extends MouvementStock {
  produit_designation: string
  utilisateur_nom: string
}

/** Vue enrichie d'un produit avec son stock disponible courant et son statut d'alerte. */
export interface ProduitAvecStock extends Produit {
  categorie_nom: string | null
  stock_actuel: number
  statut: StatutStock
}

export interface StockParEntrepot {
  entrepot_id: string
  entrepot_nom: string
  nb_produits: number
  quantite_totale: number
  nb_rupture: number
  nb_stock_faible: number
}

export interface StockParCategorie {
  categorie_id: string | null
  categorie_nom: string
  quantite_totale: number
}

export interface TopProduitMouvemente {
  produit_id: string
  produit_designation: string
  quantite_entree: number
  quantite_sortie: number
  nb_mouvements: number
}

/** Une ligne de stock d'un produit, à un emplacement précis (hors quarantaine). */
export interface LocalisationProduit {
  produit_id: string
  entrepot_id: string
  entrepot_nom: string
  emplacement_id: string
  emplacement_code: string
  quantite: number
}

/** Un produit équivalent, tel qu'affiché depuis la fiche d'un autre produit. */
export interface ProduitEquivalent {
  id: string
  reference: string
  designation: string
}

export type StatutReception = 'en_attente' | 'validee' | 'partielle' | 'anomalie'

export interface Reception {
  id: string
  entreprise_id: string
  numero: string
  entrepot_id: string
  fournisseur_id: string | null
  numero_po: string | null
  statut: StatutReception
  cree_par: string
  valide_par: string | null
  valide_le: string | null
  notes: string | null
  cree_le: string
}

export interface ReceptionLigne {
  id: string
  reception_id: string
  produit_id: string
  emplacement_id: string | null
  quantite_attendue: number
  quantite_recue: number
  lot: string | null
  numero_serie: string | null
  date_expiration: string | null
  prix_unitaire: number
  anomalie: boolean
  quantite_non_conforme: number | null
  motif_non_conformite: string | null
  constat_non_conformite: string | null
  cree_le: string
}

export type StatutBonSortie = 'demandee' | 'confirmee' | 'annulee'

export interface BonSortie {
  id: string
  entreprise_id: string
  numero: string
  entrepot_id: string
  demande_par: string
  statut: StatutBonSortie
  motif: string | null
  cree_le: string
}

export interface BonSortieLigne {
  id: string
  bon_sortie_id: string
  produit_id: string
  emplacement_id: string | null
  quantite: number
}

export interface Reintegration {
  id: string
  entreprise_id: string
  numero: string
  entrepot_id: string
  demande_par: string
  notes: string | null
  cree_le: string
}

export interface ReintegrationLigne {
  id: string
  reintegration_id: string
  bon_sortie_ligne_id: string
  produit_id: string
  emplacement_id: string
  quantite: number
  notes: string | null
}

/** Une ligne de sortie confirmée encore (partiellement) réintégrable — alimente le "Détail des sorties" de la fenêtre Réintégration. */
export interface SortieAReintegrer {
  bon_sortie_ligne_id: string
  produit_id: string
  produit_reference: string
  produit_designation: string
  entrepot_id: string
  bon_sortie_numero: string
  motif: string | null
  sortie_le: string
  quantite_sortie: number
  quantite_reintegree: number
  quantite_disponible: number
}

export type StatutTransfert = 'demande' | 'valide' | 'expedie' | 'en_transit' | 'recu'

export interface Transfert {
  id: string
  entreprise_id: string
  numero_suivi: string
  entrepot_source_id: string
  entrepot_destination_id: string
  statut: StatutTransfert
  demande_par: string
  valide_par: string | null
  cree_le: string
  expedie_le: string | null
  recu_le: string | null
}

export interface TransfertAffiche extends Transfert {
  entrepot_source_nom: string
  entrepot_destination_nom: string
}

export interface TransfertLigne {
  id: string
  transfert_id: string
  produit_id: string
  quantite_expediee: number
  quantite_recue: number | null
  emplacement_source_id: string | null
  emplacement_destination_id: string | null
}

export interface TransfertLigneAffichee extends TransfertLigne {
  produit_reference: string
  produit_designation: string
}


/** Ce qu'il reste d'un lot à un emplacement (hors Quarantaine), tel qu'affiché dans la feuille de sortie. */
export interface StockLot {
  /** Identifiant du lot en base ; null tant que le suivi par lot n'est pas installé (repli sur le stock par emplacement). */
  id: string | null
  produit_id: string
  entrepot_id: string
  emplacement_id: string
  emplacement_code: string
  lot: string | null
  numero_serie: string | null
  date_expiration: string | null
  date_entree: string | null
  quantite: number
}
