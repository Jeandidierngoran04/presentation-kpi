import { useCallback, useEffect, useState } from 'react'
import { ciblesParDefaut } from './catalogue'
import type { Cibles, Presentation } from './types'

/** Maquette : enregistrement dans le navigateur. Sera remplacé par Supabase (lot 3). */
function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle)
    return brut ? (JSON.parse(brut) as T) : defaut
  } catch {
    return defaut
  }
}
function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event('stockage:' + cle))
}

function useStocke<T>(cle: string, defaut: () => T) {
  const [val, setVal] = useState<T>(() => lire(cle, defaut()))
  useEffect(() => {
    const maj = () => setVal(lire(cle, defaut()))
    window.addEventListener('stockage:' + cle, maj)
    return () => window.removeEventListener('stockage:' + cle, maj)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])
  const definir = useCallback((v: T) => ecrire(cle, v), [cle])
  return [val, definir] as const
}

export function useCibles() {
  const [c, set] = useStocke<Cibles>('kpi.cibles', ciblesParDefaut)
  const tout = { ...ciblesParDefaut(), ...c }
  // Mise à jour : l'objectif des affaires non assemblées est 0 (ancienne valeur par défaut : 5 / 10)
  const ana = tout['prod.non_assemblees']
  if (ana && ana.cible === 5 && ana.alerte === 10) tout['prod.non_assemblees'] = { ...ana, cible: 0, alerte: 1 }
  return [tout, set] as const
}

export function usePresentations() {
  const [liste, set] = useStocke<Presentation[]>('kpi.presentations', () => [])
  const enregistrer = (p: Presentation) => {
    const autres = lire<Presentation[]>('kpi.presentations', []).filter((x) => x.id !== p.id)
    set([p, ...autres])
  }
  const supprimer = (id: string) => set(lire<Presentation[]>('kpi.presentations', []).filter((x) => x.id !== id))
  return { liste, enregistrer, supprimer }
}
