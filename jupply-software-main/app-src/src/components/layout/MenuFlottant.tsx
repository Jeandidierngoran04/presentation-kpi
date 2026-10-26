import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface MenuFlottantProps {
  /** Rectangle de l'élément qui a ouvert le menu : le menu s'affiche à sa droite. */
  ancre: DOMRect
  /** Aligne le bas du menu sur le bas de l'ancre (menus du bas de la barre). */
  depuisLeBas?: boolean
  onFermer: () => void
  children: ReactNode
}

/** Petit menu ancré à droite de la barre latérale ; se ferme au clic extérieur ou avec Échap. */
export function MenuFlottant({ ancre, depuisLeBas = false, onFermer, children }: MenuFlottantProps) {
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClic(e: MouseEvent) {
      if (boite.current && !boite.current.contains(e.target as Node)) onFermer()
    }
    function onTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    // Le clic qui a ouvert le menu ne doit pas le refermer aussitôt.
    const minuteur = setTimeout(() => window.addEventListener('mousedown', onClic), 0)
    window.addEventListener('keydown', onTouche)
    return () => {
      clearTimeout(minuteur)
      window.removeEventListener('mousedown', onClic)
      window.removeEventListener('keydown', onTouche)
    }
  }, [onFermer])

  const style = depuisLeBas
    ? { left: ancre.right + 8, bottom: Math.max(8, window.innerHeight - ancre.bottom) }
    : { left: ancre.right + 8, top: Math.min(ancre.top, window.innerHeight - 320) }

  return createPortal(
    <div
      ref={boite}
      role="menu"
      className="fixed z-[60] min-w-[220px] bg-card border border-border rounded-lg shadow-lg py-1.5 text-text"
      style={style}
    >
      {children}
    </div>,
    document.body,
  )
}
