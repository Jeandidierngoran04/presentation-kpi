import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { MODULE_PAR_ECRAN } from '../lib/modules'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { useEtatPersistant } from '../lib/etatPersistant'

export type EcranId =
  | 'dashboard'
  | 'produits'
  | 'entrepots'
  | 'entrees'
  | 'sorties'
  | 'reintegration'
  | 'transferts'
  | 'mouvements'
  | 'inventaires'
  | 'alertes'
  | 'nouvelle-reception'
  | 'nouvelle-sortie'
  | 'historique-sorties'
  | 'historique-entrees'
  | 'historique-reintegrations'
  | 'historique-transferts'
  | 'historique-non-conformites'
  | 'quarantaine'
  | 'commandes-fournisseurs'
  | 'nouvelle-commande'
  | 'historique-commandes'
  | 'fiche-stock'
  | 'entree'
  | 'modifier-entree'
  | 'administration'

export interface Onglet {
  id: EcranId
  titre: string
}

interface TabsState {
  onglets: Onglet[]
  /** Null quand aucun onglet n'est ouvert (écran d'accueil). */
  ongletActifId: EcranId | null
  /** Groupe de la barre latérale auquel appartient l'onglet actif. */
  moduleActifId: string | null
  /** Ouvre un écran ; s'il est déjà ouvert, son onglet passe simplement au premier plan. */
  ouvrirOnglet: (ecran: EcranId, titre: string) => void
  /** Ferme immédiatement (après un enregistrement, par exemple). */
  fermerOnglet: (id: EcranId) => void
  /** Fermeture demandée par l'utilisateur : confirmation si une saisie n'est pas enregistrée. */
  demanderFermeture: (id: EcranId) => void
  /** Une feuille de saisie signale qu'elle contient (ou plus) des données non enregistrées. */
  signalerSaisie: (id: EcranId, enCours: boolean) => void
  /** Onglets dont la saisie n'est pas enregistrée (pour prévenir avant une déconnexion). */
  saisiesEnCours: EcranId[]
  activerOnglet: (id: EcranId) => void
  /** Déplace un onglet à la place d'un autre (glisser-déposer). */
  deplacerOnglet: (id: EcranId, versId: EcranId) => void
}

const TabsContext = createContext<TabsState | undefined>(undefined)

const groupeDe = (ecran: EcranId | null) => (ecran ? (MODULE_PAR_ECRAN[ecran] ?? null) : null)

export function TabsProvider({ children }: { children: ReactNode }) {
  // Aucun écran n'est ouvert d'office : on choisit dans la barre latérale.
  // Après une actualisation de la page, on retrouve les onglets et celui qui était actif.
  const [onglets, setOnglets] = useEtatPersistant<Onglet[]>('onglets', [])
  const [ongletActifId, setOngletActifId] = useEtatPersistant<EcranId | null>('onglet-actif', null)

  function ouvrirOnglet(ecran: EcranId, titre: string) {
    setOnglets((prev) =>
      prev.some((o) => o.id === ecran) ? prev.map((o) => (o.id === ecran ? { ...o, titre } : o)) : [...prev, { id: ecran, titre }],
    )
    setOngletActifId(ecran)
  }

  // Onglets dont la saisie n'est pas enregistrée, et fermeture en attente de confirmation.
  const [saisiesEnCours, setSaisiesEnCours] = useState<EcranId[]>([])
  const [fermetureAConfirmer, setFermetureAConfirmer] = useState<EcranId | null>(null)

  const signalerSaisie = useCallback((id: EcranId, enCours: boolean) => {
    setSaisiesEnCours((prev) => (enCours ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)))
  }, [])

  // Fermeture ou rechargement du navigateur avec une saisie en cours : avertissement du navigateur.
  useEffect(() => {
    if (saisiesEnCours.length === 0) return
    function avantDeQuitter(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', avantDeQuitter)
    return () => window.removeEventListener('beforeunload', avantDeQuitter)
  }, [saisiesEnCours])

  function demanderFermeture(id: EcranId) {
    if (saisiesEnCours.includes(id)) setFermetureAConfirmer(id)
    else fermerOnglet(id)
  }

  function fermerOnglet(id: EcranId) {
    signalerSaisie(id, false)
    setOnglets((prev) => {
      const index = prev.findIndex((o) => o.id === id)
      const suivant = prev.filter((o) => o.id !== id)
      // L'onglet voisin prend le relais (celui de gauche, sinon celui de droite).
      setOngletActifId((actif) => (actif !== id ? actif : (suivant[Math.max(0, index - 1)]?.id ?? null)))
      return suivant
    })
  }

  function deplacerOnglet(id: EcranId, versId: EcranId) {
    if (id === versId) return
    setOnglets((prev) => {
      const depart = prev.findIndex((o) => o.id === id)
      const arrivee = prev.findIndex((o) => o.id === versId)
      if (depart < 0 || arrivee < 0) return prev
      const copie = [...prev]
      const [onglet] = copie.splice(depart, 1)
      copie.splice(arrivee, 0, onglet)
      return copie
    })
  }

  return (
    <TabsContext.Provider
      value={{
        onglets,
        ongletActifId,
        moduleActifId: groupeDe(ongletActifId),
        ouvrirOnglet,
        fermerOnglet,
        demanderFermeture,
        signalerSaisie,
        saisiesEnCours,
        activerOnglet: setOngletActifId,
        deplacerOnglet,
      }}
    >
      {children}
      {fermetureAConfirmer && (
        <ConfirmationModal
          titre="Saisie non enregistrée"
          libelleConfirmer="Fermer sans enregistrer"
          libelleRetour="Continuer la saisie"
          danger
          focusSurRetour
          onConfirmer={() => {
            fermerOnglet(fermetureAConfirmer)
            setFermetureAConfirmer(null)
          }}
          onFermer={() => setFermetureAConfirmer(null)}
        >
          <p>
            L'onglet « {onglets.find((o) => o.id === fermetureAConfirmer)?.titre} » contient des données qui ne sont pas
            enregistrées. Si tu le fermes, elles seront perdues.
          </p>
        </ConfirmationModal>
      )}
    </TabsContext.Provider>
  )
}

/** À appeler dans une feuille de saisie : protège l'onglet tant que `enCours` est vrai. */
export function useSaisieEnCours(id: EcranId, enCours: boolean) {
  const { signalerSaisie } = useTabs()
  useEffect(() => {
    signalerSaisie(id, enCours)
  }, [id, enCours, signalerSaisie])
  useEffect(() => () => signalerSaisie(id, false), [id, signalerSaisie])
}

export function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs doit etre utilise a l\'interieur de TabsProvider')
  return ctx
}
