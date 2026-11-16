import type { Unite } from './types'

const nf = (max: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: max, minimumFractionDigits: 0 })

export function fmt(v: number | null | undefined, unite?: Unite) {
  if (v == null || Number.isNaN(v)) return '—'
  switch (unite) {
    case '%':
      return `${nf(1).format(v)} %`
    case '‰':
      return `${nf(1).format(v)} ‰`
    case 'mois':
      return `${nf(1).format(v)} mois`
    default:
      return nf(1).format(v)
  }
}

export const fmtEcart = (v: number, unite?: Unite) => {
  const signe = v > 0 ? '+' : v < 0 ? '−' : '±'
  const abs = Math.abs(v)
  const suffixe = unite === '%' ? ' pt' : ''
  return `${signe}${nf(1).format(abs)}${suffixe}`
}

const df = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dfCourt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })
const dfMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const dfLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const d = (iso: string) => new Date(iso + 'T00:00:00')
export const date = (iso: string) => df.format(d(iso))
export const dateLongue = (iso: string) => dfLong.format(d(iso))
export const semaine = (iso: string) => `Sem. du ${dfCourt.format(d(iso)).replace('.', '')}`
export const semaineLongue = (iso: string) => `Semaine du ${date(iso)}`
export const mois = (iso: string) => {
  const m = dfMois.format(d(iso))
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** Numéro de semaine ISO */
export function numeroSemaine(iso: string) {
  const t = d(iso)
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
  const s1 = new Date(t.getFullYear(), 0, 4)
  return 1 + Math.round(((t.getTime() - s1.getTime()) / 86400000 - 3 + ((s1.getDay() + 6) % 7)) / 7)
}
