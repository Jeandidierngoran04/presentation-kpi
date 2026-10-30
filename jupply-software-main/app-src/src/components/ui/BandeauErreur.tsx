import { useEffect, useRef, useState } from 'react'

const CLASSE_PAR_DEFAUT = 'text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2'

/**
 * Bandeau d'erreur commun à toute l'application. Il disparaît dès que
 * l'utilisateur corrige (il tape ou choisit quelque chose dans le même écran
 * ou la même fenêtre), et réapparaît si l'action est relancée (bouton
 * principal ou envoi de formulaire) alors que l'erreur est toujours là.
 */
export function BandeauErreur({ message, className = CLASSE_PAR_DEFAUT }: { message: string | null | undefined; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const ancreRef = useRef<HTMLSpanElement>(null)
  const [masque, setMasque] = useState(false)

  // Un nouveau message s'affiche toujours.
  useEffect(() => {
    setMasque(false)
  }, [message])

  useEffect(() => {
    if (!message) return
    // Zone surveillée : la fenêtre (modale) ou l'écran (onglet) qui contient le bandeau.
    const point = ref.current ?? ancreRef.current
    const zone: HTMLElement | Document =
      point?.closest<HTMLElement>('[role="dialog"], .fixed.inset-0') ?? point?.closest<HTMLElement>('main > div') ?? document

    function onSaisie(e: Event) {
      const cible = e.target as HTMLElement | null
      if (cible && /^(INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) setMasque(true)
    }
    // Action relancée : le bandeau revient si l'écran garde l'erreur.
    function onRelance(e: Event) {
      const cible = e.target as HTMLElement | null
      if (e.type === 'submit' || cible?.closest('button[data-valider], button.bg-accent')) setMasque(false)
    }
    zone.addEventListener('input', onSaisie, true)
    zone.addEventListener('change', onSaisie, true)
    zone.addEventListener('submit', onRelance, true)
    zone.addEventListener('click', onRelance, true)
    return () => {
      zone.removeEventListener('input', onSaisie, true)
      zone.removeEventListener('change', onSaisie, true)
      zone.removeEventListener('submit', onRelance, true)
      zone.removeEventListener('click', onRelance, true)
    }
  }, [message])

  if (!message) return null
  // Masqué : on garde un repère invisible pour continuer à surveiller la bonne zone.
  if (masque) return <span ref={ancreRef} hidden />
  return (
    <div ref={ref} role="alert" className={className}>
      {message}
    </div>
  )
}
