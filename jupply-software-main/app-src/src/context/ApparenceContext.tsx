import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { chargerPolice, cssApparence, enregistrerApparence, getApparence, type Apparence } from '../lib/apparence'

interface Enregistree {
  nom: string
  apparence: Apparence
}

interface ApparenceState {
  /** Apparence affichée : l'aperçu en cours d'édition s'il y en a un, sinon celle enregistrée. */
  apparence: Apparence
  nom: string
  /** Apparence et nom tels qu'enregistrés en base. */
  enregistree: Enregistree
  /** L'apparence enregistrée a été lue (avant : charte par défaut, rien à éditer). */
  chargee: boolean
  /** Aperçu en direct pendant l'édition (null = revenir à l'enregistrée). */
  definirApercu: (apercu: Enregistree | null) => void
  enregistrer: (nom: string, apparence: Apparence) => Promise<void>
  /** Panneau Administration (à droite de l'écran). */
  panneauOuvert: boolean
  ouvrirPanneau: () => void
  fermerPanneau: () => void
}

const ApparenceContext = createContext<ApparenceState | undefined>(undefined)

const ID_STYLE = 'jupply-apparence'

/** Charge l'apparence de l'entreprise et l'applique à toute l'application. */
export function ApparenceProvider({ children }: { children: ReactNode }) {
  const { profil } = useAuth()
  const [enregistree, setEnregistree] = useState<Enregistree>({ nom: '', apparence: {} })
  const [chargee, setChargee] = useState(false)
  const [apercu, setApercu] = useState<Enregistree | null>(null)
  const [panneauOuvert, setPanneauOuvert] = useState(false)

  useEffect(() => {
    if (!profil) return
    getApparence()
      .then(setEnregistree)
      .catch(() => {
        // Apparence illisible : la charte Jupply s'applique, rien ne bloque.
      })
      .finally(() => setChargee(true))
  }, [profil])

  const affichee = apercu ?? enregistree

  // Feuille de style injectée (et retirée à la déconnexion).
  useEffect(() => {
    let style = document.getElementById(ID_STYLE) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = ID_STYLE
      document.head.appendChild(style)
    }
    style.textContent = cssApparence(affichee.apparence)
    chargerPolice(affichee.apparence.textePolice)
    chargerPolice(affichee.apparence.titrePolice)
  }, [affichee.apparence])

  useEffect(() => () => document.getElementById(ID_STYLE)?.remove(), [])

  const definirApercu = useCallback((a: Enregistree | null) => setApercu(a), [])
  const ouvrirPanneau = useCallback(() => setPanneauOuvert(true), [])
  const fermerPanneau = useCallback(() => {
    setPanneauOuvert(false)
    setApercu(null)
  }, [])

  async function enregistrer(nom: string, apparence: Apparence) {
    await enregistrerApparence(nom, apparence)
    setEnregistree({ nom: nom.trim() || enregistree.nom, apparence })
    setApercu(null)
  }

  return (
    <ApparenceContext.Provider
      value={{
        apparence: affichee.apparence,
        nom: affichee.nom,
        enregistree,
        chargee,
        definirApercu,
        enregistrer,
        panneauOuvert,
        ouvrirPanneau,
        fermerPanneau,
      }}
    >
      {children}
    </ApparenceContext.Provider>
  )
}

export function useApparence() {
  const ctx = useContext(ApparenceContext)
  if (!ctx) throw new Error("useApparence doit etre utilise a l'interieur de ApparenceProvider")
  return ctx
}
