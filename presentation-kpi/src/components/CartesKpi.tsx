import { Drapeau } from './Drapeau'
import { STATUTS } from './Statut'
import { fmt } from '../lib/format'
import { nomPays } from '../lib/pays'
import type { Indicateur, Statut, Unite } from '../lib/types'

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** Unité affichée à côté du chiffre, en clair */
export function uniteClaire(u: Unite, valeur?: number) {
  switch (u) {
    case '%':
      return '%'
    case '‰':
      return '‰'
    case 'mois':
      return 'mois'
    case 'modeles':
      return (valeur ?? 2) > 1 ? 'modèles' : 'modèle'
    default:
      return ''
  }
}

/** L'écart à la cible écrit en mots : « 4 au-dessus de la cible », « 30 pt sous la cible », « cible atteinte » */
export function ecartEnMots(ind: Pick<Indicateur, 'sens' | 'unite'>, valeur: number, cible: number) {
  const ecart = valeur - cible
  const u = ind.unite === '%' ? ' pt' : ind.unite === '‰' ? ' ‰' : ind.unite === 'mois' ? ' mois' : ''
  const n = `${nf.format(Math.abs(ecart))}${u}`
  // Objectif zéro (ex. affaires non assemblées) : on parle de ce qu'il reste à résorber
  if (ind.sens === 'bas' && cible === 0) return valeur <= 0 ? 'Objectif zéro atteint' : `${nf.format(valeur)}${u} à résorber`
  if (ind.sens === 'haut') return ecart >= 0 ? (ecart === 0 ? 'Cible atteinte' : `Cible dépassée de ${n}`) : `${n} sous la cible`
  return ecart <= 0 ? (ecart === 0 ? 'Pile sur la cible' : `Dans la cible (${n} de marge)`) : `${n} au-dessus de la cible`
}

/**
 * Grille de cartes « Réalisé / Cible / Écart » : une ligne par indicateur, une colonne par pays.
 * Chaque carte se lit seule : le chiffre, la cible, l'écart en mots, la couleur et l'icône du statut.
 */
export function CartesKpi({
  indicateurs,
  pays,
  valeur,
  cible,
  statut,
  hauteur,
}: {
  indicateurs: Indicateur[]
  pays: string[]
  valeur: (ind: string, pays: string) => number | null
  cible: (ind: string, pays: string) => number
  statut: (ind: string, pays: string) => Statut
  hauteur: number
}) {
  const np = pays.length
  const ni = indicateurs.length
  const hLigne = Math.min(150, (hauteur - 44) / Math.max(ni, 1) - 10)
  const compact = np > 3 || hLigne < 110
  const tailleChiffre = compact ? 30 : 40
  return (
    // Peu de pays : cartes de largeur raisonnable (pas de carte étirée sur toute la diapo)
    <div className="grid gap-x-4 gap-y-2.5" style={{ gridTemplateColumns: np <= 2 ? `260px repeat(${np}, minmax(0, 520px))` : `260px repeat(${np}, minmax(0, 1fr))` }}>
      {/* en-tête des pays */}
      <div />
      {pays.map((p) => (
        <div key={p} className={`flex items-center justify-center gap-2.5 font-bold text-ink ${np > 4 ? 'text-[18px]' : 'text-[22px]'}`}>
          <Drapeau code={p} taille={np > 4 ? 18 : 24} />
          <span className="truncate">{nomPays(p)}</span>
        </div>
      ))}

      {indicateurs.map((ind) => (
        <div key={ind.id} className="contents">
          <div className="flex flex-col justify-center pr-2" style={{ height: hLigne }}>
            <div className="text-[23px] font-bold leading-tight text-ink">{ind.libelle}</div>
            <div className="text-[15px] text-ink-2 mt-1">
              {ind.sens === 'haut' ? 'Plus c’est haut, mieux c’est' : 'Plus c’est bas, mieux c’est'}
              {ind.unite === '‰' ? ' · pour 1 000 montages' : ''}
            </div>
          </div>
          {pays.map((p) => {
            const v = valeur(ind.id, p)
            const c = cible(ind.id, p)
            const st = statut(ind.id, p)
            const S = STATUTS[st]
            if (v == null)
              return (
                <div key={p} className="rounded-2xl bg-page/60 grid place-items-center text-[28px] text-muted/70" style={{ height: hLigne }}>
                  —
                </div>
              )
            return (
              <div key={p} className="rounded-2xl bg-carte border border-ligne flex flex-col justify-center px-4 overflow-hidden" style={{ height: hLigne, borderLeft: `8px solid ${S.couleur}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="chiffres font-bold leading-none tracking-tight text-ink" style={{ fontSize: tailleChiffre }}>
                    {fmt(v, ind.unite === 'modeles' || ind.unite === 'nb' || ind.unite === 'note' ? undefined : ind.unite)}
                    {(ind.unite === 'modeles' || ind.unite === 'nb') && (
                      <span className="text-[15px] font-medium text-ink-2"> {ind.unite === 'nb' ? '' : uniteClaire(ind.unite, v)}</span>
                    )}
                  </span>
                  <S.Icone size={compact ? 22 : 26} strokeWidth={2.4} style={{ color: st === 'vigilance' ? S.texte : S.couleur }} />
                </div>
                <div className={`mt-1.5 font-semibold leading-snug ${compact ? 'text-[14px]' : 'text-[16px]'}`} style={{ color: S.texte }}>
                  {ecartEnMots(ind, v, c)}
                </div>
                <div className={`text-ink-2 ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
                  {ind.sens === 'bas' && c === 0 ? 'Objectif : 0' : <>Cible {ind.sens === 'haut' ? '≥' : '≤'} {fmt(c, ind.unite === 'modeles' || ind.unite === 'nb' || ind.unite === 'note' ? undefined : ind.unite)}</>}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
