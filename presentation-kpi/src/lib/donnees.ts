import type { Ligne } from './types'

/**
 * Données de démonstration reprises du Google Sheet « Data KPI West Africa ».
 * Elles seront remplacées par la lecture en direct de l'onglet « Données app ».
 * Livreurs : le Sheet indique TOP / FLOP, les % ci-dessous sont des valeurs d'exemple.
 */
const S1 = '2026-10-26'
const S2 = '2026-11-02'

const l = (periode: string, pays: string, indicateur: string, valeur: number | null): Ligne => ({
  periode,
  type: 'semaine',
  pays,
  indicateur,
  valeur,
})

export const DONNEES_DEMO: Ligne[] = [
  // OTD
  l(S1, 'CI', 'otd', 91.0),
  l(S1, 'CD', 'otd', 66.7),
  l(S2, 'CI', 'otd', 98.8),
  l(S2, 'CD', 'otd', 85.7),

  // Stock montures (nombre de modèles présents)
  ...[S1, S2].flatMap((s) => [
    l(s, 'CI', 'stock.montures', 158),
    l(s, 'CI', 'stock.lapaire_plus', 17),
    l(s, 'CI', 'stock.solaires', 26),
    l(s, 'CD', 'stock.montures', 146),
    l(s, 'CD', 'stock.lapaire_plus', 20),
    l(s, 'CD', 'stock.solaires', 16),
  ]),

  // Consommables : couverture (mois) et stock (unités)
  l(S2, 'CI', 'couverture.etuis', 6.6),
  l(S2, 'CI', 'stock_conso.etuis', 35383),
  l(S2, 'CI', 'couverture.etuis_plus', 15.5),
  l(S2, 'CI', 'stock_conso.etuis_plus', 3579),
  l(S2, 'CI', 'couverture.sacs', 1.3),
  l(S2, 'CI', 'stock_conso.sacs', 6750),
  l(S2, 'CI', 'couverture.sprays', 4.4),
  l(S2, 'CI', 'stock_conso.sprays', 554),
  l(S2, 'CI', 'couverture.pochettes', 1.95),
  l(S2, 'CI', 'stock_conso.pochettes', 1365),
  l(S2, 'CD', 'couverture.etuis', 1.6),
  l(S2, 'CD', 'stock_conso.etuis', 255),
  l(S2, 'CD', 'couverture.etuis_plus', 19.3),
  l(S2, 'CD', 'stock_conso.etuis_plus', 135),
  l(S2, 'CD', 'couverture.sacs', 2.16),
  l(S2, 'CD', 'stock_conso.sacs', 350),
  l(S2, 'CD', 'couverture.sprays', null),
  l(S2, 'CD', 'stock_conso.sprays', 5),
  l(S2, 'CD', 'couverture.pochettes', 7.17),
  l(S2, 'CD', 'stock_conso.pochettes', 86),

  // Production
  l(S2, 'CI', 'prod.non_assemblees', 9),
  l(S2, 'CI', 'prod.productivite', 100),
  l(S2, 'CI', 'prod.casse', 1.6),
  l(S2, 'CI', 'prod.qualite', 1.3),
  l(S2, 'CD', 'prod.non_assemblees', 2),
  l(S2, 'CD', 'prod.productivite', 100),
  l(S2, 'CD', 'prod.casse', 0.6),
  l(S2, 'CD', 'prod.qualite', 1.9),

  // Livreurs (exemple en %)
  l(S2, 'CI', 'liv.tournees', 100),
  l(S2, 'CI', 'liv.moto', 100),
  l(S2, 'CI', 'liv.communication', 100),
  l(S2, 'CD', 'liv.tournees', 60),
  l(S2, 'CD', 'liv.moto', null),
  l(S2, 'CD', 'liv.communication', 100),
]

/**
 * Mensuel (démo) : OTD Côte d'Ivoire de l'onglet « Point mensuel ».
 * Les autres familles reprennent les derniers chiffres hebdo, en attendant les vraies données mensuelles.
 */
const M_SEPT = '2026-09-01'
const M_OCT = '2026-10-01'
const mo = (periode: string, pays: string, indicateur: string, valeur: number | null): Ligne => ({ periode, type: 'mois', pays, indicateur, valeur })

DONNEES_DEMO.push(
  mo(M_SEPT, 'CI', 'otd', 80.1),
  mo(M_OCT, 'CI', 'otd', 78.4),
  ...DONNEES_DEMO.filter((x) => x.periode === S2 && x.indicateur !== 'otd').map((x) => ({ ...x, type: 'mois' as const, periode: M_OCT })),
)

/** Pays proposés par défaut à la préparation (ceux qui ont des données). */
export const PAYS_SUIVIS = ['CI', 'CD', 'TG', 'BJ']

export function periodesDisponibles(lignes: Ligne[], type: Ligne['type']) {
  return [...new Set(lignes.filter((x) => x.type === type).map((x) => x.periode))].sort()
}

/** Valeur d'un indicateur pour un pays à une période (la plus récente <= periode si absente). */
export function valeur(lignes: Ligne[], pays: string, indicateur: string, periode: string): number | null {
  const candidates = lignes
    .filter((x) => x.pays === pays && x.indicateur === indicateur && x.periode <= periode && !x.agence)
    .sort((a, b) => b.periode.localeCompare(a.periode))
  const exacte = candidates.find((x) => x.periode === periode)
  return (exacte ?? candidates[0])?.valeur ?? null
}

export function aDesDonnees(lignes: Ligne[], pays: string, prefixes: string[], periode: string) {
  return lignes.some(
    (x) => x.pays === pays && x.periode <= periode && x.valeur != null && prefixes.some((p) => x.indicateur.startsWith(p)),
  )
}
