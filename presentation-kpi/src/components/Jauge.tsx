import { STATUTS } from './Statut'
import type { Statut } from '../lib/types'

/**
 * Jauge en arc : le nombre présent en gros, la cible à côté, le % dessous.
 * Au-delà de 100 %, l'arc est plein et le dépassement est indiqué en texte.
 */
export function Jauge({
  present,
  cible,
  statut,
  libelle,
  taille = 220,
}: {
  present: number | null
  cible: number
  statut: Statut
  libelle: string
  taille?: number
}) {
  const ratio = present == null || cible <= 0 ? 0 : present / cible
  const rempli = Math.min(ratio, 1)
  const ep = taille * 0.085
  const r = (taille - ep) / 2
  const cx = taille / 2
  const cy = taille / 2
  // Arc de 240° ouvert en bas
  const debut = 150
  const etendue = 240
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const arc = (de: number, a: number) => {
    const [x1, y1] = pt(de)
    const [x2, y2] = pt(a)
    const grand = a - de > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${grand} 1 ${x2} ${y2}`
  }
  const fin = debut + etendue * rempli
  const s = STATUTS[statut]
  const hauteur = taille * 0.86

  return (
    <div className="flex flex-col items-center" style={{ width: taille }}>
      <div className="relative" style={{ width: taille, height: hauteur }}>
        <svg width={taille} height={hauteur} viewBox={`0 0 ${taille} ${hauteur}`} aria-hidden>
          <path d={arc(debut, debut + etendue)} fill="none" stroke="var(--color-ligne)" strokeWidth={ep} strokeLinecap="round" />
          {present != null && rempli > 0 && (
            <path d={arc(debut, Math.max(fin, debut + 0.5))} fill="none" stroke={s.couleur} strokeWidth={ep} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: taille * 0.04 }}>
          <div className="chiffres leading-none font-semibold tracking-tight text-ink" style={{ fontSize: taille * 0.25 }}>
            {present ?? '—'}
            <span className="text-muted font-normal" style={{ fontSize: taille * 0.12 }}>
              {' '}/ {cible}
            </span>
          </div>
          <div className="mt-2 chiffres font-medium" style={{ fontSize: taille * 0.075, color: s.texte }}>
            {present == null ? '—' : `${Math.round(ratio * 100)} % de la cible`}
          </div>
        </div>
      </div>
      <div className="-mt-1 text-center font-medium text-ink-2" style={{ fontSize: taille * 0.085 }}>
        {libelle}
      </div>
    </div>
  )
}
