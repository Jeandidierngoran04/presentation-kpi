import { createContext, useContext, useState, type ReactNode } from 'react'

interface DemandeSortieManuelle {
  produitId: string | null
  jeton: number
}

interface DemandeAffichageProduit {
  produitId: string
  jeton: number
}

interface SelectionState {
  /** Dernier produit sélectionné (clic simple) dans l'écran Produits. */
  produitSelectionneId: string | null
  definirProduitSelectionne: (id: string | null) => void
  /** Incrémente à chaque clic sur "Sorties Manuelles" dans le ruban, pour que l'onglet Sortie (déjà monté) réagisse même si le produit sélectionné n'a pas changé. */
  demandeSortieManuelle: DemandeSortieManuelle | null
  declencherSortieManuelle: (produitId: string | null) => void
  /** Produit à montrer dans l'écran Produits, demandé depuis un autre écran (ex. Alertes stock). Le jeton permet de redemander le même produit. */
  demandeAffichageProduit: DemandeAffichageProduit | null
  demanderAffichageProduit: (produitId: string) => void
}

const SelectionContext = createContext<SelectionState | undefined>(undefined)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [produitSelectionneId, definirProduitSelectionne] = useState<string | null>(null)
  const [demandeSortieManuelle, setDemandeSortieManuelle] = useState<DemandeSortieManuelle | null>(null)
  const [demandeAffichageProduit, setDemandeAffichageProduit] = useState<DemandeAffichageProduit | null>(null)

  function declencherSortieManuelle(produitId: string | null) {
    setDemandeSortieManuelle((prev) => ({ produitId, jeton: (prev?.jeton ?? 0) + 1 }))
  }

  function demanderAffichageProduit(produitId: string) {
    setDemandeAffichageProduit((prev) => ({ produitId, jeton: (prev?.jeton ?? 0) + 1 }))
  }

  return (
    <SelectionContext.Provider
      value={{
        produitSelectionneId,
        definirProduitSelectionne,
        demandeSortieManuelle,
        declencherSortieManuelle,
        demandeAffichageProduit,
        demanderAffichageProduit,
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection doit etre utilise a l\'interieur de SelectionProvider')
  return ctx
}
