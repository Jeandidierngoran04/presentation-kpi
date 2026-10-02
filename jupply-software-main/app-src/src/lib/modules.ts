import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  LayoutDashboard,
  Package,
  RotateCcw,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { EcranId } from '../context/TabsContext'

export interface ActionModule {
  ecran: EcranId
  label: string
  icone: LucideIcon
}

export interface Module {
  id: string
  label: string
  actions: ActionModule[]
}

// Modules metiers (Level 1 : pilules de la Top Bar) et leurs sous-sections
// (Level 2 : Sub-Header). Les categories AIRSTOCK pas encore couvertes
// (Controle, Impressions, Ressources Humaines, Options) apparaitront quand
// les ecrans correspondants seront construits.
export const MODULES: Module[] = [
  {
    id: 'magasin',
    label: 'Magasin',
    actions: [
      { ecran: 'dashboard', label: 'Dashboard', icone: LayoutDashboard },
      { ecran: 'produits', label: 'Produits', icone: Package },
      { ecran: 'entrepots', label: 'Entrepôts', icone: Warehouse },
      { ecran: 'alertes', label: 'Alertes stock', icone: AlertTriangle },
    ],
  },
  {
    id: 'receptions-expeditions',
    label: 'Réceptions/Expéditions',
    actions: [
      { ecran: 'entrees', label: 'Entrées manuelles', icone: ArrowDownToLine },
      { ecran: 'sorties', label: 'Sorties Manuelles', icone: ArrowUpFromLine },
      { ecran: 'reintegration', label: 'Réintégration', icone: RotateCcw },
      { ecran: 'transferts', label: 'Transfert', icone: Truck },
    ],
  },
  {
    id: 'logistique',
    label: 'Logistique',
    actions: [
      { ecran: 'mouvements', label: 'Mouvements', icone: ArrowLeftRight },
      { ecran: 'inventaires', label: 'Inventaires', icone: ClipboardList },
    ],
  },
]

/** Écrans ouverts depuis un autre écran (pas de bouton dans le Sub-Header), rattachés à leur module. */
const ECRANS_SECONDAIRES: Partial<Record<EcranId, string>> = {
  'nouvelle-reception': 'receptions-expeditions',
}

export const MODULE_PAR_ECRAN = {
  ...Object.fromEntries(MODULES.flatMap((m) => m.actions.map((a) => [a.ecran, m.id] as const))),
  ...ECRANS_SECONDAIRES,
} as Record<EcranId, string>

export function moduleParId(id: string): Module {
  return MODULES.find((m) => m.id === id) ?? MODULES[0]
}
