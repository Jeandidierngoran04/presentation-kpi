import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

// Fenêtres ouvertes, de la plus ancienne à la plus récente : seule celle du dessus réagit à Échap.
const pileFenetres: string[] = []

interface ModalProps {
  titre: string
  onFermer: () => void
  children: ReactNode
  /** Grande fenêtre (détail d'un document, tableau) au lieu de la petite fenêtre standard. */
  large?: boolean
  /**
   * Pas de question « Fermer sans enregistrer ? » (fenêtre de confirmation
   * elle-même, ou fenêtre de consultation). Par défaut, dès qu'un champ a été
   * rempli, toute fermeture (croix, clic à côté, Échap, bouton marqué
   * `data-annuler`) demande confirmation.
   */
  sansConfirmationFermeture?: boolean
}

export function Modal({ titre, onFermer, children, large = false, sansConfirmationFermeture = false }: ModalProps) {
  // Un champ de la fenêtre a été modifié : fermer ferait perdre la saisie.
  const modifieRef = useRef(false)
  const [confirmationOuverte, setConfirmationOuverte] = useState(false)

  function demanderFermeture() {
    if (!sansConfirmationFermeture && modifieRef.current) setConfirmationOuverte(true)
    else onFermer()
  }

  const id = useId()
  useEffect(() => {
    pileFenetres.push(id)
    return () => {
      pileFenetres.splice(pileFenetres.indexOf(id), 1)
    }
  }, [id])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || pileFenetres[pileFenetres.length - 1] !== id) return
      if (confirmationOuverte) setConfirmationOuverte(false)
      else demanderFermeture()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Les boutons « Annuler » des fenêtres portent data-annuler : ils passent par la même confirmation.
  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    const bouton = (e.target as HTMLElement).closest('[data-annuler]')
    if (!bouton || sansConfirmationFermeture || !modifieRef.current) return
    e.preventDefault()
    e.stopPropagation()
    setConfirmationOuverte(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={demanderFermeture}>
      <div
        className={`relative w-full bg-card rounded-xl border border-border text-text ${
          large ? 'max-w-[1100px] max-h-[88vh] flex flex-col p-5' : 'max-w-sm p-5'
        }`}
        onClick={(e) => e.stopPropagation()}
        onClickCapture={onClickCapture}
        onInputCapture={() => {
          modifieRef.current = true
        }}
        onChangeCapture={() => {
          modifieRef.current = true
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text">{titre}</h2>
          <button
            onClick={demanderFermeture}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-text-muted"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
        {children}

        {confirmationOuverte && (
          <div
            role="alertdialog"
            aria-label="Fermer sans enregistrer ?"
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/85 backdrop-blur-[2px] p-5"
          >
            <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col gap-3">
              <div className="flex gap-2.5 text-[13px]">
                <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 mt-0.5 text-danger" />
                <div>
                  <p className="font-semibold">Fermer sans enregistrer ?</p>
                  <p className="text-text-muted mt-0.5">Ce que tu as saisi dans cette fenêtre sera perdu.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmationOuverte(false)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted text-text"
                >
                  Continuer la saisie
                </button>
                <button
                  type="button"
                  onClick={onFermer}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-danger-soft text-danger hover:bg-danger hover:text-white"
                >
                  Fermer sans enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
