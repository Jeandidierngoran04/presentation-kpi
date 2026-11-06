import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

// État gardé dans la session du navigateur : il survit à une actualisation de
// la page (F5) mais pas à la fermeture de l'onglet du navigateur. Effacé à la
// déconnexion (voir effacerEtatsPersistants).
const PREFIXE = 'jupply:'

function lire<T>(cle: string, initial: T): T {
  try {
    const brut = window.sessionStorage.getItem(PREFIXE + cle)
    return brut == null ? initial : (JSON.parse(brut, reviver) as T)
  } catch {
    return initial
  }
}

// Les Set et Map ne passent pas tels quels en JSON : on les marque.
function replacer(_cle: string, valeur: unknown) {
  if (valeur instanceof Set) return { __set: [...valeur] }
  if (valeur instanceof Map) return { __map: [...valeur] }
  return valeur
}

function reviver(_cle: string, valeur: unknown) {
  if (valeur && typeof valeur === 'object') {
    if ('__set' in valeur) return new Set((valeur as { __set: unknown[] }).__set)
    if ('__map' in valeur) return new Map((valeur as { __map: [unknown, unknown][] }).__map)
  }
  return valeur
}

/** Comme useState, mais la valeur est retrouvée après une actualisation de la page. */
export function useEtatPersistant<T>(cle: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [valeur, setValeur] = useState<T>(() => lire(cle, typeof initial === 'function' ? (initial as () => T)() : initial))
  useEffect(() => {
    try {
      window.sessionStorage.setItem(PREFIXE + cle, JSON.stringify(valeur, replacer))
    } catch {
      // Stockage indisponible (navigation privée, quota) : l'écran marche quand même, sans reprise.
    }
  }, [cle, valeur])
  return [valeur, setValeur]
}

/** Efface tous les états gardés (déconnexion, ou saisie validée avec `prefixe`). */
export function effacerEtatsPersistants(prefixe = '') {
  try {
    for (const cle of Object.keys(window.sessionStorage)) {
      if (cle.startsWith(PREFIXE + prefixe)) window.sessionStorage.removeItem(cle)
    }
  } catch {
    // rien à faire
  }
}
