import type { Role } from '../types/stock'

/** Peut créer ou modifier un entrepôt (nouveau site). */
export function peutGererEntrepots(role: Role | undefined): boolean {
  return role === 'administrateur' || role === 'superviseur_entrepot'
}

/** Peut supprimer un entrepôt. */
export function peutSupprimerEntrepot(role: Role | undefined): boolean {
  return role === 'administrateur'
}

/**
 * Peut ajouter/modifier/supprimer un emplacement dans un entrepôt donné :
 * Administrateur et Superviseur Entrepôt partout, Gestionnaire uniquement
 * sur ses entrepôts assignés. Le Magasinier ne peut jamais.
 */
export function peutGererEmplacements(
  role: Role | undefined,
  entrepotId: string,
  entrepotsAssignes: string[],
): boolean {
  if (role === 'administrateur' || role === 'superviseur_entrepot') return true
  if (role === 'gestionnaire_entrepot') return entrepotsAssignes.includes(entrepotId)
  return false
}

/** Peut créer/modifier le catalogue (produits, catégories, fournisseurs, équivalents). */
export function peutGererCatalogue(role: Role | undefined): boolean {
  return role === 'administrateur' || role === 'superviseur_entrepot' || role === 'gestionnaire_entrepot'
}

/** Peut supprimer un produit du catalogue. */
export function peutSupprimerProduit(role: Role | undefined): boolean {
  return role === 'administrateur'
}

/** Peut saisir (créer) une réception sur un entrepôt donné — tous les rôles opérationnels. */
export function peutSaisirReception(role: Role | undefined, entrepotId: string, entrepotsAssignes: string[]): boolean {
  if (role === 'administrateur' || role === 'superviseur_entrepot') return true
  if (role === 'gestionnaire_entrepot' || role === 'magasinier') return entrepotsAssignes.includes(entrepotId)
  return false
}

/** Peut valider une réception (fait réellement augmenter le stock) — pas le Magasinier. */
export function peutValiderReception(role: Role | undefined, entrepotId: string, entrepotsAssignes: string[]): boolean {
  if (role === 'administrateur' || role === 'superviseur_entrepot') return true
  if (role === 'gestionnaire_entrepot') return entrepotsAssignes.includes(entrepotId)
  return false
}

/** Peut saisir une sortie (déduction immédiate) — mêmes règles que la saisie d'une réception. */
export function peutSaisirSortie(role: Role | undefined, entrepotId: string, entrepotsAssignes: string[]): boolean {
  return peutSaisirReception(role, entrepotId, entrepotsAssignes)
}

/** Peut réintégrer une sortie (annulation sans suppression) — mêmes règles que la validation d'une réception. */
export function peutReintegrer(role: Role | undefined, entrepotId: string, entrepotsAssignes: string[]): boolean {
  return peutValiderReception(role, entrepotId, entrepotsAssignes)
}

/** Peut demander un transfert entre entrepôts — cahier des charges : Superviseur Entrepôt (+ Administrateur). */
export function peutDemanderTransfert(role: Role | undefined): boolean {
  return role === 'administrateur' || role === 'superviseur_entrepot'
}

/** Peut valider une demande de transfert — Administrateur ou Superviseur Entrepôt. */
export function peutValiderTransfert(role: Role | undefined): boolean {
  return role === 'administrateur' || role === 'superviseur_entrepot'
}

/** Peut expédier un transfert (côté entrepôt source) — mêmes règles que la saisie d'une réception, sur l'entrepôt source. */
export function peutExpedierTransfert(
  role: Role | undefined,
  entrepotSourceId: string,
  entrepotsAssignes: string[],
): boolean {
  return peutSaisirReception(role, entrepotSourceId, entrepotsAssignes)
}

/** Peut réceptionner un transfert (côté entrepôt destination) — mêmes règles que la saisie d'une réception, sur l'entrepôt destination. */
export function peutReceptionnerTransfert(
  role: Role | undefined,
  entrepotDestinationId: string,
  entrepotsAssignes: string[],
): boolean {
  return peutSaisirReception(role, entrepotDestinationId, entrepotsAssignes)
}
