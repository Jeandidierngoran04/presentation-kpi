import { createContext, useContext, useState, type ReactNode } from 'react'
import { useEtatPersistant } from '../lib/etatPersistant'

interface DemandeSortieManuelle {
  produitId: string | null
  jeton: number
}

interface DemandeAffichageProduit {
  produitId: string
  jeton: number
}

/** Sortie qui vient d'être validée, annoncée à la liste des sorties. */
export interface SortieValidee {
  id: string
  numero: string
  nbLignes: number
  quantite: number
  recuPar: string | null
  jeton: number
}

interface SelectionState {
  /** Dernier produit sélectionné (clic simple) dans l'écran Produits. */
  produitSelectionneId: string | null
  definirProduitSelectionne: (id: string | null) => void
  /** Produit à préparer dans "Nouvelle sortie", demandé depuis Produits. Le jeton permet de redemander le même produit. */
  demandeSortieManuelle: DemandeSortieManuelle | null
  declencherSortieManuelle: (produitId: string | null) => void
  /** Une fois la demande traitée, pour ne pas la rejouer à la prochaine ouverture de "Nouvelle sortie". */
  effacerDemandeSortie: () => void
  /** Produit à montrer dans l'écran Produits, demandé depuis un autre écran (ex. Alertes stock). Le jeton permet de redemander le même produit. */
  demandeAffichageProduit: DemandeAffichageProduit | null
  demanderAffichageProduit: (produitId: string) => void
  /** Produit à afficher dans l'onglet « Fiche de stock » (bouton « Avancé » de la fenêtre Info). */
  demandeFicheStock: DemandeAffichageProduit | null
  demanderFicheStock: (produitId: string) => void
  /** Entrée à afficher dans l'onglet « Entrée » (clic sur son numéro dans la liste). */
  entreeAfficheeId: string | null
  afficherEntree: (receptionId: string) => void
  /** Entrée en attente à modifier dans l'onglet « Modifier » (bouton Modifier de la page de l'entrée). */
  demandeModificationEntree: { receptionId: string; jeton: number } | null
  demanderModificationEntree: (receptionId: string) => void
  /** Dernière sortie validée : la liste des sorties la met en avant et propose d'imprimer le bon. */
  derniereSortie: SortieValidee | null
  signalerSortie: (sortie: Omit<SortieValidee, 'jeton'>) => void
}

const SelectionContext = createContext<SelectionState | undefined>(undefined)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [produitSelectionneId, definirProduitSelectionne] = useState<string | null>(null)
  const [demandeSortieManuelle, setDemandeSortieManuelle] = useState<DemandeSortieManuelle | null>(null)
  const [demandeAffichageProduit, setDemandeAffichageProduit] = useState<DemandeAffichageProduit | null>(null)
  const [demandeFicheStock, setDemandeFicheStock] = useState<DemandeAffichageProduit | null>(null)

  function demanderFicheStock(produitId: string) {
    setDemandeFicheStock((prev) => ({ produitId, jeton: (prev?.jeton ?? 0) + 1 }))
  }
  const [derniereSortie, setDerniereSortie] = useState<SortieValidee | null>(null)
  // Gardé à l'actualisation : l'onglet « Entrée » retrouve son document.
  const [entreeAfficheeId, afficherEntree] = useEtatPersistant<string | null>('entree-affichee', null)
  const [demandeModificationEntree, setDemandeModificationEntree] = useState<{ receptionId: string; jeton: number } | null>(null)

  function demanderModificationEntree(receptionId: string) {
    setDemandeModificationEntree((prev) => ({ receptionId, jeton: (prev?.jeton ?? 0) + 1 }))
  }

  function declencherSortieManuelle(produitId: string | null) {
    setDemandeSortieManuelle((prev) => ({ produitId, jeton: (prev?.jeton ?? 0) + 1 }))
  }

  function effacerDemandeSortie() {
    setDemandeSortieManuelle(null)
  }

  function demanderAffichageProduit(produitId: string) {
    setDemandeAffichageProduit((prev) => ({ produitId, jeton: (prev?.jeton ?? 0) + 1 }))
  }

  function signalerSortie(sortie: Omit<SortieValidee, 'jeton'>) {
    setDerniereSortie((prev) => ({ ...sortie, jeton: (prev?.jeton ?? 0) + 1 }))
  }

  return (
    <SelectionContext.Provider
      value={{
        produitSelectionneId,
        definirProduitSelectionne,
        demandeSortieManuelle,
        declencherSortieManuelle,
        effacerDemandeSortie,
        demandeAffichageProduit,
        demanderAffichageProduit,
        demandeFicheStock,
        demanderFicheStock,
        derniereSortie,
        signalerSortie,
        entreeAfficheeId,
        afficherEntree,
        demandeModificationEntree,
        demanderModificationEntree,
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
