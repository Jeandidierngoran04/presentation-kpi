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

export interface Onglet {
  id: EcranId
  titre: string
}

const ONGLET_DASHBOARD: Onglet = { id: 'dashboard', titre: 'Dashboard' }
const MODULE_DEFAUT = 'magasin'

interface TabsState {
  onglets: Onglet[]
  ongletActifId: EcranId
  /** Module metier affiche au Level 1 / Level 2 (peut differer du module de l'onglet actif si on vient de cliquer une pilule). */
  moduleActifId: string
  definirModuleActif: (id: string) => void
  ouvrirOnglet: (ecran: EcranId, titre: string) => void
  fermerOnglet: (id: EcranId) => void
  activerOnglet: (id: EcranId) => void
}

const TabsContext = createContext<TabsState | undefined>(undefined)

export function TabsProvider({ children }: { children: ReactNode }) {
  const [onglets, setOnglets] = useState<Onglet[]>([ONGLET_DASHBOARD])
  const [ongletActifId, setOngletActifId] = useState<EcranId>(ONGLET_DASHBOARD.id)
  const [moduleActifId, setModuleActifId] = useState<string>(MODULE_DEFAUT)

  function ouvrirOnglet(ecran: EcranId, titre: string) {
    setOnglets((prev) => {
      if (prev.some((o) => o.id === ecran)) return prev
      return [...prev, { id: ecran, titre }]
    })
    setOngletActifId(ecran)
    setModuleActifId(MODULE_PAR_ECRAN[ecran] ?? MODULE_DEFAUT)
  }

  function fermerOnglet(id: EcranId) {
    if (id === ONGLET_DASHBOARD.id) return
    setOnglets((prev) => {
      const suivant = prev.filter((o) => o.id !== id)
      setOngletActifId((actif) => {
        if (actif !== id) return actif
        const prochain = suivant[suivant.length - 1]?.id ?? ONGLET_DASHBOARD.id
        setModuleActifId(MODULE_PAR_ECRAN[prochain] ?? MODULE_DEFAUT)
        return prochain
      })
      return suivant
    })
  }

  function activerOnglet(id: EcranId) {
    setOngletActifId(id)
    setModuleActifId(MODULE_PAR_ECRAN[id] ?? MODULE_DEFAUT)
  }

  return (
    <TabsContext.Provider
      value={{
        onglets,
        ongletActifId,
        moduleActifId,
        definirModuleActif: setModuleActifId,
        ouvrirOnglet,
        fermerOnglet,
        activerOnglet,
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
