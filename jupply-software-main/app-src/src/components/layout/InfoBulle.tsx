import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface InfoBulleProps {
  texte: string
  /** Affichée seulement quand c'est utile (ex. barre réduite, libellé masqué). */
  actif: boolean
  children: ReactNode
}

/**
 * Info-bulle à droite de l'élément survolé. Rendue en dehors de la barre
 * latérale (portail) pour ne pas être coupée par son défilement interne.
 */
export function InfoBulle({ texte, actif, children }: InfoBulleProps) {
  const ancre = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!actif) setPosition(null)
  }, [actif])

  function montrer() {
    if (!actif || !ancre.current) return
    const r = ancre.current.getBoundingClientRect()
    setPosition({ x: r.right + 10, y: r.top + r.height / 2 })
  }

  return (
    <span
      ref={ancre}
      className="block"
      onMouseEnter={montrer}
      onMouseLeave={() => setPosition(null)}
      onFocus={montrer}
      onBlur={() => setPosition(null)}
    >
      {children}
      {position &&
        createPortal(
          <span
            role="tooltip"
            className="fixed z-[70] -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-md bg-text text-card text-xs font-medium px-2 py-1 shadow-lg"
            style={{ left: position.x, top: position.y }}
          >
            {texte}
          </span>,
          document.body,
        )}
    </span>
  )
}
