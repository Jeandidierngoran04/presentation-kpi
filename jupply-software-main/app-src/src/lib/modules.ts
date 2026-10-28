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
  /** Titre de l'onglet s'il doit se distinguer d'un homonyme (ex. Sorties / Historique des sorties). */
  titreOnglet?: string
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
      { ecran: 'nouvelle-reception', label: 'Créer une entrée manuelle', titreOnglet: 'Entrée manuelle' },
      { ecran: 'sorties', label: 'Sorties' },
      { ecran: 'reintegration', label: 'Réintégrations' },
      { ecran: 'transferts', label: 'Transferts' },
      { ecran: 'commandes-fournisseurs', label: 'Commandes fournisseurs (PO)', titreOnglet: 'Commandes fournisseurs' },
    ],
  },
  { id: 'inventaires', label: 'Inventaires', icone: ClipboardList, ecran: 'inventaires' },
  {
    id: 'historiques',
    label: 'Historiques',
    icone: History,
    entrees: [
      { ecran: 'historique-sorties', label: 'Sorties', titreOnglet: 'Historique des sorties' },
      { ecran: 'historique-entrees', label: 'Entrées', titreOnglet: 'Historique des entrées' },
      { ecran: 'historique-commandes', label: 'Commandes fournisseurs', titreOnglet: 'Historique des commandes' },
      { ecran: 'historique-reintegrations', label: 'Réintégrations', titreOnglet: 'Historique des réintégrations' },
      { ecran: 'historique-transferts', label: 'Transferts', titreOnglet: 'Historique des transferts' },
      { ecran: 'historique-non-conformites', label: 'Non-conformités', titreOnglet: 'Historique des non-conformités' },
      { ecran: 'mouvements', label: 'Tous les mouvements', titreOnglet: 'Historique des mouvements' },
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
  'nouvelle-sortie': 'mouvement',
  'nouvelle-commande': 'mouvement',
  'fiche-stock': 'stock',
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
