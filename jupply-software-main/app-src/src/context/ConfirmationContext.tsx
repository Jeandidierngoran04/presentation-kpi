// Demande de confirmation avant une action importante (valider une sortie,
// expédier un transfert, se déconnecter...). Utilisable partout :
//   if (!(await confirmer({ titre, message, libelleConfirmer }))) return
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'

export interface OptionsConfirmation {
  titre: string
  /** Ce qui va se passer, en clair. */
  message: ReactNode
  libelleConfirmer: string
  libelleRetour?: string
  /** Action destructrice ou irréversible : bouton rouge, focus sur « Retour ». */
  danger?: boolean
}

interface ConfirmationState {
  /** Ouvre la fenêtre de confirmation ; vrai si l'utilisateur confirme. */
  confirmer: (options: OptionsConfirmation) => Promise<boolean>
}

const ConfirmationContext = createContext<ConfirmationState | undefined>(undefined)

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [demande, setDemande] = useState<OptionsConfirmation | null>(null)
  const reponseRef = useRef<((ok: boolean) => void) | null>(null)

  const confirmer = useCallback((options: OptionsConfirmation) => {
    // Une demande déjà ouverte est considérée comme refusée.
    reponseRef.current?.(false)
    setDemande(options)
    return new Promise<boolean>((resoudre) => {
      reponseRef.current = resoudre
    })
  }, [])

  function repondre(ok: boolean) {
    reponseRef.current?.(ok)
    reponseRef.current = null
    setDemande(null)
  }

  return (
    <ConfirmationContext.Provider value={{ confirmer }}>
      {children}
      {demande && (
        <ConfirmationModal
          titre={demande.titre}
          libelleConfirmer={demande.libelleConfirmer}
          libelleRetour={demande.libelleRetour}
          danger={demande.danger}
          focusSurRetour={demande.danger}
          onConfirmer={() => repondre(true)}
          onFermer={() => repondre(false)}
        >
          {typeof demande.message === 'string' ? <p>{demande.message}</p> : demande.message}
        </ConfirmationModal>
      )}
    </ConfirmationContext.Provider>
  )
}

export function useConfirmation() {
  const ctx = useContext(ConfirmationContext)
  if (!ctx) throw new Error('useConfirmation doit etre utilise a l\'interieur de ConfirmationProvider')
  return ctx
}
