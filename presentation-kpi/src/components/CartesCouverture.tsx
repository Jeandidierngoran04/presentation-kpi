import { Drapeau } from './Drapeau'
import { STATUTS } from './Statut'
import { nomPays } from '../lib/pays'
import type { Statut } from '../lib/types'

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('fr-FR')

/**
 * Couverture des consommables : une carte par article ; dans chaque carte, une barre par pays (nommé),
 * du plus urgent au plus confortable, avec le texte en clair « 6,6 mois de stock · 35 383 unités ».
 * Deux repères verticaux : le seuil de rupture et la cible.
 */
export function CartesCouverture({
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
  const max = 8 // au-delà : barre pleine, valeur exacte écrite
  const pct = (v: number) => `${(Math.min(v, max) / max) * 100}%`
  const colonnes = articles.length <= 2 ? articles.length : articles.length === 4 ? 2 : 3
  const rangees = Math.ceil(articles.length / colonnes)
  const hCarte = (hauteur - 16 * (rangees - 1)) / rangees
  const np = pays.length
  const hBarre = Math.max(14, Math.min(30, (hCarte - 70) / Math.max(np, 1) - 10))

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
      {articles.map((a) => {
        const lignes = pays
          .map((p) => ({ p, v: couverture(p, a.id), s: stock(p, a.id) }))
          .filter((x) => x.v != null || x.s != null)
          .sort((x, y) => (x.v ?? 99) - (y.v ?? 99))
        return (
          <div key={a.id} className="rounded-2xl bg-carte border border-ligne px-5 py-3 flex flex-col overflow-hidden" style={{ height: hCarte }}>
            <div className="text-[22px] font-bold text-ink">{a.libelle}</div>
            <div className="relative flex-1 flex flex-col justify-center gap-2.5 mt-2">
              {lignes.map(({ p, v, s }) => {
                const st = v == null ? 'vide' : statut(p, a.id)
                const S = STATUTS[st]
                return (
                  <div key={p} className="grid items-center gap-3" style={{ gridTemplateColumns: '150px 1fr' }}>
                    <span className="flex items-center gap-2 text-[16px] font-semibold text-ink min-w-0">
                      <Drapeau code={p} taille={15} />
                      <span className="truncate">{nomPays(p)}</span>
                    </span>
                    <div className="min-w-0">
                      <div className="relative rounded-full bg-page" style={{ height: hBarre }}>
                        {/* repères : rupture et cible */}
                        <span className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-alerte/60" style={{ left: pct(alerte) }} />
                        <span className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-ink-2/40" style={{ left: pct(cible) }} />
                        {v != null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(v), background: S.couleur }} />}
                      </div>
                      <div className="mt-0.5 text-[14px] leading-tight">
                        <b style={{ color: v == null ? 'var(--color-muted)' : S.texte }}>{v == null ? 'Couverture inconnue' : `${nf1.format(v)} mois de stock`}</b>
                        {s != null && <span className="text-ink-2"> · {nf0.format(s)} unités</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
