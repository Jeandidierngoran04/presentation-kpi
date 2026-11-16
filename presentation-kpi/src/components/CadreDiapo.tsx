import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, PencilLine, XCircle } from 'lucide-react'
import { useThemeDiapo } from '../diapos/contexte'

export const LARGEUR = 1600
export const HAUTEUR = 900

/**
 * Chaque diapo est dessinée sur un canevas fixe 1600 × 900 puis mise à l'échelle :
 * le rendu est identique dans le tableau de bord, en plein écran et en PDF.
 */
export function CadreDiapo({ children, ajuster = 'largeur' }: { children: ReactNode; ajuster?: 'largeur' | 'contenir' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const { width, height } = el.getBoundingClientRect()
      setEchelle(ajuster === 'largeur' ? width / LARGEUR : Math.min(width / LARGEUR, height / HAUTEUR))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ajuster])

  return (
    <div
      ref={ref}
      className={ajuster === 'largeur' ? 'relative w-full' : 'relative w-full h-full flex items-center justify-center'}
      style={ajuster === 'largeur' ? { aspectRatio: `${LARGEUR} / ${HAUTEUR}` } : undefined}
    >
      <div
        className="absolute overflow-hidden bg-surface"
        style={{
          width: LARGEUR,
          height: HAUTEUR,
          transform: `scale(${echelle})`,
          transformOrigin: 'top left',
          left: ajuster === 'largeur' ? 0 : `calc(50% - ${(LARGEUR * echelle) / 2}px)`,
          top: ajuster === 'largeur' ? 0 : `calc(50% - ${(HAUTEUR * echelle) / 2}px)`,
          visibility: echelle ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Légende fixe des couleurs, en bas des diapos KPI : on comprend sans explication */
function Legende() {
  const items = [
    { c: 'var(--color-bon)', t: 'Cible atteinte', I: CheckCircle2 },
    { c: 'var(--color-vigilance)', t: 'À surveiller', I: AlertTriangle },
    { c: 'var(--color-alerte)', t: 'Alerte', I: XCircle },
  ]
  return (
    <span className="flex items-center gap-5 text-[16px] text-ink-2 whitespace-nowrap">
      {items.map(({ c, t, I }) => (
        <span key={t} className="flex items-center gap-1.5">
          <I size={18} strokeWidth={2.4} style={{ color: c === 'var(--color-vigilance)' ? 'var(--color-vigilance-texte)' : c }} />
          {t}
        </span>
      ))}
    </span>
  )
}

/** Mise en page commune d'une diapo : en-tête (numéro KPI, titre, phrase à retenir), contenu, pied. Deux habillages : hebdo et mensuel. */
export function Diapo({
  surtitre,
  titre,
  droite,
  children,
  pied,
  numero,
  message,
  legende = false,
  corrections = 0,
  periode,
}: {
  surtitre?: string
  titre: string
  droite?: ReactNode
  children: ReactNode
  pied?: ReactNode
  /** Numéro du KPI : affiché « KPI 1 » */
  numero?: number
  /** Ce qu'il faut retenir, en une phrase */
  message?: ReactNode
  legende?: boolean
  /** Nombre de chiffres corrigés à la main sur cette diapo */
  corrections?: number
  /** Période réellement montrée par cette diapo (sinon : toutes les périodes de la présentation) */
  periode?: string
}) {
  const t = useThemeDiapo()
  const textePeriode = periode ?? t.periodes
  const pastillePeriode = textePeriode && (
    <span className="chiffres inline-flex items-center rounded-full bg-bleu-100 text-bleu-650 px-3.5 py-1 text-[18px] font-semibold tracking-normal normal-case">
      {textePeriode}
    </span>
  )
  const sur = numero ? `KPI ${numero}${surtitre ? ` · ${surtitre}` : ''}` : surtitre
  const phrase = message && (
    <p className="mt-3 text-[25px] leading-snug text-ink-2 max-w-[1180px]">
      <span className="font-semibold text-ink">À retenir : </span>
      {message}
    </p>
  )
  const badge = corrections > 0 && (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-vigilance-doux text-vigilance-texte px-3 py-1 text-[15px] font-medium">
      <PencilLine size={15} /> {corrections} chiffre{corrections > 1 ? 's' : ''} corrigé{corrections > 1 ? 's' : ''} à la main
    </span>
  )
  const basDePage = (
    <div className="flex items-center justify-between gap-6 text-[17px] text-muted">
      <span className="flex items-center gap-4 min-w-0">
        {badge}
        <span className="truncate">{pied}</span>
      </span>
      {legende ? <Legende /> : t.type === 'mensuel' ? <span className="uppercase tracking-[0.18em] text-[14px] font-semibold">{t.titre}</span> : null}
    </div>
  )

  if (t.type === 'mensuel')
    return (
      <div className="w-full h-full flex">
        <div className="w-[88px] shrink-0 bg-nuit flex flex-col items-center justify-between py-12">
          <span className="w-2.5 h-2.5 rounded-full bg-bleu-350" />
          <span className="text-[17px] font-semibold uppercase tracking-[0.3em] text-white/70 whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
            {sur}
          </span>
          <span className="w-8 h-[3px] rounded bg-bleu-350" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col px-16 pt-12 pb-9">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              {numero && <div className="text-[20px] font-bold uppercase tracking-[0.16em] text-bleu-450">KPI {numero}</div>}
              <h2 className="text-[54px] leading-[1.05] font-bold tracking-tight text-nuit">{titre}</h2>
              {phrase}
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              {pastillePeriode}
              {droite}
            </div>
          </div>
          <div className={`flex-1 min-h-0 ${message ? 'mt-6' : 'mt-9'}`}>{children}</div>
          <div className="mt-4">{basDePage}</div>
        </div>
      </div>
    )

  return (
    <div className="w-full h-full flex flex-col px-20 pt-14 pb-10">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          {sur && (
            <div className="flex items-center gap-4 text-[20px] font-semibold uppercase tracking-[0.14em] text-bleu-450">
              {sur}
              {pastillePeriode}
            </div>
          )}
          <h2 className="mt-2 text-[52px] leading-[1.05] font-semibold tracking-tight text-ink">{titre}</h2>
          {phrase}
        </div>
        {droite}
      </div>
      <div className={`flex-1 min-h-0 ${message ? 'mt-6' : 'mt-10'}`}>{children}</div>
      {(pied || legende || corrections > 0) && <div className="mt-5">{basDePage}</div>}
    </div>
  )
}
