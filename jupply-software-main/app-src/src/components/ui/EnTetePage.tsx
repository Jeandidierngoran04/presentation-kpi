import type { ReactNode } from 'react'

interface EnTetePageProps {
  titre: string
  /** Nombre d'éléments affichés, entre crochets après le titre (ex. « Sorties [12] »). */
  compteur?: number
  /** Boutons d'action, alignés à droite. */
  actions?: ReactNode
}

/** En-tête compact d'un écran à liste : titre + compteur à gauche, actions à droite. */
export function EnTetePage({ titre, compteur, actions }: EnTetePageProps) {
  return (
    <div className="shrink-0 min-h-9 flex items-center justify-between gap-3 flex-wrap">
      <h1 className="text-[length:var(--page-title-size)] font-semibold text-text leading-tight">
        {titre}
        {compteur != null && (
          <span className="ml-1.5 font-normal text-text-muted tabular-nums">[{compteur.toLocaleString('fr-FR')}]</span>
        )}
      </h1>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
