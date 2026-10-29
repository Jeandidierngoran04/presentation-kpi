import type { ReactElement } from 'react'
import { TabsProvider, useTabs, type EcranId } from '../../context/TabsContext'
import { SelectionProvider } from '../../context/SelectionContext'
import { BarreLaterale } from './BarreLaterale'
import { BarreOnglets } from './BarreOnglets'
import { Dashboard } from '../../pages/Dashboard'
import { Produits } from '../../pages/Produits'
import { Entrepots } from '../../pages/Entrepots'
import { Receptions } from '../../pages/Receptions'
import { Sorties } from '../../pages/Sorties'
import { Reintegration } from '../../pages/Reintegration'
import { Transferts } from '../../pages/Transferts'
import { AlertesStock } from '../../pages/AlertesStock'
import { NouvelleReception } from '../../pages/NouvelleReception'
import { NouvelleSortie } from '../../pages/NouvelleSortie'
import {
  HistoriqueCommandes,
  HistoriqueEntrees,
  HistoriqueMouvements,
  HistoriqueNonConformites,
  HistoriqueReintegrations,
  HistoriqueSorties,
  HistoriqueTransferts,
} from '../../pages/Historique'
import { ToastProvider } from '../../context/ToastContext'
import { ConfirmationProvider } from '../../context/ConfirmationContext'
import { Quarantaine } from '../../pages/Quarantaine'
import { ComingSoon } from '../../pages/ComingSoon'
import { CommandesFournisseurs } from '../../pages/CommandesFournisseurs'
import { NouvelleCommande } from '../../pages/NouvelleCommande'
import { FicheStock } from '../../pages/FicheStock'
import { DetailEntree } from '../../pages/DetailEntree'

const COMPOSANTS = {
  dashboard: Dashboard,
  produits: Produits,
  entrepots: Entrepots,
  entrees: Receptions,
  sorties: Sorties,
  reintegration: Reintegration,
  transferts: Transferts,
  mouvements: HistoriqueMouvements,
  inventaires: () => <ComingSoon titre="Inventaires" />,
  alertes: AlertesStock,
  'nouvelle-reception': NouvelleReception,
  'nouvelle-sortie': NouvelleSortie,
  'historique-sorties': HistoriqueSorties,
  'historique-entrees': HistoriqueEntrees,
  'historique-reintegrations': HistoriqueReintegrations,
  'historique-transferts': HistoriqueTransferts,
  'historique-non-conformites': HistoriqueNonConformites,
  quarantaine: Quarantaine,
  'commandes-fournisseurs': CommandesFournisseurs,
  'nouvelle-commande': NouvelleCommande,
  'historique-commandes': HistoriqueCommandes,
  'fiche-stock': FicheStock,
  entree: DetailEntree,
  // Même feuille que la saisie, pré-remplie avec une entrée en attente.
  'modifier-entree': () => <NouvelleReception modification />,
} satisfies Record<EcranId, () => ReactElement>

/** Raccourcis proposés quand aucun écran n'est ouvert. */
const RACCOURCIS: { ecran: EcranId; titre: string; aide: string }[] = [
  { ecran: 'dashboard', titre: 'Tableau de bord', aide: 'Indicateurs et activité du jour' },
  { ecran: 'produits', titre: 'Produits', aide: 'Catalogue, stock et localisations' },
  { ecran: 'nouvelle-reception', titre: 'Nouvelle entrée', aide: 'Enregistrer des produits reçus' },
  { ecran: 'sorties', titre: 'Sorties', aide: 'Bons de sortie du jour' },
]

function Accueil() {
  const { ouvrirOnglet } = useTabs()
  return (
    <div className="h-full flex items-center justify-center p-[var(--content-padding)]">
      <div className="max-w-xl w-full flex flex-col gap-4">
        <div>
          <h1 className="text-[length:var(--page-title-size)] font-semibold text-text">Aucun écran ouvert</h1>
          <p className="text-[13px] text-text-muted mt-1">Choisis un écran dans le menu de gauche, ou ouvre directement :</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RACCOURCIS.map((r) => (
            <button
              key={r.ecran}
              type="button"
              onClick={() => ouvrirOnglet(r.ecran, r.titre)}
              className="text-left rounded-lg border border-border px-3 py-2.5 hover:bg-muted transition-colors"
            >
              <span className="block text-[13px] font-semibold text-text">{r.titre}</span>
              <span className="block text-xs text-text-muted">{r.aide}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ZoneContenu() {
  const { onglets, ongletActifId } = useTabs()
  return (
    <main className="flex-1 min-h-0 overflow-hidden bg-card">
      {onglets.length === 0 && <Accueil />}
      {onglets.map((o) => {
        const Composant = COMPOSANTS[o.id]
        return (
          <div key={o.id} className="h-full" style={{ display: o.id === ongletActifId ? 'block' : 'none' }}>
            <Composant />
          </div>
        )
      })}
    </main>
  )
}

export function AppShell() {
  return (
    <SelectionProvider>
      <ToastProvider>
        <ConfirmationProvider>
        <TabsProvider>
          {/* Barre latérale à gauche, zone de travail (onglets + écran) sur tout l'espace restant */}
          <div className="flex h-screen overflow-hidden bg-canvas">
            <BarreLaterale />
            <div className="flex-1 min-w-0 flex flex-col">
              <BarreOnglets />
              <ZoneContenu />
            </div>
          </div>
        </TabsProvider>
        </ConfirmationProvider>
      </ToastProvider>
    </SelectionProvider>
  )
}
