import { Bell, Moon, Search, Sun } from 'lucide-react'
import { useTabs } from '../../context/TabsContext'
import { useTheme } from '../../context/ThemeContext'
import { MODULES } from '../../lib/modules'
import { MenuCompte } from './MenuCompte'

export function TopBar() {
  const { moduleActifId, definirModuleActif } = useTabs()
  const { theme, basculer } = useTheme()

  return (
    <header className="h-12 shrink-0 bg-topbar text-topbar-text flex items-center gap-3 px-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
          <span className="font-bold text-accent-contrast text-xs">J</span>
        </div>
        <span className="font-semibold text-sm">Jupply</span>
      </div>

      <nav className="flex items-center gap-1 shrink-0 ml-1">
        {MODULES.map((m) => {
          const actif = m.id === moduleActifId
          return (
            <button
              key={m.id}
              onClick={() => definirModuleActif(m.id)}
              className={`text-[13px] font-semibold px-3 h-7 rounded-full transition-colors ${
                actif ? 'bg-white/10 text-topbar-text' : 'text-topbar-muted hover:text-topbar-text hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2.5 h-7 w-56 shrink-0 focus-within:bg-white/20">
        <Search size={14} className="text-topbar-muted shrink-0" strokeWidth={1.75} />
        <input
          type="text"
          placeholder="Rechercher..."
          className="bg-transparent outline-none text-[13px] w-full placeholder:text-topbar-muted"
        />
      </div>

      <button
        onClick={basculer}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-topbar-hover text-topbar-muted hover:text-topbar-text transition-colors shrink-0"
        title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </button>

      <button
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-topbar-hover text-topbar-muted hover:text-topbar-text relative shrink-0"
        title="Notifications"
      >
        <Bell size={16} strokeWidth={1.75} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
      </button>

      <MenuCompte />
    </header>
  )
}
