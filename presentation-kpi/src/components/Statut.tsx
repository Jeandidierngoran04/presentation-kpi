import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react'
import type { Statut } from '../lib/types'

export const STATUTS: Record<Statut, { libelle: string; couleur: string; texte: string; doux: string; Icone: typeof CheckCircle2 }> = {
  bon: { libelle: 'Atteint', couleur: 'var(--color-bon)', texte: 'var(--color-bon-texte)', doux: 'var(--color-bon-doux)', Icone: CheckCircle2 },
  vigilance: { libelle: 'Vigilance', couleur: 'var(--color-vigilance)', texte: 'var(--color-vigilance-texte)', doux: 'var(--color-vigilance-doux)', Icone: AlertTriangle },
  alerte: { libelle: 'Alerte', couleur: 'var(--color-alerte)', texte: 'var(--color-alerte-texte)', doux: 'var(--color-alerte-doux)', Icone: XCircle },
  vide: { libelle: '—', couleur: 'var(--color-base)', texte: 'var(--color-muted)', doux: '#f1f0ec', Icone: CircleDashed },
}

/** Pastille de statut : toujours icône + libellé, jamais la couleur seule. */
export function Pastille({ statut, taille = 'md', libelle }: { statut: Statut; taille?: 'sm' | 'md' | 'lg'; libelle?: string }) {
  const s = STATUTS[statut]
  const dims = taille === 'lg' ? 'text-[22px] px-4 py-1.5 gap-2' : taille === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-2.5 py-1 gap-1.5'
  const ic = taille === 'lg' ? 24 : taille === 'sm' ? 13 : 15
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${dims}`} style={{ background: s.doux, color: s.texte }}>
      <s.Icone size={ic} strokeWidth={2.4} style={{ color: s.couleur === 'var(--color-vigilance)' ? s.texte : s.couleur }} />
      {libelle ?? s.libelle}
    </span>
  )
}

export function Point({ statut, taille = 10 }: { statut: Statut; taille?: number }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: taille, height: taille, background: STATUTS[statut].couleur }} />
}
