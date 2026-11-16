/**
 * Lecture de la feuille « Donnée » du Google Sheet, telle qu'elle s'affiche :
 *   ligne 1 : KPI | Côte d'Ivoire | Côte d'Ivoire | RDC | RDC | …   (2 colonnes par pays)
 *   ligne 2 : Sous Type | Couverture | Stock | Couverture | Stock | …
 *   puis une ligne par KPI (OTD S1, OTD S2, …, Montures, Lapaire +, Etuis, …, Communication).
 * « OTD S1, S2, S3 » = 1re, 2e, 3e semaine de la feuille « KPI OTD ».
 * Les autres KPI sont rattachés à la dernière semaine OTD remplie, et au dernier mois de « Point mensuel ».
 */
import type { LigneBrute } from './source'

export type Grilles = Record<string, string[][]>

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const MODELES = ['montures', 'standard', 'montures lapaire', 'lapaire +', 'lapaire+', 'montures lapaire +', 'solaires']
const CONSOMMABLES = ['etuis', 'etuis+', 'etuis +', 'sacs cabas', 'sac cabas', 'sprays', 'spray', 'pochette', 'pochettes']

const propre = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim()
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function aUnChiffre(t: unknown) {
  const s = propre(t).toUpperCase()
  if (!s || ['N/A', 'NA', '-', '—'].includes(s)) return false
  return s === 'TOP' || s === 'FLOP' || /\d/.test(s)
}

function dateJMA(t: string) {
  const m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? iso(+m[3], +m[2], +m[1]) : undefined
}

function moisDe(t: string) {
  const s = t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  for (let i = 0; i < MOIS.length; i++) {
    const m = s.match(new RegExp(MOIS[i] + '\\s+(\\d{4})'))
    if (m) return iso(+m[1], i + 1, 1)
  }
  return undefined
}

function lundi(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return iso(x.getFullYear(), x.getMonth() + 1, x.getDate())
}

/** Semaines de « KPI OTD » (ordre des colonnes) et dernière semaine qui a un chiffre. */
function semainesOtd(g?: string[][]) {
  const dates: string[] = []
  let derniere: string | undefined
  if (!g?.length) return { dates, derniere }
  for (let c = 1; c < g[0].length; c++) {
    const d = dateJMA(propre(g[0][c]))
    if (!d) continue
    dates.push(d)
    if (g.slice(1).some((l) => aUnChiffre(l[c]))) derniere = d
  }
  return { dates, derniere }
}

/** OTD mensuel du bloc du haut de « Point mensuel » */
function otdMensuel(g?: string[][]) {
  const res: LigneBrute[] = []
  const moisRemplis: string[] = []
  if (!g?.length) return { res, moisRemplis }
  for (let c = 1; c < g[0].length; c++) {
    const d = moisDe(propre(g[0][c]))
    if (!d) continue
    for (let r = 1; r < g.length; r++) {
      const pays = propre(g[r][0])
      if (!pays) break
      if (aUnChiffre(g[r][c])) {
        res.push({ periode: d, type: 'Mois', pays, indicateur: 'OTD', valeur: propre(g[r][c]) })
        if (!moisRemplis.includes(d)) moisRemplis.push(d)
      }
    }
  }
  return { res, moisRemplis }
}

export function lireFeuilles(f: Grilles): LigneBrute[] {
  const v = f['Donnée'] ?? []
  const { dates, derniere } = semainesOtd(f['KPI OTD'])
  const mensuel = otdMensuel(f['Point mensuel'])
  const res: LigneBrute[] = [...mensuel.res]
  if (v.length < 3) return res

  // Colonnes : un pays = une colonne principale (Couverture / valeur) + éventuellement une colonne Stock
  const cols: { pays: string; principal: number; stock: number }[] = []
  let paysCourant = ''
  for (let c = 1; c < v[0].length; c++) {
    const p = propre(v[0][c]) || paysCourant
    if (!p) continue
    const estStock = propre(v[1]?.[c]).toLowerCase().startsWith('stock')
    if (estStock && p === paysCourant && cols.length) cols[cols.length - 1].stock = c
    else cols.push({ pays: p, principal: c, stock: -1 })
    paysCourant = p
  }

  // Les KPI hors OTD : rattachés à la dernière semaine OTD remplie (dans « Donnée », sinon « KPI OTD »)
  // et au dernier mois de « Point mensuel »
  const datesOtd: string[] = []
  for (let r = 2; r < v.length; r++) {
    const lib = propre(v[r][0])
    const m = lib.toLowerCase().match(/^otd\s*s\s*(\d+)/)
    if (!m) continue
    const d = dateJMA(lib) ?? dates[Number(m[1]) - 1]
    // La dernière semaine de la feuille (même si son OTD n'est pas encore rempli) : c'est la semaine des stocks
    if (d) datesOtd.push(d)
  }
  const semaine = datesOtd.sort().at(-1) ?? derniere ?? lundi()
  const dernierMois = mensuel.moisRemplis.sort().at(-1)
  const ajouter = (pays: string, indicateur: string, valeur: string, ligne: number) => {
    res.push({ ligne, periode: semaine, type: 'Semaine', pays, indicateur, valeur })
    if (dernierMois) res.push({ ligne, periode: dernierMois, type: 'Mois', pays, indicateur, valeur })
  }

  for (let r = 2; r < v.length; r++) {
    const lib = propre(v[r][0])
    if (!lib) continue
    const cle = lib.toLowerCase()
    if (cle.startsWith('recap') || cle.startsWith('sous type')) continue
    const mOtd = cle.match(/^otd\s*s\s*(\d+)/)
    const conso = CONSOMMABLES.includes(cle) || cols.some((k) => k.stock >= 0 && aUnChiffre(v[r][k.stock]))
    for (const k of cols) {
      const val = propre(v[r][k.principal])
      if (mOtd) {
        // La date écrite dans le libellé (« OTD S3 09/11/2026 ») prime sur l'ordre des colonnes de « KPI OTD »
        const d = dateJMA(lib) ?? dates[Number(mOtd[1]) - 1]
        if (d && aUnChiffre(val)) res.push({ ligne: r + 1, periode: d, type: 'Semaine', pays: k.pays, indicateur: 'OTD', valeur: val })
      } else if (MODELES.includes(cle)) {
        if (aUnChiffre(val)) ajouter(k.pays, cle.includes('+') ? 'Lapaire +' : cle === 'solaires' ? 'Solaires' : 'Montures Lapaire', val, r + 1)
      } else if (conso) {
        if (aUnChiffre(val)) ajouter(k.pays, `Couverture ${lib}`, val, r + 1)
        const s = k.stock >= 0 ? propre(v[r][k.stock]) : ''
        if (aUnChiffre(s)) ajouter(k.pays, `Stock ${lib}`, s, r + 1)
      } else if (aUnChiffre(val)) {
        ajouter(k.pays, lib, val, r + 1)
      }
    }
  }
  return res
}
