import { useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { messageErreur } from '../../lib/erreurs'
import { Modal } from './Modal'
import { Bouton } from './Bouton'

interface ConfirmationModalProps {
  titre: string
  /** Ce qui va se passer, en clair (récapitulatif, conséquences). */
  children: ReactNode
  libelleConfirmer: string
  /** Action irréversible ou destructrice : bouton rouge. */
  danger?: boolean
  /** Bloque la confirmation (ex. motif obligatoire non saisi). */
  confirmationImpossible?: boolean
  /** Libellé du bouton qui renonce (par défaut « Retour »). */
  libelleRetour?: string
  /** Focus sur le bouton qui renonce : Entrée ne déclenche pas l'action par mégarde. */
  focusSurRetour?: boolean
  onConfirmer: () => Promise<void> | void
  onFermer: () => void
}

/**
 * Contre-vérification avant une action : récapitule ce qui va être fait et
 * attend un second clic. L'erreur éventuelle s'affiche dans la fenêtre.
 */
export function ConfirmationModal({
  titre,
  children,
  libelleConfirmer,
  danger = false,
  confirmationImpossible = false,
  libelleRetour = 'Retour',
  focusSurRetour = false,
  onConfirmer,
  onFermer,
}: ConfirmationModalProps) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function confirmer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await onConfirmer()
    } catch (e) {
      setErreur(messageErreur(e))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre={titre} onFermer={envoi ? () => {} : onFermer} sansConfirmationFermeture>
      <div className="flex flex-col gap-3 text-[13px] text-text">
        <div className="flex gap-2.5">
          <AlertTriangle size={18} strokeWidth={1.75} className={`shrink-0 mt-0.5 ${danger ? 'text-danger' : 'text-warn-deep'}`} />
          <div className="flex-1 min-w-0 flex flex-col gap-2">{children}</div>
        </div>
        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Bouton variante="secondaire" taille="sm" onClick={onFermer} disabled={envoi} autoFocus={focusSurRetour}>
            {libelleRetour}
          </Bouton>
          <Bouton
            variante={danger ? 'danger' : 'primaire'}
            taille="sm"
            onClick={confirmer}
            disabled={envoi || confirmationImpossible}
            autoFocus={!focusSurRetour}
          >
            {envoi ? 'Patiente...' : libelleConfirmer}
          </Bouton>
        </div>
      </div>
    </Modal>
  )
}
