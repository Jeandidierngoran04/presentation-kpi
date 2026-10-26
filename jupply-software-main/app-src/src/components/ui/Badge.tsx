import type { ReactNode } from 'react'

/** succes = terminé (vert) · info = en cours (bleu) · neutre = en attente (gris) · danger = problème (rouge) · alerte = alerte de stock (orange). */
export type TonBadge = 'neutre' | 'succes' | 'info' | 'alerte' | 'danger'

const TONS: Record<TonBadge, string> = {
  neutre: 'bg-muted text-text-muted border-border',
  succes: 'bg-accent-soft text-accent-deep border-accent/40',
  info: 'bg-info-soft text-info-deep border-info/40',
  alerte: 'bg-warn-soft text-warn-deep border-warn/40',
  danger: 'bg-danger-soft text-danger-deep border-danger/40',
}

/** Classes d'un badge de statut, pour les listes qui construisent leur propre <span>. */
export function classeBadge(ton: TonBadge): string {
  return `inline-flex items-center h-[18px] rounded-full border px-1.5 text-[10.5px] font-semibold uppercase tracking-wide whitespace-nowrap ${TONS[ton]}`
}

export function Badge({ ton = 'neutre', children }: { ton?: TonBadge; children: ReactNode }) {
  return <span className={classeBadge(ton)}>{children}</span>
}
