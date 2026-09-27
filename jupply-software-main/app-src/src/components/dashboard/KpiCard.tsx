import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  icone: LucideIcon
  label: string
  valeur: string
  indication: string
  tonalite?: 'neutre' | 'succes' | 'alerte' | 'danger'
}

const TONALITES: Record<NonNullable<KpiCardProps['tonalite']>, string> = {
  neutre: 'bg-muted text-text-muted',
  succes: 'bg-accent-soft text-accent-deep',
  alerte: 'bg-warn-soft text-warn-deep',
  danger: 'bg-danger-soft text-danger-deep',
}

export function KpiCard({ icone: Icone, label, valeur, indication, tonalite = 'neutre' }: KpiCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${TONALITES[tonalite]}`}>
        <Icone size={17} strokeWidth={1.75} />
      </div>
      <div className="text-xl font-bold text-text leading-none">{valeur}</div>
      <div className="text-xs text-text-muted font-medium mt-2">{label}</div>
      <div className="text-[11px] text-text-muted/80 mt-0.5">{indication}</div>
    </div>
  )
}
