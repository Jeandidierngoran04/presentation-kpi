import { X } from 'lucide-react'
import { useTabs } from '../../context/TabsContext'

export function BarreOnglets() {
  const { onglets, ongletActifId, activerOnglet, fermerOnglet } = useTabs()

  return (
    <div className="flex items-end gap-1 shrink-0 bg-canvas px-2 pt-1.5 overflow-x-auto">
      {onglets.map((o) => {
        const actif = o.id === ongletActifId
        return (
          <div
            key={o.id}
            onClick={() => activerOnglet(o.id)}
            className={`group relative flex items-center gap-1.5 pl-3 pr-2 h-8 text-[13px] font-medium whitespace-nowrap cursor-pointer rounded-t-[10px] transition-colors ${
              actif
                ? 'onglet-actif bg-card text-text'
                : 'text-text-muted hover:text-text hover:bg-card/50'
            }`}
          >
            {o.titre}
            {o.id !== 'dashboard' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fermerOnglet(o.id)
                }}
                className={`shrink-0 rounded p-0.5 text-text-muted hover:text-danger ${
                  actif ? '' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Fermer l'onglet"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
