import type { ReactNode } from 'react'

export type TonBadge = 'neutre' | 'succes' | 'alerte' | 'danger'

const TONS: Record<TonBadge, string> = {
  neutre: 'bg-muted text-text-muted',
  succes: 'bg-accent-soft text-accent-deep',
  alerte: 'bg-warn-soft text-warn-deep',
  danger: 'bg-danger-soft text-danger-deep',
}

export function Badge({ ton = 'neutre', children }: { ton?: TonBadge; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONS[ton]}`}
    >
      {children}
    </span>
  )
}
