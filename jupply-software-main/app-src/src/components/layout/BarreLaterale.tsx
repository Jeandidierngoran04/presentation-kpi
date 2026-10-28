import { useEffect, useState, type MouseEvent } from 'react'
import { ChevronRight, ChevronsLeft, ChevronsRight, LogOut, Moon, Settings, Sun, UserRound } from 'lucide-react'
import { useTabs, type EcranId } from '../../context/TabsContext'
import { useSelection } from '../../context/SelectionContext'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { MENU, MENU_PARAMETRE, type EntreeMenu, type GroupeMenu } from '../../lib/modules'
import { InfoBulle } from './InfoBulle'
import { MenuFlottant } from './MenuFlottant'

const CLE_REDUITE = 'jupply-barre-reduite'
const CLE_OUVERTS = 'jupply-menu-ouverts'

function lire<T>(cle: string, defaut: T): T {
  try {
    const valeur = localStorage.getItem(cle)
    return valeur == null ? defaut : (JSON.parse(valeur) as T)
  } catch {
    return defaut
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    // Stockage indisponible (navigation privée...) : l'état n'est simplement pas mémorisé.
  }
}

type MenuOuvert = { type: 'compte'; ancre: DOMRect } | null

// Hauteur et retrait communs : l'icône garde la même place, barre ouverte ou réduite.
const CLASSE_LIGNE =
  'w-[calc(100%-16px)] mx-2 flex items-center gap-3 pl-[15px] pr-2 rounded-md text-left whitespace-nowrap ' +
  'h-[var(--nav-item-height)] text-[length:var(--nav-font-size)] transition-colors'
const CLASSE_SOUS_LIGNE =
  'w-[calc(100%-16px)] mx-2 flex items-center pl-[45px] pr-2 rounded-md text-left whitespace-nowrap ' +
  'h-[var(--nav-sub-item-height)] text-[length:var(--nav-sub-font-size)] transition-colors'

/**
 * Barre latérale : logo en haut, groupes dépliables comme des dossiers,
 * compte et Paramètre ancrés en bas avec la flèche pour réduire la barre.
 * Réduite, elle devient un rail d'icônes avec info-bulles.
 */
export function BarreLaterale() {
  const { ongletActifId, moduleActifId, ouvrirOnglet } = useTabs()
  const { produitSelectionneId, declencherSortieManuelle } = useSelection()
  const { profil, deconnexion } = useAuth()
  const { theme, basculer } = useTheme()
  const [reduite, setReduite] = useState<boolean>(() => lire(CLE_REDUITE, false))
  const [ouverts, setOuverts] = useState<string[]>(() => lire(CLE_OUVERTS, ['stock', 'mouvement']))
  const [menu, setMenu] = useState<MenuOuvert>(null)

  // Le dossier de l'écran affiché est toujours déplié.
  useEffect(() => {
    if (moduleActifId && !ouverts.includes(moduleActifId) && MENU.some((g) => g.id === moduleActifId && g.entrees)) {
      setOuverts((prev) => [...prev, moduleActifId])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleActifId])

  useEffect(() => ecrire(CLE_OUVERTS, ouverts), [ouverts])

  function basculerReduite() {
    setMenu(null)
    setReduite((v) => {
      ecrire(CLE_REDUITE, !v)
      return !v
    })
  }

  function ouvrirEcran(entree: EntreeMenu) {
    if (entree.bientot) return
    setMenu(null)
    // Depuis Produits, avec un produit sélectionné : "Sorties" ouvre directement
    // la feuille de saisie avec ce produit. Sinon, la liste du jour.
    if (entree.ecran === 'sorties' && ongletActifId === 'produits' && produitSelectionneId) {
      declencherSortieManuelle(produitSelectionneId)
      ouvrirOnglet('nouvelle-sortie', 'Nouvelle sortie')
      return
    }
    ouvrirOnglet(entree.ecran, entree.titreOnglet ?? entree.label)
  }

  function clicGroupe(groupe: GroupeMenu) {
    if (groupe.ecran) return ouvrirEcran({ ecran: groupe.ecran, label: groupe.label })
    // Barre réduite : un clic sur un dossier déplie la barre avec ce dossier ouvert.
    if (reduite) {
      basculerReduite()
      setOuverts((prev) => (prev.includes(groupe.id) ? prev : [...prev, groupe.id]))
      return
    }
    setOuverts((prev) => (prev.includes(groupe.id) ? prev.filter((id) => id !== groupe.id) : [...prev, groupe.id]))
  }

  // Barre réduite : un clic n'importe où sur la bande (hors bouton) la déplie.
  function clicBande(e: MouseEvent<HTMLElement>) {
    // contains() écarte les clics venus du menu du compte (affiché hors de la barre, via un portail).
    const cible = e.target as HTMLElement
    if (reduite && e.currentTarget.contains(cible) && !cible.closest('button')) basculerReduite()
  }

  const estActif = (ecran: EcranId) => ecran === ongletActifId
  const nom = profil?.nom_complet ?? 'Utilisateur'
  const initiale = nom.trim().charAt(0).toUpperCase() || '?'

  function ligneGroupe(groupe: GroupeMenu) {
    const ouvert = !reduite && ouverts.includes(groupe.id)
    const actif = groupe.id === moduleActifId
    const feuilleActive = groupe.ecran != null && estActif(groupe.ecran)
    const Icone = groupe.icone
    return (
      <InfoBulle texte={groupe.label} actif={reduite}>
        <button
          type="button"
          onClick={() => clicGroupe(groupe)}
          aria-expanded={groupe.entrees ? ouvert : undefined}
          className={`${CLASSE_LIGNE} ${
            feuilleActive || (reduite && actif) ? 'nav-actif-lueur text-text font-semibold' : 'text-text hover:bg-nav-survol'
          } ${actif && !feuilleActive ? 'font-semibold' : 'font-medium'}`}
        >
          <Icone size={18} strokeWidth={1.6} className={`shrink-0 ${actif ? 'text-accent-deep' : 'text-text-muted'}`} />
          <span className="libelle-nav flex-1 min-w-0 truncate">{groupe.label}</span>
          {groupe.entrees && (
            <ChevronRight
              size={15}
              strokeWidth={1.75}
              className={`libelle-nav shrink-0 text-text-muted transition-transform duration-150 ${ouvert ? 'rotate-90' : ''}`}
            />
          )}
        </button>
      </InfoBulle>
    )
  }

  function sousLignes(groupe: GroupeMenu) {
    return (groupe.entrees ?? []).map((entree) => (
      <button
        key={entree.ecran}
        type="button"
        onClick={() => ouvrirEcran(entree)}
        disabled={entree.bientot}
        className={`${CLASSE_SOUS_LIGNE} ${
          estActif(entree.ecran)
            ? 'nav-actif-lueur text-text font-semibold'
            : entree.bientot
              ? 'text-text-muted/60 cursor-default'
              : 'text-text hover:bg-nav-survol'
        }`}
      >
        <span className="truncate">{entree.label}</span>
      </button>
    ))
  }

  return (
    <aside
      className={`barre-laterale shrink-0 h-full flex flex-col bg-nav-fond border-r border-border overflow-hidden ${reduite ? 'cursor-e-resize' : ''}`}
      data-reduite={reduite}
      onClick={clicBande}
      aria-label="Navigation principale"
    >
      {/* Logo seul */}
      <div className="shrink-0 h-14 flex items-center pl-[18px]">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center" title="Jupply">
          <span className="font-bold text-accent-contrast text-sm">J</span>
        </div>
      </div>

      {/* Entrées : défilement interne fin, le logo et le bas restent fixes */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden defilement-fin py-1 flex flex-col gap-0.5">
        {MENU.map((groupe) => (
          <div key={groupe.id} className="flex flex-col gap-0.5">
            {ligneGroupe(groupe)}
            {!reduite && groupe.entrees && ouverts.includes(groupe.id) && (
              <div className="flex flex-col gap-0.5 pb-1">{sousLignes(groupe)}</div>
            )}
          </div>
        ))}
      </nav>

      {/* Bas fixe : compte, Paramètre, flèche */}
      <div className="shrink-0 border-t border-border py-2 flex flex-col gap-0.5">
        <InfoBulle texte={nom} actif={reduite}>
          <button
            type="button"
            onClick={(e) => {
              const ancre = e.currentTarget.getBoundingClientRect()
              setMenu((m) => (m?.type === 'compte' ? null : { type: 'compte', ancre }))
            }}
            className={`${CLASSE_LIGNE} pl-[13px] text-text hover:bg-nav-survol`}
            title={reduite ? undefined : 'Mon compte'}
          >
            <span className="w-[22px] h-[22px] shrink-0 rounded-full bg-accent-soft text-accent-deep flex items-center justify-center text-[11px] font-bold">
              {initiale}
            </span>
            <span className="libelle-nav flex-1 min-w-0 flex flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold">{nom}</span>
              <span className="truncate text-[11px] text-text-muted capitalize">{profil?.role?.replace(/_/g, ' ') ?? ''}</span>
            </span>
          </button>
        </InfoBulle>

        <div className={reduite ? 'flex flex-col gap-0.5' : 'flex items-center pr-2'}>
          <div className={reduite ? '' : 'flex-1 min-w-0'}>{ligneGroupe(MENU_PARAMETRE)}</div>
          <InfoBulle texte="Déplier le menu" actif={reduite}>
            <button
              type="button"
              onClick={basculerReduite}
              className={`${reduite ? CLASSE_LIGNE : 'w-8 h-8 flex items-center justify-center rounded-md'} text-text-muted hover:text-text hover:bg-nav-survol`}
              title={reduite ? undefined : 'Réduire le menu'}
              aria-label={reduite ? 'Déplier le menu' : 'Réduire le menu'}
            >
              {reduite ? <ChevronsRight size={18} strokeWidth={1.75} /> : <ChevronsLeft size={18} strokeWidth={1.75} />}
            </button>
          </InfoBulle>
        </div>
        {!reduite && ouverts.includes(MENU_PARAMETRE.id) && (
          <div className="flex flex-col gap-0.5 pt-0.5">{sousLignes(MENU_PARAMETRE)}</div>
        )}
      </div>

      {/* Menu du compte */}
      {menu && (
        <MenuFlottant ancre={menu.ancre} depuisLeBas onFermer={() => setMenu(null)}>
          <div className="px-3 py-2 flex items-center gap-2.5">
            <span className="w-8 h-8 shrink-0 rounded-full bg-accent-soft text-accent-deep flex items-center justify-center text-sm font-bold">
              {initiale}
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-[13px] font-semibold truncate">{nom}</span>
              <span className="text-[11px] text-text-muted capitalize truncate">{profil?.role?.replace(/_/g, ' ') ?? ''}</span>
            </span>
          </div>
          <div className="h-px bg-border my-1" />
          <button type="button" disabled className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-text-muted/70 cursor-not-allowed">
            <UserRound size={15} strokeWidth={1.6} /> Mon profil
          </button>
          <button type="button" disabled className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-text-muted/70 cursor-not-allowed">
            <Settings size={15} strokeWidth={1.6} /> Préférences
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={basculer}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] hover:bg-nav-survol"
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.6} /> : <Moon size={15} strokeWidth={1.6} />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
          <div className="h-px bg-border my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null)
              deconnexion()
            }}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-danger hover:bg-danger-soft"
          >
            <LogOut size={15} strokeWidth={1.6} /> Déconnexion
          </button>
        </MenuFlottant>
      )}
    </aside>
  )
}
