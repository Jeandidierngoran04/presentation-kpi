import { useMemo, useSyncExternalStore } from 'react'
import { synchroniserPerso } from './catalogue'
import { relireAvecNouveauxIndicateurs, useDonnees } from './source'
import type { Indicateur, Ligne } from './types'

/**
 * Saisie dans l'application : indicateurs ajoutés par l'utilisateur et chiffres saisis à la main.
 * Les chiffres saisis complètent ceux du Google Sheet ; pour un même pays, une même période et un même
 * indicateur, la valeur saisie remplace celle du Sheet.
 * (Maquette : enregistré dans ce navigateur ; passera sur le serveur avec la mise en ligne.)
 */
export type Saisie = { indicateurs: Indicateur[]; valeurs: Ligne[] }

const CLE = 'kpi.saisie'
const VIDE: Saisie = { indicateurs: [], valeurs: [] }

function lire(): Saisie {
  try {
    const s = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Saisie | null
    return s ? { indicateurs: s.indicateurs ?? [], valeurs: s.valeurs ?? [] } : VIDE
  } catch {
    return VIDE
  }
}

let etat: Saisie = lire()
synchroniserPerso(etat.indicateurs, 'saisie')
const abonnes = new Set<() => void>()

export function enregistrerSaisie(s: Saisie) {
  const indicateursChanges = s.indicateurs !== etat.indicateurs
  etat = s
  synchroniserPerso(s.indicateurs, 'saisie')
  try {
    localStorage.setItem(CLE, JSON.stringify(s))
  } catch {
    /* stockage indisponible */
  }
  abonnes.forEach((f) => f())
  if (indicateursChanges) relireAvecNouveauxIndicateurs()
}

export function useSaisie() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
}

export const cleLigne = (l: Pick<Ligne, 'type' | 'periode' | 'pays' | 'indicateur'> & { agence?: string }) =>
  [l.type, l.periode, l.pays, l.agence ?? '', l.indicateur].join('|')

/** Chiffres du Sheet + chiffres saisis (la saisie l'emporte) */
export function fusionner(sheet: Ligne[], saisies: Ligne[]): Ligne[] {
  const prises = new Set(saisies.map(cleLigne))
  return [...sheet.filter((l) => !prises.has(cleLigne(l))), ...saisies]
}

export function useLignes() {
  const donnees = useDonnees()
  const saisie = useSaisie()
  const lignes = useMemo(() => fusionner(donnees.lignes, saisie.valeurs), [donnees.lignes, saisie.valeurs])
  return { lignes, donnees, saisie }
}
