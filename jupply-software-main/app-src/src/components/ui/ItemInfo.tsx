// Bulle « Info » et fenêtre d'informations d'un élément de tableau.
// Réutilisable sur tous les tableaux : la page fournit le titre et le
// contenu (onglets), ces composants gèrent l'affichage, la fermeture et le focus.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// État partagé : élément ciblé, ligne cliquée, bulle ou fenêtre affichée
// ---------------------------------------------------------------------------

interface EtatInfo<T> {
  element: T
  /** Position horizontale du clic (la bulle s'affiche à côté). */
  x: number
  ligne: HTMLElement
  mode: 'bulle' | 'panneau'
}

/** Gère la bulle puis la fenêtre pour un tableau. Une seule à la fois. */
export function useItemInfo<T>() {
  const [etat, setEtat] = useState<EtatInfo<T> | null>(null)

  const ouvrirBulle = useCallback((e: MouseEvent<HTMLElement>, element: T) => {
    const ligne = (e.currentTarget.closest('tr') as HTMLElement | null) ?? e.currentTarget
    setEtat({ element, x: e.clientX, ligne, mode: 'bulle' })
  }, [])
  const afficherPanneau = useCallback(() => setEtat((s) => (s ? { ...s, mode: 'panneau' } : s)), [])
  const fermer = useCallback(() => setEtat(null), [])

  return {
    /** Élément dont la bulle ou la fenêtre est ouverte (pour surligner sa ligne). */
    element: etat?.element ?? null,
    bulleOuverte: etat?.mode === 'bulle',
    panneauOuvert: etat?.mode === 'panneau',
    ligne: etat?.ligne ?? null,
    x: etat?.x ?? 0,
    ouvrirBulle,
    afficherPanneau,
    fermer,
  }
}

/** Classe ajoutée à la ligne dont l'info est ouverte. */
export const CLASSE_LIGNE_INFO = 'ligne-info-active'

// ---------------------------------------------------------------------------
// Bulle « Info »
// ---------------------------------------------------------------------------

interface ItemInfoPopoverProps {
  ligne: HTMLElement
  x: number
  onInfo: () => void
  onFermer: () => void
}

const LARGEUR_BULLE = 74

export function ItemInfoPopover({ ligne, x, onInfo, onFermer }: ItemInfoPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rect = ligne.getBoundingClientRect()
  // À droite du clic ; retournée à gauche si elle déborderait de l'écran.
  const aGauche = x + 12 + LARGEUR_BULLE > window.innerWidth - 8
  const left = aGauche ? x - 12 - LARGEUR_BULLE : x + 12
  const top = rect.top + rect.height / 2

  useEffect(() => {
    function onMouseDown(e: globalThis.MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onFermer()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    // La ligne bouge si on fait défiler le tableau : on referme plutôt que de laisser la bulle flotter.
    function onScroll(e: Event) {
      if (!ref.current?.contains(e.target as Node)) onFermer()
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onFermer)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onFermer)
    }
  }, [onFermer])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Informations sur la ligne"
      className="fixed z-50 -translate-y-1/2 animate-[apparition-bulle_120ms_ease-out]"
      style={{ left, top, width: LARGEUR_BULLE }}
    >
      {/* Petite flèche pointant vers la ligne cliquée */}
      <span
        aria-hidden
        className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-topbar ${aGauche ? '-right-1' : '-left-1'}`}
      />
      <button
        type="button"
        onClick={onInfo}
        className="relative w-full inline-flex items-center justify-center gap-1 h-7 rounded-md bg-topbar text-topbar-text text-xs font-semibold shadow-lg hover:bg-topbar-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Info size={12} strokeWidth={2} /> Info
      </button>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Fenêtre d'informations
// ---------------------------------------------------------------------------

export interface OngletInfo {
  id: string
  label: string
  contenu: ReactNode
}

interface ItemInfoPanelProps {
  titre: string
  /** Petit texte sous le titre (ex. désignation sous la référence). */
  sousTitre?: string
  onglets: OngletInfo[]
  onFermer: () => void
  /** Élément qui reprend le focus à la fermeture (la ligne cliquée). */
  elementRetour?: HTMLElement | null
}

const SELECTEUR_FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ItemInfoPanel({ titre, sousTitre, onglets, onFermer, elementRetour }: ItemInfoPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const boutonFermerRef = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  const idOnglets = useId()
  const [ongletActif, setOngletActif] = useState(onglets[0]?.id ?? '')
  const ongletCourant = onglets.find((o) => o.id === ongletActif) ?? onglets[0]

  // Autre élément affiché dans la même fenêtre : on revient au premier onglet.
  useLayoutEffect(() => {
    setOngletActif(onglets[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titre])

  useEffect(() => {
    boutonFermerRef.current?.focus()
    return () => {
      elementRetour?.focus({ preventScroll: true })
    }
  }, [elementRetour])

  useEffect(() => {
    function onMouseDown(e: globalThis.MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onFermer()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onFermer])

  // Focus piégé : Tab tourne entre les éléments de la fenêtre.
  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !ref.current) return
    const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE))
    if (focusables.length === 0) return
    const premier = focusables[0]
    const dernier = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault()
      dernier.focus()
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault()
      premier.focus()
    }
  }

  // Flèches gauche / droite entre les onglets (comportement attendu d'une liste d'onglets).
  function onKeyDownOnglets(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const index = onglets.findIndex((o) => o.id === ongletCourant?.id)
    const suivant = onglets[(index + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length]
    setOngletActif(suivant.id)
    ref.current?.querySelector<HTMLElement>(`[data-onglet="${suivant.id}"]`)?.focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitre}
      onKeyDown={onKeyDown}
      className="fixed z-50 right-4 top-[72px] w-[440px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-96px)] flex flex-col rounded-xl overflow-hidden bg-card border border-border shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)] animate-[apparition-panneau_140ms_ease-out]"
    >
      <div className="shrink-0 flex items-start gap-2 bg-topbar text-topbar-text px-3.5 py-2.5">
        <div className="flex-1 min-w-0">
          <h2 id={idTitre} className="text-[13px] font-semibold truncate">
            {titre}
          </h2>
          {sousTitre && <p className="text-[11.5px] text-topbar-muted truncate">{sousTitre}</p>}
        </div>
        <button
          ref={boutonFermerRef}
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          title="Fermer (Échap)"
          className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md text-topbar-muted hover:text-topbar-text hover:bg-topbar-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>

      {onglets.length > 1 && (
        <div
          role="tablist"
          aria-label="Sections"
          onKeyDown={onKeyDownOnglets}
          className="shrink-0 flex gap-3 px-3.5 border-b border-border"
        >
          {onglets.map((o) => {
            const actif = o.id === ongletCourant?.id
            return (
              <button
                key={o.id}
                type="button"
                role="tab"
                data-onglet={o.id}
                id={`${idOnglets}-${o.id}`}
                aria-selected={actif}
                aria-controls={`${idOnglets}-${o.id}-panneau`}
                tabIndex={actif ? 0 : -1}
                onClick={() => setOngletActif(o.id)}
                className={`h-8 -mb-px border-b-2 text-xs font-medium transition-colors focus:outline-none focus-visible:text-text ${
                  actif ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      {ongletCourant && (
        <div
          role="tabpanel"
          id={`${idOnglets}-${ongletCourant.id}-panneau`}
          aria-labelledby={`${idOnglets}-${ongletCourant.id}`}
          className="flex-1 min-h-0 overflow-y-auto defilement-fin px-3.5 py-3 text-xs text-text"
        >
          {ongletCourant.contenu}
        </div>
      )}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Briques de contenu (mise en page compacte et homogène)
// ---------------------------------------------------------------------------

export function InfoSection({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 [&+&]:mt-3.5 [&+&]:pt-3 [&+&]:border-t [&+&]:border-border">
      {titre && <h3 className="text-[10.5px] font-semibold text-text-muted uppercase tracking-wide">{titre}</h3>}
      {children}
    </section>
  )
}

/** Grille libellé / valeur sur deux colonnes. */
export function InfoChamps({ champs }: { champs: { label: string; valeur: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,40%)_1fr] gap-x-3 gap-y-1">
      {champs.map((c) => (
        <div key={c.label} className="contents">
          <dt className="text-text-muted truncate">{c.label}</dt>
          <dd className="text-text min-w-0 break-words">{c.valeur ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function InfoVide({ children }: { children: ReactNode }) {
  return <p className="text-text-muted py-2">{children}</p>
}
