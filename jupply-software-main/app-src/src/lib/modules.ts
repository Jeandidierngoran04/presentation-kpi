import {
  ArrowLeftRight,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { EcranId } from '../context/TabsContext'

/** Une sous-entrée du menu (un écran). */
export interface EntreeMenu {
  ecran: EcranId
  label: string
  /** Écran prévu mais pas encore construit : affiché grisé, non cliquable. */
  bientot?: boolean
}

/**
 * Une entrée de la barre latérale. Soit elle ouvre directement un écran
 * (`ecran`), soit elle se déplie comme un dossier sur ses sous-entrées.
 */
export interface GroupeMenu {
  id: string
  label: string
  icone: LucideIcon
  ecran?: EcranId
  entrees?: EntreeMenu[]
}

// Barre latérale (de haut en bas). "Paramètre" est à part : il reste ancré
// en bas de la barre (voir MENU_PARAMETRE).
export const MENU: GroupeMenu[] = [
  { id: 'tableau-de-bord', label: 'Tableau de bord', icone: LayoutDashboard, ecran: 'dashboard' },
  {
    id: 'stock',
    label: 'Stock Management',
    icone: Package,
    entrees: [
      { ecran: 'produits', label: 'Produits' },
      { ecran: 'alertes', label: 'Alertes stock' },
      { ecran: 'quarantaine', label: 'Quarantaine' },
    ],
  },
  {
    id: 'mouvement',
    label: 'Mouvement',
    icone: ArrowLeftRight,
    entrees: [
      { ecran: 'entrees', label: 'Entrées' },
      { ecran: 'sorties', label: 'Sorties' },
      { ecran: 'reintegration', label: 'Réintégrations' },
      { ecran: 'transferts', label: 'Transferts' },
    ],
  },
  { id: 'inventaires', label: 'Inventaires', icone: ClipboardList, ecran: 'inventaires' },
  {
    id: 'historiques',
    label: 'Historiques',
    icone: History,
    entrees: [
      { ecran: 'historique-sorties', label: 'Sorties' },
      { ecran: 'historique-entrees', label: 'Entrées' },
      { ecran: 'historique-reintegrations', label: 'Réintégrations' },
      { ecran: 'historique-transferts', label: 'Transferts' },
      { ecran: 'historique-non-conformites', label: 'Non-conformités' },
      { ecran: 'mouvements', label: 'Tous les mouvements' },
    ],
  },
]

export const MENU_PARAMETRE: GroupeMenu = {
  id: 'parametre',
  label: 'Paramètre',
  icone: Settings,
  entrees: [{ ecran: 'entrepots', label: 'Entrepôts et emplacements' }],
}

/** Écrans ouverts depuis un autre écran (absents du menu), rattachés à leur groupe. */
const ECRANS_SECONDAIRES: Partial<Record<EcranId, string>> = {
  'nouvelle-reception': 'mouvement',
  'nouvelle-sortie': 'mouvement',
}

/** Groupe du menu auquel appartient chaque écran (pour surligner et déplier le bon dossier). */
export const MODULE_PAR_ECRAN = {
  ...Object.fromEntries(
    [...MENU, MENU_PARAMETRE].flatMap((g) => [
      ...(g.ecran ? [[g.ecran, g.id] as const] : []),
      ...(g.entrees ?? []).map((e) => [e.ecran, g.id] as const),
    ]),
  ),
  ...ECRANS_SECONDAIRES,
} as Record<EcranId, string>

export const GROUPE_PAR_DEFAUT = 'tableau-de-bord'
