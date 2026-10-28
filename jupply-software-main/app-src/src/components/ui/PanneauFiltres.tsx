// Panneau latéral « Filtres » qui glisse depuis la droite : sections
// dépliables, boutons Réinitialiser / Appliquer en bas. Réutilisable sur
// tous les écrans : la page fournit les sections et gère le brouillon.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'

interface PanneauFiltresProps {
  onFermer: () => void
  onAppliquer: () => void
  onReinitialiser: () => void
  children: ReactNode
}

export function PanneauFiltres({ onFermer, onAppliquer, onReinitialiser, children }: PanneauFiltresProps) {
  const idTitre = useId()
  const boutonFermerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    boutonFermerRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onFermer])

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 animate-[apparition-voile_140ms_ease-out]" onMouseDown={onFermer} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        className="absolute right-0 top-0 h-full w-[300px] max-w-[90vw] flex flex-col bg-card border-l border-border shadow-[-18px_0_50px_-20px_rgba(0,0,0,0.35)] animate-[glissement-panneau_180ms_ease-out]"
      >
        <div className="shrink-0 h-11 flex items-center justify-between px-4 border-b border-border">
          <h2 id={idTitre} className="text-[14px] font-semibold text-text">
            Filtres
          </h2>
          <button
            ref={boutonFermerRef}
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            title="Fermer (Échap)"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-muted"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto defilement-fin">{children}</div>
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <button type="button" onClick={onReinitialiser} className="h-8 px-3 rounded-md text-xs font-semibold text-text-muted hover:text-text hover:bg-muted">
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onAppliquer}
            className="h-8 px-5 rounded-md bg-accent text-accent-contrast text-xs font-semibold hover:bg-accent-strong"
          >
            Appliquer
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

/** Section dépliable du panneau : titre, résumé de la sélection à droite, chevron. */
export function SectionFiltre({
  titre,
  resume,
  ouvertParDefaut = false,
  children,
}: {
  titre: string
  resume?: string
  ouvertParDefaut?: boolean
  children: ReactNode
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut)
  const idContenu = useId()
  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls={idContenu}
        className="w-full h-10 flex items-center gap-2 px-4 text-left hover:bg-muted/60"
      >
        <span className="flex-1 text-[13px] font-semibold text-text">{titre}</span>
        {resume && <span className="text-[11.5px] text-text-muted truncate max-w-[120px]">{resume}</span>}
        <ChevronDown size={15} strokeWidth={1.75} className={`shrink-0 text-text-muted transition-transform duration-150 ${ouvert ? 'rotate-180' : ''}`} />
      </button>
      {ouvert && (
        <div id={idContenu} className="px-4 pb-3 flex flex-col gap-1.5 text-[12.5px] text-text">
          {children}
        </div>
      )}
    </section>
  )
}

/** Case à cocher d'une liste de filtres. */
export function CaseFiltre({ libelle, coche, onChange }: { libelle: ReactNode; coche: boolean; onChange: (coche: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 h-7 cursor-pointer select-none">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />
      {libelle}
    </label>
  )
}
