import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger'
type Taille = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors ' +
  'disabled:opacity-60 disabled:pointer-events-none'

const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-accent hover:bg-accent-strong text-accent-contrast',
  secondaire: 'bg-card border border-border hover:bg-muted text-text',
  discret: 'text-text-muted hover:text-text hover:bg-muted',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
}

const TAILLES: Record<Taille, string> = {
  md: 'text-[13px] px-4 py-2',
  sm: 'text-xs px-3 py-1.5',
}

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  taille?: Taille
  children: ReactNode
}

export function Bouton({ variante = 'primaire', taille = 'md', className = '', children, ...rest }: BoutonProps) {
  return (
    <button className={`${BASE} ${VARIANTES[variante]} ${TAILLES[taille]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
