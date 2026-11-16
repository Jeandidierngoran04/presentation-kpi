/**
 * Phrases « À retenir » : ce que l'auditoire doit comprendre d'une diapo, calculé à partir des chiffres.
 * Écrites simplement, sans jargon, pour qu'une diapo se lise sans explication.
 */
import { statut } from '../lib/catalogue'
import { valeur } from '../lib/donnees'
import { fmt, fmtEcart } from '../lib/format'
import { nomPays } from '../lib/pays'
import type { Famille } from '../lib/types'
import { constats, scores, type Ctx } from './contexte'

const liste = (mots: string[]) => (mots.length <= 1 ? mots.join('') : `${mots.slice(0, -1).join(', ')} et ${mots.at(-1)}`)
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export function messageOtd(ctx: Ctx): string | undefined {
  const pays = ctx.pres.pays.filter((p) => valeur(ctx.lignes, p, 'otd', ctx.derniere) != null)
  if (!pays.length) return undefined
  const n = pays.length
  const ok = pays.filter((p) => statut('otd', valeur(ctx.lignes, p, 'otd', ctx.derniere), ctx.cibles, p) === 'bon').length
  const debut = ok === n ? (n === 1 ? 'La cible est atteinte' : 'Tous les pays atteignent leur cible') : ok === 0 ? (n === 1 ? "La cible n'est pas atteinte" : "Aucun pays n'atteint sa cible") : `${ok} pays sur ${n} atteignent leur cible`
  const morceaux = [debut]

  const prec = ctx.periodes.length > 1 ? ctx.periodes.at(-2)! : undefined
  if (prec) {
    const ecarts = pays
      .map((p) => {
        const a = ctx.lignes.find((l) => l.pays === p && l.indicateur === 'otd' && l.periode === prec)?.valeur
        const b = ctx.lignes.find((l) => l.pays === p && l.indicateur === 'otd' && l.periode === ctx.derniere)?.valeur
        return a != null && b != null ? { p, e: b - a } : null
      })
      .filter((x): x is { p: string; e: number } => x != null)
      .sort((a, b) => b.e - a.e)
    const hausse = ecarts[0]
    const baisse = ecarts.at(-1)
    if (hausse && hausse.e > 0) morceaux.push(`${nomPays(hausse.p)} progresse le plus (${fmtEcart(hausse.e, '%')})`)
    if (baisse && baisse.e < 0) morceaux.push(`${nomPays(baisse.p)} recule le plus (${fmtEcart(baisse.e, '%')})`)
  } else if (n > 1) {
    const meilleur = [...pays].sort((a, b) => (valeur(ctx.lignes, b, 'otd', ctx.derniere) ?? 0) - (valeur(ctx.lignes, a, 'otd', ctx.derniere) ?? 0))[0]
    morceaux.push(`meilleur score : ${nomPays(meilleur)} (${fmt(valeur(ctx.lignes, meilleur, 'otd', ctx.derniere), '%')})`)
  }
  return morceaux.join(' · ') + '.'
}

/** Phrase générique pour une rubrique : ce qui est en alerte, sinon ce qui est à surveiller */
export function messageFamille(ctx: Ctx, famille: Famille): string | undefined {
  const cs = constats(ctx).filter((c) => c.famille === famille)
  if (!cs.length) return undefined
  const alertes = cs.filter((c) => c.statut === 'alerte')
  const vigil = cs.filter((c) => c.statut === 'vigilance')
  const decrire = (l: typeof cs) => liste(l.slice(0, 3).map((c) => `${c.libelle.replace(/^Couv\. /, '')} ${nomPays(c.pays)} (${c.valeur})`)) + (l.length > 3 ? '…' : '')
  const fin = (t: string) => (t.endsWith('…') ? t : `${t}.`)
  if (!alertes.length && !vigil.length) return 'Tout est dans la cible.'
  if (!alertes.length) return fin(`Aucune alerte · à surveiller : ${decrire(vigil)}`)
  return fin(`${pluriel(alertes.length, 'alerte')} : ${decrire(alertes)}`)
}

export function messageCouverture(ctx: Ctx): string | undefined {
  const cs = constats(ctx).filter((c) => c.famille === 'consommables')
  if (!cs.length) return undefined
  const alertes = cs.filter((c) => c.statut === 'alerte')
  const vigil = cs.filter((c) => c.statut === 'vigilance')
  const decrire = (l: typeof cs) => liste(l.slice(0, 3).map((c) => `${c.libelle.replace(/^Couv\. /, '')} ${nomPays(c.pays)} (${c.valeur})`))
  if (alertes.length) return `${pluriel(alertes.length, 'article')} à réapprovisionner d'urgence : ${decrire(alertes)}.`
  if (vigil.length) return `Pas de rupture imminente · à commander bientôt : ${decrire(vigil)}.`
  return 'Tous les articles ont assez de stock.'
}

export function messageSynthese(ctx: Ctx): string | undefined {
  const sc = scores(ctx).filter((s) => s.score != null)
  if (!sc.length) return undefined
  const total = sc.reduce((n, s) => n + s.alertes.length, 0)
  if (sc.length === 1) return `${nomPays(sc[0].pays)} : ${sc[0].score} % des indicateurs atteints, ${pluriel(total, 'alerte')}.`
  return `${nomPays(sc[0].pays)} en tête (${sc[0].score} %), ${nomPays(sc.at(-1)!.pays)} à relever (${sc.at(-1)!.score} %) · ${pluriel(total, 'alerte')} au total.`
}
