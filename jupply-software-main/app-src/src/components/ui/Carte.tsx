import type { ReactNode } from 'react'

interface CarteProps {
  children: ReactNode
  className?: string
}

/** Conteneur standard de la charte : fond carte, bordure fine, coins 12px, padding 16px. */
export function Carte({ children, className = '' }: CarteProps) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>
}
