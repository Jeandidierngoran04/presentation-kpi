import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  titre: string
  onFermer: () => void
  children: ReactNode
  /** Grande fenêtre (détail d'un document, tableau) au lieu de la petite fenêtre standard. */
  large?: boolean
}

export function Modal({ titre, onFermer, children, large = false }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onFermer])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onFermer}>
      <div
        className={`w-full bg-card rounded-xl border border-border text-text ${
          large ? 'max-w-[1100px] max-h-[88vh] flex flex-col p-5' : 'max-w-sm p-5'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text">{titre}</h2>
          <button
            onClick={onFermer}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-text-muted"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
