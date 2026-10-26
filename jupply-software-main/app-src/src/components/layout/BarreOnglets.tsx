import { Bell, Search, X } from 'lucide-react'
import { useTabs } from '../../context/TabsContext'

/**
 * Seule ligne du haut de la zone de travail : les onglets ouverts à gauche,
 * la recherche et les notifications à droite.
 */
export function BarreOnglets() {
  const { onglets, ongletActifId, activerOnglet, fermerOnglet } = useTabs()

  return (
    <div className="shrink-0 h-[var(--barre-haute-height)] flex items-end gap-3 bg-canvas pl-2 pr-3">
      <div className="flex-1 min-w-0 h-full flex items-end gap-1 overflow-x-auto overflow-y-hidden defilement-fin pt-1.5">
        {onglets.map((o) => {
          const actif = o.id === ongletActifId
          return (
            <div
              key={o.id}
              onClick={() => activerOnglet(o.id)}
              className={`group relative flex items-center gap-1.5 pl-3 pr-2 h-8 text-[13px] font-medium whitespace-nowrap cursor-pointer rounded-t-[10px] transition-colors ${
                actif ? 'onglet-actif bg-card text-text' : 'text-text-muted hover:text-text hover:bg-card/50'
              }`}
            >
              {o.titre}
              {o.id !== 'dashboard' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fermerOnglet(o.id)
                  }}
                  className={`shrink-0 rounded p-0.5 text-text-muted hover:text-danger ${actif ? '' : 'opacity-0 group-hover:opacity-100'}`}
                  title="Fermer l'onglet"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="shrink-0 self-center flex items-center gap-1.5">
        <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2.5 h-7 w-56 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search size={14} className="text-text-muted shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Rechercher..."
            className="bg-transparent outline-none text-[13px] w-full text-text placeholder:text-text-muted"
          />
        </div>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-card relative"
          title="Notifications"
        >
          <Bell size={16} strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
        </button>
      </div>
    </div>
  )
}
