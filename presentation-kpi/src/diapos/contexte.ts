import { createContext, useContext } from 'react'
import { ARTICLES, CATALOGUE, cibleDe, indicateur, statut } from '../lib/catalogue'
import { valeur } from '../lib/donnees'
import { fmt, mois, numeroSemaine } from '../lib/format'
import { nomPays } from '../lib/pays'
import type { Cibles, Famille, Ligne, Presentation, Statut } from '../lib/types'

export type Ctx = {
  pres: Presentation
  /** Lignes du bon rythme uniquement (semaine pour hebdo, mois pour mensuel) */
  lignes: Ligne[]
  cibles: Cibles
  periodes: string[]
  /** Période la plus récente de la présentation */
  derniere: string
  paysAvecDonnees: (prefixes: string[]) => string[]
  paysSansDonnees: (prefixes: string[]) => string[]
  /** Chiffres saisis à la main (corrections) */
  saisies: Ligne[]
  /** Numéro « KPI n » de chaque rubrique, dans l'ordre des diapos */
  numeros: Partial<Record<Famille, number>>
}

export const PREFIXES: Record<Famille, string[]> = {
  otd: ['otd'],
  stock: ['stock.'],
  consommables: ['couverture.'],
  production: ['prod.'],
  livreurs: ['liv.'],
  autres: ['perso.'],
  reclamations: ['recl.'],
}

export function creerCtx(pres: Presentation, toutes: Ligne[], cibles: Cibles, saisies: Ligne[] = []): Ctx {
  const type = pres.type === 'hebdo' ? 'semaine' : 'mois'
  const lignes = toutes.filter((x) => x.type === type)
  const periodes = periodesDe(pres, lignes)
  const derniere = periodes.at(-1) ?? ''
  const avec = (prefixes: string[]) =>
    pres.pays.filter((p) =>
      lignes.some(
        (x) => x.pays === p && x.valeur != null && x.periode <= derniere && prefixes.some((pr) => x.indicateur.startsWith(pr)),
      ),
    )
  return {
    pres,
    lignes,
    cibles,
    periodes,
    derniere,
    paysAvecDonnees: avec,
    paysSansDonnees: (prefixes) => pres.pays.filter((p) => !avec(prefixes).includes(p)),
    saisies: saisies.filter((x) => x.type === type),
    numeros: {},
  }
}

/**
 * Période d'un « état » (stocks, couverture, production, livraison) : la dernière semaine (ou le dernier mois)
 * pour laquelle ces indicateurs ont des chiffres. Ces données ne sont pas historisées dans le Sheet.
 */
export function periodeEtat(ctx: Ctx, prefixes: string[]): string {
  const dates = ctx.lignes.filter((x) => x.valeur != null && prefixes.some((p) => x.indicateur.startsWith(p))).map((x) => x.periode)
  return dates.length ? dates.sort().at(-1)! : ctx.derniere
}

/** Préfixes des indicateurs d'une rubrique (rubriques du Sheet ou KPI créés dans Paramètres) */
export const prefixesFamille = (f: Famille): string[] => PREFIXES[f] ?? CATALOGUE.filter((i) => i.famille === f).map((i) => i.id)

/** Nombre de chiffres corrigés à la main visibles sur une diapo */
export function nbCorrections(ctx: Ctx, prefixes: string[]) {
  return ctx.saisies.filter(
    (x) => ctx.pres.pays.includes(x.pays) && ctx.periodes.includes(x.periode) && prefixes.some((p) => x.indicateur.startsWith(p)),
  ).length
}

/** Périodes affichées : celles choisies, ou en mode automatique les N dernières qui ont des chiffres */
export function periodesDe(pres: Presentation, lignes: Ligne[]): string[] {
  if (!pres.glissant) return [...pres.periodes].sort()
  const type = pres.type === 'hebdo' ? 'semaine' : 'mois'
  const dispo = [...new Set(lignes.filter((x) => x.type === type && x.valeur != null).map((x) => x.periode))].sort()
  return dispo.slice(-pres.glissant)
}

/** Libellé court d'une période : S45 ou Octobre 2026 */
export const etiquette = (ctx: Ctx, p: string) => (ctx.pres.type === 'mensuel' ? mois(p) : `S${numeroSemaine(p)}`)
export const etiquettesPeriodes = (ctx: Ctx) => ctx.periodes.map((p) => etiquette(ctx, p)).join(' · ')

/* --------------------------------------------- Thème transmis aux diapos */

export type InfosDiapo = { type: Presentation['type']; periodes: string; titre: string }
export const ThemeDiapo = createContext<InfosDiapo>({ type: 'hebdo', periodes: '', titre: '' })
export const useThemeDiapo = () => useContext(ThemeDiapo)

/* --------------------------------------------- Constats et classement */

export type Constat = {
  pays: string
  famille: Famille
  statut: Statut
  libelle: string
  valeur: string
  cible: string
}

/** Tous les indicateurs évalués pour une période (la plus récente par défaut). */
export function constats(ctx: Ctx, periodeDemandee?: string): Constat[] {
  const res: Constat[] = []
  for (const pays of ctx.pres.pays) {
    for (const fam of ctx.pres.familles) {
      // OTD : période demandée (ou la dernière) ; autres rubriques : leur dernière semaine connue
      const periode = periodeDemandee ?? (fam === 'otd' ? ctx.derniere : periodeEtat(ctx, prefixesFamille(fam)))
      if (fam === 'consommables') {
        for (const a of ARTICLES) {
          const id = `couverture.${a.id}`
          const v = valeur(ctx.lignes, pays, id, periode)
          if (v == null) continue
          const c = cibleDe(ctx.cibles, 'couverture', pays)
          res.push({
            pays,
            famille: fam,
            statut: statut(id, v, ctx.cibles, pays),
            libelle: `Couv. ${a.libelle}`,
            valeur: fmt(v, 'mois'),
            cible: `alerte à ${fmt(c.alerte, 'mois')}`,
          })
        }
        continue
      }
      for (const ind of CATALOGUE.filter((i) => i.famille === fam)) {
        const v = valeur(ctx.lignes, pays, ind.id, periode)
        if (v == null) continue
        const c = cibleDe(ctx.cibles, ind.id, pays)
        res.push({
          pays,
          famille: fam,
          statut: statut(ind.id, v, ctx.cibles, pays),
          libelle: ind.libelle,
          valeur: ind.unite === 'modeles' ? `${v} / ${c.cible}` : fmt(v, ind.unite),
          cible: ind.unite === 'modeles' ? `cible ${c.cible} modèles` : `cible ${ind.sens === 'haut' ? '≥' : '≤'} ${fmt(c.cible, ind.unite)}`,
        })
      }
    }
  }
  return res
}

export type Score = {
  pays: string
  /** 0 à 100 : atteint = 1 point, vigilance = 0,5, alerte = 0 */
  score: number | null
  evalues: number
  alertes: Constat[]
  vigilances: Constat[]
  atteints: Constat[]
}

export function scores(ctx: Ctx, periode?: string): Score[] {
  const cs = constats(ctx, periode)
  return ctx.pres.pays
    .map((p) => {
      const mine = cs.filter((c) => c.pays === p)
      const pts = mine.reduce((s, c) => s + (c.statut === 'bon' ? 1 : c.statut === 'vigilance' ? 0.5 : 0), 0)
      return {
        pays: p,
        score: mine.length ? Math.round((pts / mine.length) * 100) : null,
        evalues: mine.length,
        alertes: mine.filter((c) => c.statut === 'alerte'),
        vigilances: mine.filter((c) => c.statut === 'vigilance'),
        atteints: mine.filter((c) => c.statut === 'bon'),
      }
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.alertes.length - b.alertes.length)
}

export const libellePays = nomPays
export { indicateur }
