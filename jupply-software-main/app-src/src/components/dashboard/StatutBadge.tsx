import type { StatutStock } from '../../types/stock'
import { Badge, type TonBadge } from '../ui/Badge'

const STYLES: Record<StatutStock, { label: string; ton: TonBadge }> = {
  normal: { label: 'Normal', ton: 'succes' },
  faible: { label: 'En alerte', ton: 'alerte' },
  rupture: { label: 'Rupture', ton: 'danger' },
}

export function StatutBadge({ statut }: { statut: StatutStock }) {
  const { label, ton } = STYLES[statut]
  return <Badge ton={ton}>{label}</Badge>
}
