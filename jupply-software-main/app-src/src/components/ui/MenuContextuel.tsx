import { useEffect, useState, type MouseEvent } from 'react'

export interface ElementMenuContextuel {
  label: string
  onClick: () => void
  dangereux?: boolean
}

interface EtatMenu {
  x: number
  y: number
  elements: ElementMenuContextuel[]
}

/** Menu clic-droit générique. `ouvrir` s'utilise sur un onContextMenu, `menu` se rend une fois dans l'arbre. */
export function useMenuContextuel() {
  const [etat, setEtat] = useState<EtatMenu | null>(null)

  function ouvrir(e: MouseEvent, elements: ElementMenuContextuel[]) {
    e.preventDefault()
    e.stopPropagation()
    setEtat({ x: e.clientX, y: e.clientY, elements })
  }

  function fermer() {
    setEtat(null)
  }

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
      className="fixed z-50 bg-card rounded-lg border border-border shadow-lg py-1.5 min-w-[190px] text-text"
      style={{ top: etat.y, left: etat.x }}
    >
      {etat.elements.map((el, i) => (
        <button
          key={i}
          onClick={() => {
            el.onClick()
            fermer()
          }}
          className={`w-full text-left text-xs px-3 py-2 hover:bg-muted ${el.dangereux ? 'text-danger' : 'text-text'}`}
        >
          {el.label}
        </button>
      ))}
    </div>
  ) : null

  return { ouvrir, menu }
}
