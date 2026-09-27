import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

const CLE_STOCKAGE = 'jupply-theme'

interface ThemeState {
  theme: Theme
  basculer: () => void
  definir: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeState | undefined>(undefined)

function themeInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stocke = window.localStorage.getItem(CLE_STOCKAGE)
  if (stocke === 'light' || stocke === 'dark') return stocke
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(themeInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      window.localStorage.setItem(CLE_STOCKAGE, theme)
    } catch {
      // stockage indisponible (navigation privee) : on garde le theme en memoire seulement
    }
  }, [theme])

  const basculer = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, basculer, definir: setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme doit etre utilise a l'interieur de ThemeProvider")
  return ctx
}
