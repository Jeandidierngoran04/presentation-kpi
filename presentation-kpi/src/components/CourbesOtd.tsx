import { Drapeau } from './Drapeau'
import { STATUTS } from './Statut'
import { fmt, fmtEcart } from '../lib/format'
import { nomPays } from '../lib/pays'
import type { Statut } from '../lib/types'

export type PointOtd = { periode: string; haut: string; bas?: string; valeur: number | null }

/**
 * OTD : une carte par pays avec une courbe en aire.
 * Sur chaque point : la valeur. Entre deux semaines : une pastille ▲/▼ avec l'évolution en points,
 * pour voir d'un coup d'œil s'il y a amélioration ou régression. Cible du pays en pointillé.
 */
export function CourbesOtd({
  pays,
  points,
  cible,
  statut,
  largeur,
  hauteur,
  couleur = '#2a78d6',
}: {
  pays: string[]
  points: (pays: string) => PointOtd[]
  cible: (pays: string) => number
  statut: (pays: string, v: number | null) => Statut
  largeur: number
  hauteur: number
  couleur?: string
}) {
  const n = pays.length
  const colonnes = n <= 3 ? n : n === 4 ? 2 : 3
  const rangees = Math.ceil(n / colonnes)
  const gap = 18
  const lCarte = (largeur - gap * (colonnes - 1)) / colonnes
  const hCarte = (hauteur - gap * (rangees - 1)) / rangees
  const petit = rangees > 1

  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${colonnes}, ${lCarte}px)`, gap }}>
      {pays.map((p) => {
        const pts = points(p)
        const c = cible(p)
        const avec = pts.filter((x) => x.valeur != null) as (PointOtd & { valeur: number })[]
        const dernier = avec.at(-1)
        const st = statut(p, dernier?.valeur ?? null)
        const S = STATUTS[st]
        const evo = avec.length > 1 ? avec.at(-1)!.valeur - avec.at(-2)!.valeur : null

        // --- géométrie du graphique
        const hEntete = petit ? 70 : 96
        const gW = lCarte - 40
        const gH = hCarte - hEntete - 24
        const mx = 34
        const mHaut = petit ? 44 : 58
        const mBas = petit ? 40 : 50
        const valeurs = [...avec.map((x) => x.valeur), c]
        const vMin = Math.max(0, Math.floor((Math.min(...valeurs) - 12) / 10) * 10)
        const vMax = 100
        const x = (i: number) => (pts.length === 1 ? gW / 2 : mx + (i * (gW - 2 * mx)) / (pts.length - 1))
        const y = (v: number) => mHaut + (1 - (v - vMin) / (vMax - vMin)) * (gH - mHaut - mBas)
        const idx = pts.map((pt, i) => ({ ...pt, i })).filter((pt) => pt.valeur != null) as (PointOtd & { i: number; valeur: number })[]
        const ligne = idx.map((pt, k) => `${k ? 'L' : 'M'}${x(pt.i)},${y(pt.valeur)}`).join(' ')
        const aire = idx.length > 1 ? `${ligne} L${x(idx.at(-1)!.i)},${gH - mBas} L${x(idx[0].i)},${gH - mBas} Z` : ''
        const idGrad = `otd-${p}`

        return (
          <div key={p} className="rounded-3xl bg-carte border border-ligne overflow-hidden flex flex-col" style={{ height: hCarte }}>
            {/* en-tête : pays, dernière valeur, évolution, cible */}
            <div className={`flex items-center justify-between gap-3 ${petit ? 'px-5 pt-3' : 'px-6 pt-5'}`} style={{ height: hEntete }}>
              <div className="min-w-0">
                <div className={`flex items-center gap-2.5 font-bold text-ink ${petit ? 'text-[19px]' : 'text-[24px]'}`}>
                  <Drapeau code={p} taille={petit ? 18 : 24} />
                  <span className="truncate">{nomPays(p)}</span>
                </div>
                <div className={`text-ink-2 ${petit ? 'text-[13px]' : 'text-[15px]'}`}>Cible {c} %</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {evo != null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${petit ? 'text-[14px]' : 'text-[17px]'}`}
                    style={{ background: evo >= 0 ? STATUTS.bon.doux : STATUTS.alerte.doux, color: evo >= 0 ? STATUTS.bon.texte : STATUTS.alerte.texte }}
                  >
                    {evo >= 0 ? '▲' : '▼'} {fmtEcart(evo, '%')}
                  </span>
                )}
                <span className={`chiffres font-bold leading-none tracking-tight ${petit ? 'text-[34px]' : 'text-[50px]'}`} style={{ color: st === 'vide' ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                  {fmt(dernier?.valeur, '%')}
                </span>
                <S.Icone size={petit ? 22 : 30} strokeWidth={2.4} style={{ color: st === 'vigilance' ? S.texte : S.couleur }} />
              </div>
            </div>

            {/* courbe */}
            <svg width={gW} height={gH} viewBox={`0 0 ${gW} ${gH}`} className="mx-5" role="img">
              <defs>
                <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={couleur} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={couleur} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <line x1={0} x2={gW} y1={gH - mBas} y2={gH - mBas} stroke="var(--color-base)" strokeWidth={1.5} />
              {/* cible */}
              <line x1={8} x2={gW - 8} y1={y(c)} y2={y(c)} stroke="var(--color-ink)" strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="6 6" />
              <text x={gW - 8} y={y(c) - 6} textAnchor="end" fontSize={petit ? 12 : 14} fill="var(--color-ink-2)">
                cible {c} %
              </text>
              {aire && <path d={aire} fill={`url(#${idGrad})`} />}
              {idx.length > 1 && <path d={ligne} fill="none" stroke={couleur} strokeWidth={petit ? 3 : 4} strokeLinejoin="round" strokeLinecap="round" />}

              {/* évolution entre deux semaines, au milieu du segment */}
              {idx.slice(1).map((pt, k) => {
                const a = idx[k]
                const e = pt.valeur - a.valeur
                const mxs = (x(a.i) + x(pt.i)) / 2
                const mys = (y(a.valeur) + y(pt.valeur)) / 2
                const w = petit ? 78 : 96
                const h = petit ? 24 : 30
                const hausse = e >= 0
                return (
                  <g key={`e-${pt.periode}`} transform={`translate(${mxs - w / 2}, ${mys - h / 2 + (hausse ? 22 : -22)})`}>
                    <rect width={w} height={h} rx={h / 2} fill={hausse ? 'var(--color-bon-doux)' : 'var(--color-alerte-doux)'} stroke={hausse ? 'var(--color-bon)' : 'var(--color-alerte)'} strokeOpacity={0.35} />
                    <text x={w / 2} y={h / 2 + (petit ? 5 : 6)} textAnchor="middle" fontSize={petit ? 13 : 16} fontWeight={700} fill={hausse ? 'var(--color-bon-texte)' : 'var(--color-alerte-texte)'}>
                      {hausse ? '▲' : '▼'} {fmtEcart(e, '%')}
                    </text>
                  </g>
                )
              })}

              {/* points et valeurs */}
              {idx.map((pt, k) => {
                const sp = STATUTS[statut(p, pt.valeur)]
                const der = k === idx.length - 1
                return (
                  <g key={pt.periode}>
                    <circle cx={x(pt.i)} cy={y(pt.valeur)} r={der ? (petit ? 8 : 10) : petit ? 6 : 7} fill={sp.couleur} stroke="var(--color-carte)" strokeWidth={3} />
                    <text
                      x={x(pt.i)}
                      y={y(pt.valeur) - (petit ? 14 : 18)}
                      textAnchor="middle"
                      fontSize={der ? (petit ? 17 : 22) : petit ? 14 : 17}
                      fontWeight={der ? 800 : 600}
                      fill={der ? 'var(--color-ink)' : 'var(--color-ink-2)'}
                      stroke="var(--color-carte)"
                      strokeWidth={5}
                      paintOrder="stroke"
                    >
                      {fmt(pt.valeur, '%')}
                    </text>
                  </g>
                )
              })}

              {/* semaines sous l'axe */}
              {pts.map((pt, i) => (
                <g key={`l-${pt.periode}`}>
                  <text x={x(i)} y={gH - mBas + (petit ? 18 : 22)} textAnchor="middle" fontSize={petit ? 13 : 16} fontWeight={i === pts.length - 1 ? 700 : 500} fill={i === pts.length - 1 ? 'var(--color-ink)' : 'var(--color-ink-2)'}>
                    {pt.haut}
                  </text>
                  {pt.bas && (
                    <text x={x(i)} y={gH - mBas + (petit ? 33 : 41)} textAnchor="middle" fontSize={petit ? 11 : 13} fill="var(--color-muted)">
                      {pt.bas}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
