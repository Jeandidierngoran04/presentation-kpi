import type { Cibles, Famille, Indicateur, Seuils, Statut } from './types'

export const FAMILLES: { id: Famille; libelle: string; description: string }[] = [
  { id: 'otd', libelle: 'On-Time Delivery', description: 'Livraisons à l’heure' },
  { id: 'stock', libelle: 'Stock montures', description: 'Modèles présents en agence' },
  { id: 'consommables', libelle: 'Couverture', description: 'Etuis, sacs, sprays, pochettes' },
  { id: 'production', libelle: 'Production', description: 'Atelier de montage' },
  { id: 'livreurs', libelle: 'Livreurs', description: 'Tournées, moto, communication' },
  { id: 'autres', libelle: 'Autres indicateurs', description: 'Ajoutés dans l’application' },
  { id: 'reclamations', libelle: 'Réclamations qualité', description: 'Par pays, agence et nature' },
]

export const ARTICLES = [
  { id: 'etuis', libelle: 'Etuis' },
  { id: 'etuis_plus', libelle: 'Etuis+' },
  { id: 'sacs', libelle: 'Sacs cabas' },
  { id: 'sprays', libelle: 'Sprays' },
  { id: 'pochettes', libelle: 'Pochettes' },
]

export const CATALOGUE: Indicateur[] = [
  { id: 'otd', libelle: 'On-Time Delivery', court: 'OTD', famille: 'otd', unite: '%', sens: 'haut', cible: 100, alerte: 95 },

  { id: 'stock.montures', libelle: 'Montures Lapaire', court: 'Montures', famille: 'stock', unite: 'modeles', sens: 'haut', cible: 150, alerte: 135 },
  { id: 'stock.lapaire_plus', libelle: 'Montures Lapaire +', court: 'Lapaire +', famille: 'stock', unite: 'modeles', sens: 'haut', cible: 25, alerte: 20 },
  { id: 'stock.solaires', libelle: 'Solaires', famille: 'stock', unite: 'modeles', sens: 'haut', cible: 30, alerte: 24 },

  // Couverture : une seule cible commune à tous les articles (réglable)
  { id: 'couverture', libelle: 'Couverture des consommables', court: 'Couverture', famille: 'consommables', unite: 'mois', sens: 'haut', cible: 2, alerte: 1 },

  { id: 'prod.non_assemblees', libelle: 'Affaires non assemblées', famille: 'production', unite: 'nb', sens: 'bas', cible: 0, alerte: 1 },
  { id: 'prod.productivite', libelle: 'Productivité', famille: 'production', unite: '%', sens: 'haut', cible: 100, alerte: 95 },
  { id: 'prod.casse', libelle: 'Casse atelier', court: 'Casse', famille: 'production', unite: '‰', sens: 'bas', cible: 2, alerte: 3 },
  { id: 'prod.qualite', libelle: 'Qualité de montage', famille: 'production', unite: 'note', sens: 'bas', cible: 2, alerte: 3 },

  { id: 'liv.tournees', libelle: 'Respect des tournées', court: 'Tournées', famille: 'livreurs', unite: '%', sens: 'haut', cible: 100, alerte: 90 },
  { id: 'liv.moto', libelle: 'Conduite et entretien moto', court: 'Moto', famille: 'livreurs', unite: '%', sens: 'haut', cible: 100, alerte: 90 },
  { id: 'liv.communication', libelle: 'Communication', famille: 'livreurs', unite: '%', sens: 'haut', cible: 100, alerte: 90 },
]

/** Indicateurs ajoutés dans l'application (par origine) : intégrés au catalogue au démarrage et à chaque modification */
export function synchroniserPerso(perso: Indicateur[], origine = 'saisie') {
  for (let i = CATALOGUE.length - 1; i >= 0; i--) if (CATALOGUE[i].perso && (CATALOGUE[i].origine ?? 'saisie') === origine) CATALOGUE.splice(i, 1)
  CATALOGUE.push(...perso.map((p) => ({ ...p, famille: p.famille ?? 'autres', perso: true, origine })))
}

/** Noms des rubriques créées dans Paramètres (KPI manuels) */
export const NOMS_FAMILLES: Record<string, string> = {}
export const libelleFamille = (id: string) => FAMILLES.find((f) => f.id === id)?.libelle ?? NOMS_FAMILLES[id] ?? id

export const indicateur = (id: string) => {
  const base = id.startsWith('couverture.') ? 'couverture' : id
  return CATALOGUE.find((i) => i.id === base)
}

export const ciblesParDefaut = (): Cibles =>
  Object.fromEntries(CATALOGUE.map((i) => [i.id, { cible: i.cible, alerte: i.alerte }]))

/** Cible et seuil d'alerte d'un indicateur pour un pays (cible du pays si elle existe, sinon la cible par défaut) */
export function cibleDe(cibles: Cibles, id: string, pays?: string): Seuils {
  const ind = indicateur(id)
  const base = ind ? ind.id : id
  const c = cibles[base] ?? (ind ? { cible: ind.cible, alerte: ind.alerte } : { cible: 0, alerte: 0 })
  const propre = pays ? c.parPays?.[pays] : undefined
  return propre ?? { cible: c.cible, alerte: c.alerte }
}

export function statut(id: string, valeur: number | null | undefined, cibles: Cibles, pays?: string): Statut {
  const ind = indicateur(id)
  if (!ind || valeur == null || Number.isNaN(valeur)) return 'vide'
  const c = cibleDe(cibles, id, pays)
  if (ind.sens === 'haut') {
    if (valeur >= c.cible) return 'bon'
    if (valeur > c.alerte) return 'vigilance'
    return 'alerte'
  }
  if (valeur <= c.cible) return 'bon'
  if (valeur < c.alerte) return 'vigilance'
  return 'alerte'
}

const ORDRE: Statut[] = ['alerte', 'vigilance', 'bon', 'vide']
export const pire = (liste: Statut[]): Statut =>
  liste.length === 0 ? 'vide' : ORDRE.find((s) => s !== 'vide' && liste.includes(s)) ?? 'vide'
