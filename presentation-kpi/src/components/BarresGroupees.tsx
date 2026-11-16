import { STATUTS } from './Statut'
import { fmt } from '../lib/format'
import { nomPays } from '../lib/pays'
import type { Statut, Unite } from '../lib/types'

const DRAPEAUX = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>
export const urlDrapeau = (code: string) => DRAPEAUX[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]

export type Serie = { id: string; haut: string; bas?: string }

/**
 * Graphique lisible sans légende : un groupe de barres par pays, la période écrite SOUS chaque barre,
 * la valeur AU-DESSUS, la couleur = statut par rapport à la cible, la cible du pays en pointillé,
 * et sous le groupe : drapeau, nom du pays et sa cible.
 * Dessiné en SVG natif : rendu identique à l'écran, en plein écran et à l'export PowerPoint / PDF.
 */
export function BarresGroupees({
  largeur,
  hauteur,
  pays,
  series,
  valeur,
  statut,
  cible,
  unite,
  echelle = 'auto',
  taille = 'normal',
}: {
  largeur: number
  hauteur: number
  pays: string[]
  series: Serie[]
  valeur: (pays: string, serie: string) => number | null
  statut: (pays: string, serie: string) => Statut
  cible?: (pays: string) => number | undefined
  unite?: Unite
  /** « pourcent » : axe de 0 à 100 % ; « auto » : selon les valeurs et les cibles */
  echelle?: 'pourcent' | 'auto'
  taille?: 'normal' | 'petit'
}) {
  const petit = taille === 'petit'
  const ng = Math.max(pays.length, 1)
  const ns = Math.max(series.length, 1)
  const hBas = (series.some((s) => s.bas) ? 46 : 28) + (petit ? 44 : 62) // libellés de période + pays/cible
  const hHaut = petit ? 30 : 38
  const zone = hauteur - hBas - hHaut
  const toutes = pays.flatMap((p) => series.map((s) => valeur(p, s.id) ?? 0))
  const cibles = pays.map((p) => cible?.(p) ?? 0)
  const max = echelle === 'pourcent' ? Math.max(100, ...toutes) : Math.max(1, ...toutes, ...cibles) * 1.12
  const y = (v: number) => hHaut + zone - (Math.max(0, v) / max) * zone

  const largeurGroupe = largeur / ng
  const espace = petit ? 6 : 10
  const barre = Math.min(petit ? 64 : 96, (largeurGroupe * 0.78 - espace * (ns - 1)) / ns)
  const largeurBarres = barre * ns + espace * (ns - 1)
  const tailleValeur = petit ? 17 : ns * ng > 12 ? 17 : 22
  const tailleSerie = petit ? 13 : 15
  const taillePays = petit ? 17 : ng > 4 ? 19 : 22

  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} role="img">
      {/* repères discrets */}
      {(echelle === 'pourcent' ? [25, 50, 75, 100] : [max / 3, (2 * max) / 3]).map((v) => (
        <line key={v} x1={0} x2={largeur} y1={y(v)} y2={y(v)} stroke="var(--color-grille)" strokeWidth={1} />
      ))}
      {echelle === 'pourcent' &&
        [50, 100].map((v) => (
          <text key={v} x={0} y={y(v) - 6} fontSize={13} fill="var(--color-muted)">
            {v} %
          </text>
        ))}
      <line x1={0} x2={largeur} y1={hHaut + zone} y2={hHaut + zone} stroke="var(--color-base)" strokeWidth={1.5} />

      {pays.map((p, g) => {
        const x0 = g * largeurGroupe + (largeurGroupe - largeurBarres) / 2
        const c = cible?.(p)
        const nom = nomPays(p)
        const url = urlDrapeau(p)
        const centre = g * largeurGroupe + largeurGroupe / 2
        const largeurNom = nom.length * taillePays * 0.6 + taillePays * 1.33 + 8
        return (
          <g key={p}>
            {series.map((s, i) => {
              const v = valeur(p, s.id)
              const st = statut(p, s.id)
              const x = x0 + i * (barre + espace)
              const yy = v == null ? hHaut + zone : y(v)
              return v == null ? null : (
                <rect key={`b-${s.id}`} x={x} y={yy} width={barre} height={Math.max(2, hHaut + zone - yy)} rx={5} fill={st === 'vide' ? 'var(--color-base)' : STATUTS[st].couleur} opacity={i === ns - 1 ? 1 : 0.5} />
              )
            })}
            {/* cible du pays : sous les chiffres */}
            {c != null && c > 0 && (
              <line x1={x0 - 8} x2={x0 + largeurBarres + 8} y1={y(c)} y2={y(c)} stroke="var(--color-ink)" strokeWidth={2} strokeDasharray="7 5" opacity={0.7} />
            )}
            {series.map((s, i) => {
              const v = valeur(p, s.id)
              const x = x0 + i * (barre + espace)
              const derniere = i === ns - 1
              const yy = v == null ? hHaut + zone : y(v)
              return (
                <g key={s.id}>
                  <text
                    x={x + barre / 2}
                    y={v == null ? hHaut + zone - 8 : yy - 8}
                    textAnchor="middle"
                    fontSize={v == null ? tailleSerie : derniere ? tailleValeur : tailleValeur - 3}
                    fontWeight={derniere ? 700 : 600}
                    fill={v == null ? 'var(--color-muted)' : derniere ? 'var(--color-ink)' : 'var(--color-ink-2)'}
                    stroke="var(--color-surface)"
                    strokeWidth={5}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                  >
                    {v == null ? '—' : fmt(v, unite === '%' || unite === '‰' || unite === 'mois' ? unite : undefined)}
                  </text>
                  {/* période écrite sous la barre */}
                  <text x={x + barre / 2} y={hHaut + zone + 20} textAnchor="middle" fontSize={tailleSerie} fontWeight={derniere ? 700 : 500} fill={derniere ? 'var(--color-ink)' : 'var(--color-ink-2)'}>
                    {s.haut}
                  </text>
                  {s.bas && (
                    <text x={x + barre / 2} y={hHaut + zone + 38} textAnchor="middle" fontSize={tailleSerie - 2} fill="var(--color-muted)">
                      {s.bas}
                    </text>
                  )}
                </g>
              )
            })}
            {/* pays + cible sous le groupe */}
            <g transform={`translate(${Math.max(0, Math.min(largeur - largeurNom, centre - largeurNom / 2))}, ${hauteur - (petit ? 40 : 56)})`}>
              {url && <image href={url} x={0} y={0} width={taillePays * 1.33} height={taillePays} preserveAspectRatio="none" />}
              <text x={taillePays * 1.33 + 8} y={taillePays * 0.84} fontSize={taillePays} fontWeight={700} fill="var(--color-ink)">
                {nom}
              </text>
            </g>
            {c != null && (
              <text x={centre} y={hauteur - (petit ? 6 : 10)} textAnchor="middle" fontSize={petit ? 13 : 15} fill="var(--color-ink-2)">
                cible {fmt(c, unite === 'modeles' ? undefined : unite)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
