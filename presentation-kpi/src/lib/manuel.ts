import { useSyncExternalStore } from 'react'
import { NOMS_FAMILLES, synchroniserPerso } from './catalogue'
import type { Cibles, Famille, Indicateur, Ligne, Seuils, Sens, Unite } from './types'

/**
 * KPI saisis à la main (onglet Paramètres), indépendants du Google Sheet.
 * Un KPI contient un ou plusieurs éléments (ex. Stock : Montures, Lapaire +, Solaires) ;
 * chaque élément a sa cible par défaut et, si besoin, une cible propre à chaque pays.
 * Les KPI sont enregistrés et réutilisables d'une présentation à l'autre.
 * (Maquette : enregistré dans ce navigateur ; passera sur le serveur avec la mise en ligne.)
 */
export type ElementKpi = {
  id: string
  libelle: string
  unite: Unite
  sens: Sens
  cible: number
  alerte: number
  parPays?: Record<string, Seuils>
}
export type KpiManuel = { id: string; nom: string; elements: ElementKpi[] }
export type Manuel = { kpis: KpiManuel[]; valeurs: Ligne[] }

const CLE = 'kpi.manuel'
const VIDE: Manuel = { kpis: [], valeurs: [] }

export const familleKpi = (k: Pick<KpiManuel, 'id'>): Famille => `m:${k.id}`
export const idElement = (k: Pick<KpiManuel, 'id'>, e: Pick<ElementKpi, 'id'>) => `m.${k.id}.${e.id}`
export const nouvelId = () => Math.random().toString(36).slice(2, 9)

function lire(): Manuel {
  try {
    const s = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Manuel | null
    return s ? { kpis: s.kpis ?? [], valeurs: s.valeurs ?? [] } : VIDE
  } catch {
    return VIDE
  }
}

/** Les éléments des KPI manuels deviennent des indicateurs du catalogue (rubrique « m:<id> ») */
function synchroniser(m: Manuel) {
  const inds: Indicateur[] = m.kpis.flatMap((k) =>
    k.elements.map((e) => ({ id: idElement(k, e), libelle: e.libelle || 'Sans nom', famille: familleKpi(k), unite: e.unite, sens: e.sens, cible: e.cible, alerte: e.alerte })),
  )
  synchroniserPerso(inds, 'manuel')
  for (const k of Object.keys(NOMS_FAMILLES)) delete NOMS_FAMILLES[k]
  m.kpis.forEach((k) => (NOMS_FAMILLES[familleKpi(k)] = k.nom || 'KPI sans nom'))
}

let etat: Manuel = lire()
synchroniser(etat)
const abonnes = new Set<() => void>()

export function enregistrerManuel(m: Manuel) {
  etat = m
  synchroniser(m)
  try {
    localStorage.setItem(CLE, JSON.stringify(m))
  } catch {
    /* stockage indisponible */
  }
  abonnes.forEach((f) => f())
}

export function useManuel() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
}

/** Cibles des éléments manuels, au format du moteur de diapos */
export function ciblesManuelles(m: Manuel): Cibles {
  return Object.fromEntries(m.kpis.flatMap((k) => k.elements.map((e) => [idElement(k, e), { cible: e.cible, alerte: e.alerte, parPays: e.parPays }])))
}
