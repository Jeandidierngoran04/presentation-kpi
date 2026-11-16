import type { ReactNode } from 'react'
import type { Famille, Presentation } from '../lib/types'
import { libelleFamille } from '../lib/catalogue'
import { constats, etiquettesPeriodes, periodeEtat, prefixesFamille, scores, ThemeDiapo, type Ctx } from './contexte'
import { DiapoAttention, DiapoGarde, DiapoSynthese } from './Ouverture'
import { DiapoAutres, DiapoConsommables, DiapoKpi, DiapoLivreurs, DiapoOtd, DiapoProduction, DiapoReclamations, DiapoStock } from './Indicateurs'
import { DiapoCommentaires, DiapoDivers, DiapoPalmares, DiapoProblemes } from './Bilan'
import { DiapoFin } from './Fin'

export type DiapoDef = {
  id: string
  titre: string
  rendu: ReactNode
  /** Rien à montrer : la diapo est retirée (sauf si elle a été ajoutée à la main) */
  vide?: boolean
  /** Diapo facultative que l'on peut ajouter ou retirer à la main */
  ajoutable?: boolean
}

/** Diapos facultatives proposées par le bouton « Ajouter une diapo » */
export const DIAPOS_AJOUTABLES = [
  { id: 'commentaires', titre: 'Faits marquants par pays' },
  { id: 'divers', titre: "Divers et axes d'amélioration" },
  { id: 'problemes', titre: 'Problèmes récurrents' },
]

export function construireDiapos(ctx: Ctx): DiapoDef[] {
  const f = ctx.pres.familles
  const mensuel = ctx.pres.type === 'mensuel'
  // Numérotation « KPI 1, KPI 2… » dans l'ordre des diapos (rubriques sans chiffres non numérotées)
  const aDesChiffres = (fam: Famille) => {
    if (fam === 'reclamations') return false
    const prefixes = prefixesFamille(fam)
    const per = fam === 'otd' ? ctx.derniere : periodeEtat(ctx, prefixes)
    return ctx.pres.pays.some((p) =>
      fam === 'otd'
        ? ctx.periodes.some((x) => ctx.lignes.some((l) => l.pays === p && l.indicateur === 'otd' && l.periode === x && l.valeur != null))
        : ctx.lignes.some((l) => l.pays === p && l.valeur != null && l.periode <= per && prefixes.some((pr) => l.indicateur.startsWith(pr))),
    )
  }
  const ordre: Famille[] = ['otd', 'stock', 'consommables', 'production', 'livreurs', 'autres', ...f.filter((x) => x.startsWith('m:')), 'reclamations']
  ctx = { ...ctx, numeros: Object.fromEntries(ordre.filter((x) => f.includes(x) && aDesChiffres(x)).map((x, i) => [x, i + 1])) }

  const notes = ctx.pres.notes
  const cs = constats(ctx)
  const d: DiapoDef[] = [
    { id: 'garde', titre: 'Page de garde', rendu: <DiapoGarde ctx={ctx} /> },
    { id: 'synthese', titre: 'Synthèse', rendu: <DiapoSynthese ctx={ctx} />, vide: cs.length === 0 },
    { id: 'palmares', titre: 'Meilleur pays et pays à relever', rendu: <DiapoPalmares ctx={ctx} />, vide: !scores(ctx).some((s) => s.score != null) },
  ]
  const kpi = (id: Famille, titre: string, rendu: ReactNode) => f.includes(id) && d.push({ id, titre, rendu, vide: !aDesChiffres(id) })
  kpi('otd', 'On-Time Delivery', <DiapoOtd ctx={ctx} />)
  kpi('stock', 'Montures et solaires', <DiapoStock ctx={ctx} />)
  kpi('consommables', 'Couverture', <DiapoConsommables ctx={ctx} />)
  kpi('production', 'Production', <DiapoProduction ctx={ctx} />)
  kpi('livreurs', 'Livreurs', <DiapoLivreurs ctx={ctx} />)
  kpi('autres', 'Autres indicateurs', <DiapoAutres ctx={ctx} />)
  // KPI créés dans Paramètres : une diapo chacun, dans l'ordre choisi
  for (const x of f.filter((x) => x.startsWith('m:'))) kpi(x, libelleFamille(x), <DiapoKpi ctx={ctx} famille={x} />)
  if (f.includes('reclamations')) d.push({ id: 'reclamations', titre: 'Réclamations', rendu: <DiapoReclamations />, vide: true })
  d.push({ id: 'problemes', titre: 'Problèmes récurrents', rendu: <DiapoProblemes ctx={ctx} />, vide: !(notes?.problemes ?? []).some((p) => p.texte.trim()), ajoutable: true })
  d.push({ id: 'attention', titre: "Points d'attention", rendu: <DiapoAttention ctx={ctx} />, vide: !cs.some((c) => c.statut === 'alerte' || c.statut === 'vigilance') })
  d.push({ id: 'commentaires', titre: 'Faits marquants par pays', rendu: <DiapoCommentaires ctx={ctx} />, vide: !Object.values(notes?.commentaires ?? {}).some((t) => t.trim()), ajoutable: true })
  d.push({
    id: 'divers',
    titre: "Divers et axes d'amélioration",
    rendu: <DiapoDivers ctx={ctx} />,
    vide: !(notes?.divers ?? []).some((x) => x.texte.trim()) && !(notes?.axes ?? []).some((x) => x.texte.trim()),
    ajoutable: true,
  })
  d.push({ id: 'fin', titre: 'Merci', rendu: <DiapoFin ctx={ctx} /> })

  const infos = { type: ctx.pres.type, periodes: etiquettesPeriodes(ctx), titre: ctx.pres.titre }
  return d.map((x) => ({
    ...x,
    rendu: (
      <ThemeDiapo.Provider value={infos}>
        <div className={`w-full h-full bg-surface ${mensuel ? 'theme-mensuel' : ''}`}>{x.rendu}</div>
      </ThemeDiapo.Provider>
    ),
  }))
}

/** Diapos à montrer : on retire les vides, sauf celles ajoutées à la main */
export const diaposVisibles = (diapos: DiapoDef[], pres: Presentation) => diapos.filter((d) => !d.vide || (pres.diaposAjoutees ?? []).includes(d.id))
