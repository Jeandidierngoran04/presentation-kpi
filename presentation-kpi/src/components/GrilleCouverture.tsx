import { Drapeau } from './Drapeau'
import { STATUTS } from './Statut'
import { nomPays } from '../lib/pays'
import type { Statut } from '../lib/types'

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('fr-FR')

/**
 * Couverture des consommables : pays alignés en haut, articles à gauche (du haut vers le bas).
 * Dans chaque case : la couverture en haut (pastille colorée, en mois), la quantité en stock en gros dessous.
 */
export function GrilleCouverture({
  articles,
  pays,
  couverture,
  stock,
  statut,
  alerte,
  cible,
  hauteur,
}: {
  articles: { id: string; libelle: string }[]
  pays: string[]
  couverture: (pays: string, article: string) => number | null
  stock: (pays: string, article: string) => number | null
  statut: (pays: string, article: string) => Statut
  alerte: number
  cible: number
  hauteur: number
}) {
  const np = pays.length
  const na = articles.length
  const hLigne = Math.min(118, (hauteur - 52) / Math.max(na, 1) - 10)
  const compact = np > 3
  const largeurCase = np <= 2 ? 'minmax(0, 470px)' : 'minmax(0, 1fr)'

  return (
    <div className="grid gap-x-4 gap-y-2.5 items-stretch" style={{ gridTemplateColumns: `220px repeat(${np}, ${largeurCase})` }}>
      <div className="flex items-end pb-1 text-[15px] text-ink-2 leading-snug">
        Couverture en haut,
        <br />
        quantité en stock en bas
      </div>
      {pays.map((p) => (
        <div key={p} className={`flex items-center justify-center gap-2.5 font-bold text-ink pb-1 ${np > 4 ? 'text-[18px]' : 'text-[23px]'}`}>
          <Drapeau code={p} taille={np > 4 ? 18 : 26} />
          <span className="truncate">{nomPays(p)}</span>
        </div>
      ))}

      {articles.map((a) => (
        <div key={a.id} className="contents">
          <div className="flex items-center text-[24px] font-bold text-ink" style={{ height: hLigne }}>
            {a.libelle}
          </div>
          {pays.map((p) => {
            const v = couverture(p, a.id)
            const s = stock(p, a.id)
            if (v == null && s == null)
              return (
                <div key={p} className="rounded-2xl bg-page/60 grid place-items-center text-[28px] text-muted/70" style={{ height: hLigne }}>
                  —
                </div>
              )
            const st = v == null ? 'vide' : statut(p, a.id)
            const S = STATUTS[st]
            const mention = v == null ? '' : v <= alerte ? 'Rupture proche' : v < cible ? 'À commander' : 'Stock suffisant'
            return (
              <div
                key={p}
                className={`rounded-2xl bg-carte border border-ligne flex flex-col justify-center overflow-hidden ${compact ? 'px-3' : 'px-5'}`}
                style={{ height: hLigne, borderTop: `6px solid ${v == null ? 'var(--color-base)' : S.couleur}` }}
              >
                {/* couverture en haut */}
                <div className="flex items-center justify-between gap-2">
                  {v == null ? (
                    <span className="text-[15px] text-muted">Couverture —</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold whitespace-nowrap" style={{ background: S.doux, color: S.texte, fontSize: compact ? 14 : 17 }}>
                      <S.Icone size={compact ? 14 : 16} strokeWidth={2.6} />
                      {nf1.format(v)} mois
                    </span>
                  )}
                  {!compact && v != null && <span className="text-[14px] font-medium" style={{ color: S.texte }}>{mention}</span>}
                </div>
                {/* quantité en gros */}
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="chiffres font-bold leading-none tracking-tight text-ink" style={{ fontSize: compact ? 26 : 34 }}>
                    {s == null ? '—' : nf0.format(s)}
                  </span>
                  {s != null && <span className="text-[15px] text-ink-2">unités</span>}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
