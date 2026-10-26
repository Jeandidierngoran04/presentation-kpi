import { createContext, useContext, useState, type ReactNode } from 'react'
import { MODULE_PAR_ECRAN } from '../lib/modules'

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
  fermerOnglet: (id: EcranId) => void
  activerOnglet: (id: EcranId) => void
  /** Déplace un onglet à la place d'un autre (glisser-déposer). */
  deplacerOnglet: (id: EcranId, versId: EcranId) => void
}

const TabsContext = createContext<TabsState | undefined>(undefined)

const groupeDe = (ecran: EcranId | null) => (ecran ? (MODULE_PAR_ECRAN[ecran] ?? null) : null)

export function TabsProvider({ children }: { children: ReactNode }) {
  // Aucun écran n'est ouvert d'office : on choisit dans la barre latérale.
  const [onglets, setOnglets] = useState<Onglet[]>([])
  const [ongletActifId, setOngletActifId] = useState<EcranId | null>(null)

  function ouvrirOnglet(ecran: EcranId, titre: string) {
    setOnglets((prev) => (prev.some((o) => o.id === ecran) ? prev : [...prev, { id: ecran, titre }]))
    setOngletActifId(ecran)
  }

  function fermerOnglet(id: EcranId) {
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
        activerOnglet: setOngletActifId,
        deplacerOnglet,
      }}
    >
      {children}
    </TabsContext.Provider>
  )
}

export function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs doit etre utilise a l\'interieur de TabsProvider')
  return ctx
}
