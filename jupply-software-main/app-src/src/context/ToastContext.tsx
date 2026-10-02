import { createContext, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

type TonToast = 'succes' | 'erreur'

interface Toast {
  id: number
  message: string
  ton: TonToast
}

interface ToastState {
  /** Affiche une bulle de notification en bas à droite, refermée automatiquement. */
  afficherToast: (message: string, ton?: TonToast) => void
}

const ToastContext = createContext<ToastState | undefined>(undefined)

const DUREE_AFFICHAGE_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function fermer(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function afficherToast(message: string, ton: TonToast = 'succes') {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, ton }])
    setTimeout(() => fermer(id), DUREE_AFFICHAGE_MS)
  }

  return (
    <ToastContext.Provider value={{ afficherToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icone = t.ton === 'succes' ? CheckCircle2 : AlertTriangle
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-center gap-2.5 min-w-[280px] max-w-[420px] rounded-xl border px-4 py-3 shadow-lg text-[13px] font-semibold ${
                t.ton === 'succes'
                  ? 'bg-accent-soft border-accent text-accent-deep'
                  : 'bg-danger-soft border-danger text-danger-deep'
              }`}
            >
              <Icone size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => fermer(t.id)} className="shrink-0 opacity-70 hover:opacity-100" title="Fermer">
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit etre utilise a l\'interieur de ToastProvider')
  return ctx
}
