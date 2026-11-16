import { STATUTS } from './Statut'
import { urlDrapeau } from './BarresGroupees'
import { fmt } from '../lib/format'
import type { Statut } from '../lib/types'

/**
 * Couverture en mois : une ligne par article, une échelle commune de 0 à N mois,
 * zone rouge (≤ seuil d'alerte), zone orange (jusqu'à la cible), zone verte au-delà.
 * Chaque pays = un point (drapeau + valeur) placé sur l'échelle : on voit d'un coup d'œil qui doit réapprovisionner.
 */
export function EchelleCouverture({
  largeur,
  hauteur,
  articles,
  pays,
  valeur,
  statut,
  alerte,
  cible,
}: {
  largeur: number
  hauteur: number
  articles: { id: string; libelle: string }[]
  pays: string[]
  valeur: (pays: string, article: string) => number | null
  statut: (pays: string, article: string) => Statut
  alerte: number
  cible: number
}) {
  const gauche = 190
  const droite = 30
  const haut = 46
  const zoneL = largeur - gauche - droite
  const toutes = pays.flatMap((p) => articles.map((a) => valeur(p, a.id) ?? 0))
  // Échelle plafonnée à 8 mois : la zone utile (0 à 2 mois) reste lisible ; au-delà, le point est posé au bout avec « + »
  const max = Math.max(cible * 2, Math.min(8, Math.ceil(Math.max(...toutes, cible * 2) + 0.5)))
  const x = (v: number) => gauche + (Math.min(v, max) / max) * zoneL
  const hLigne = (hauteur - haut) / Math.max(articles.length, 1)
  const graduations = Array.from({ length: max + 1 }, (_, i) => i).filter((i) => max <= 8 || i % 2 === 0)

  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} role="img">
      {/* zones */}
      <rect x={x(0)} y={haut - 8} width={x(alerte) - x(0)} height={hauteur - haut + 8} fill={STATUTS.alerte.doux} />
      <rect x={x(alerte)} y={haut - 8} width={x(cible) - x(alerte)} height={hauteur - haut + 8} fill={STATUTS.vigilance.doux} />
      <rect x={x(cible)} y={haut - 8} width={x(max) - x(cible)} height={hauteur - haut + 8} fill={STATUTS.bon.doux} opacity={0.55} />
      {/* légende des zones, sur une ligne, sans chevauchement */}
      {[
        { t: `Rupture (≤ ${fmt(alerte)} mois)`, f: STATUTS.alerte.couleur, c: 'var(--color-alerte-texte)' },
        { t: `À commander (${fmt(alerte)} à ${fmt(cible)} mois)`, f: STATUTS.vigilance.couleur, c: 'var(--color-vigilance-texte)' },
        { t: `Stock suffisant (> ${fmt(cible)} mois)`, f: STATUTS.bon.couleur, c: 'var(--color-bon-texte)' },
      ].map((z, i) => (
        <g key={z.t} transform={`translate(${gauche + i * 330}, 6)`}>
          <rect x={0} y={2} width={16} height={16} rx={4} fill={z.f} />
          <text x={24} y={16} fontSize={17} fontWeight={700} fill={z.c}>
            {z.t}
          </text>
        </g>
      ))}
      {graduations.map((g) => (
        <g key={g}>
          <line x1={x(g)} x2={x(g)} y1={haut - 8} y2={hauteur} stroke="var(--color-grille)" strokeWidth={1} />
          <text x={x(g)} y={hauteur - 4} textAnchor="middle" fontSize={13} fill="var(--color-muted)">
            {g === max ? `${g}+ mois` : g}
          </text>
        </g>
      ))}

      {articles.map((a, i) => {
        const yc = haut + hLigne * i + hLigne / 2 - 6
        const points = pays
          .map((p) => ({ p, v: valeur(p, a.id) }))
          .filter((d): d is { p: string; v: number } => d.v != null)
          .sort((m, n) => m.v - n.v)
        return (
          <g key={a.id}>
            <line x1={gauche} x2={largeur - droite} y1={yc} y2={yc} stroke="var(--color-base)" strokeWidth={1.5} />
            <text x={gauche - 18} y={yc + 7} textAnchor="end" fontSize={22} fontWeight={700} fill="var(--color-ink)">
              {a.libelle}
            </text>
            {points.map((d, k) => {
              const st = statut(d.p, a.id)
              const cx = x(d.v)
              // décalage vertical alterné quand deux pays sont proches
              const proche = k > 0 && Math.abs(x(points[k - 1].v) - cx) < 70
              const dy = proche && k % 2 === 1 ? 26 : 0
              const url = urlDrapeau(d.p)
              return (
                <g key={d.p}>
                  <circle cx={cx} cy={yc} r={11} fill={STATUTS[st].couleur} stroke="var(--color-surface)" strokeWidth={3} />
                  <g transform={`translate(${Math.min(cx - 34, largeur - 90)}, ${yc - 40 + dy * 2.4})`}>
                    {url && <image href={url} x={0} y={2} width={20} height={15} preserveAspectRatio="none" />}
                    <text x={25} y={15} fontSize={16} fontWeight={700} fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth={4} paintOrder="stroke">
                      {fmt(d.v)}
                      {d.v > max ? '+' : ''}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
