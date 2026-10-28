import type { StatutStock } from '../../types/stock'
import { Badge, type TonBadge } from '../ui/Badge'

/** Libellé et couleur de chaque statut de stock (réutilisés par la fenêtre Info et la fiche de stock). */
export const STYLES_STATUT_STOCK: Record<StatutStock, { label: string; ton: TonBadge }> = {
  normal: { label: 'Normal', ton: 'succes' },
  faible: { label: 'En alerte', ton: 'alerte' },
  rupture: { label: 'Rupture', ton: 'danger' },
}

export function StatutBadge({ statut }: { statut: StatutStock }) {
  const { label, ton } = STYLES_STATUT_STOCK[statut]
  return <Badge ton={ton}>{label}</Badge>
}
