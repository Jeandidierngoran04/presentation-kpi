import type { ReactElement } from 'react'
import { TabsProvider, useTabs, type EcranId } from '../../context/TabsContext'
import { SelectionProvider } from '../../context/SelectionContext'
import { TopBar } from './TopBar'
import { SousEntete } from './SousEntete'
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
  HistoriqueEntrees,
  HistoriqueMouvements,
  HistoriqueReintegrations,
  HistoriqueSorties,
  HistoriqueTransferts,
} from '../../pages/Historique'
import { ToastProvider } from '../../context/ToastContext'
import { ComingSoon } from '../../pages/ComingSoon'

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
} satisfies Record<EcranId, () => ReactElement>

function ZoneContenu() {
  const { onglets, ongletActifId } = useTabs()
  return (
    <main className="flex-1 min-h-0 overflow-hidden bg-card">
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
        <TabsProvider>
          <div className="flex flex-col h-screen overflow-hidden bg-canvas">
            <TopBar />
            <SousEntete />
            <BarreOnglets />
            <ZoneContenu />
          </div>
        </TabsProvider>
      </ToastProvider>
    </SelectionProvider>
  )
}
