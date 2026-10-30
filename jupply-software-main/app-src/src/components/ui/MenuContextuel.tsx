import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent } from 'react'

export interface ElementMenuContextuel {
  label: string
  onClick: () => void
  dangereux?: boolean
  /** Icône facultative, affichée à gauche du libellé. */
  icone?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface EtatMenu {
  x: number
  y: number
  elements: ElementMenuContextuel[]
  /** Ouvert depuis un bouton : le menu s'aligne sous le bouton, bord droit contre bord droit. */
  sousBouton?: boolean
}

const MARGE_ECRAN = 8

/**
 * Menu clic-droit générique. `ouvrir` s'utilise sur un onContextMenu (ou sur
 * le clic d'un bouton, avec `{ sousBouton: true }`), `menu` se rend une fois
 * dans l'arbre. Le menu reste toujours entièrement visible dans l'écran.
 */
export function useMenuContextuel() {
  const [etat, setEtat] = useState<EtatMenu | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  function ouvrir(e: MouseEvent, elements: ElementMenuContextuel[], options?: { sousBouton?: boolean }) {
    e.preventDefault()
    e.stopPropagation()
    if (options?.sousBouton) {
      const rect = e.currentTarget.getBoundingClientRect()
      setEtat({ x: rect.right, y: rect.bottom + 4, elements, sousBouton: true })
    } else {
      setEtat({ x: e.clientX, y: e.clientY, elements })
    }
    setPosition(null)
  }

  function fermer() {
    setEtat(null)
  }

  // Une fois le menu mesuré : alignement sous le bouton, puis recadrage dans l'écran.
  useLayoutEffect(() => {
    if (!etat || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    let left = etat.sousBouton ? etat.x - width : etat.x
    let top = etat.y
    left = Math.max(MARGE_ECRAN, Math.min(left, window.innerWidth - width - MARGE_ECRAN))
    if (top + height > window.innerHeight - MARGE_ECRAN) top = Math.max(MARGE_ECRAN, etat.y - height - (etat.sousBouton ? 40 : 0))
    setPosition({ top, left })
  }, [etat])

  useEffect(() => {
    if (!etat) return
    window.addEventListener('click', fermer)
    window.addEventListener('scroll', fermer, true)
    return () => {
      window.removeEventListener('click', fermer)
      window.removeEventListener('scroll', fermer, true)
    }
  }, [etat])

  const menu = etat ? (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 bg-card rounded-lg border border-border shadow-lg py-1.5 min-w-[200px] text-text"
      // Avant la mesure, le menu est placé mais invisible (pas de saut à l'écran).
      style={position ? { top: position.top, left: position.left } : { top: etat.y, left: etat.x, visibility: 'hidden' }}
    >
      {etat.elements.map((el, i) => {
        const Icone = el.icone
        return (
          <button
            key={i}
            role="menuitem"
            onClick={() => {
              el.onClick()
              fermer()
            }}
            className={`w-full flex items-center gap-2.5 text-left text-[13px] px-3.5 h-9 whitespace-nowrap hover:bg-muted ${el.dangereux ? 'text-danger' : 'text-text'}`}
          >
            {Icone && <Icone size={15} strokeWidth={1.75} className="shrink-0 text-text-muted" />}
            {el.label}
          </button>
        )
      })}
    </div>
  ) : null

  return { ouvrir, menu }
}
