import { ArrowRight, Lightbulb, MessageSquareText, Repeat2, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { Diapo } from '../components/CadreDiapo'
import { Drapeau } from '../components/Drapeau'
import { STATUTS } from '../components/Statut'
import { date, fmt } from '../lib/format'
import { nomPays } from '../lib/pays'
import { etiquette, scores, type Ctx, type Score } from './contexte'

/* ---------------------------------------------------------------- Palmarès */

function Jalon({ s, compact = false }: { s: Score; compact?: boolean }) {
  const st = s.score == null ? 'vide' : s.score >= 80 ? 'bon' : s.score >= 60 ? 'vigilance' : 'alerte'
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className={`flex-1 rounded-full bg-ligne overflow-hidden ${compact ? 'h-2.5' : 'h-3'}`}>
        <div className="h-full rounded-full" style={{ width: `${s.score ?? 0}%`, background: STATUTS[st].couleur }} />
      </div>
      <span className={`chiffres text-right font-semibold ${compact ? 'w-[62px] text-[20px]' : 'w-[76px] text-[24px]'}`}>{s.score == null ? '—' : `${s.score} %`}</span>
    </div>
  )
}

export function DiapoPalmares({ ctx }: { ctx: Ctx }) {
  const classement = scores(ctx).filter((s) => s.score != null)
  const meilleur = classement[0]
  const aRelever = classement.length > 1 ? classement.at(-1) : undefined
  // Meilleur OTD de chaque période : l'OTD est le seul KPI présent chaque semaine
  const parPeriode = ctx.periodes.map((p) => {
    const otd = ctx.pres.pays
      .map((pays) => ({ pays, v: ctx.lignes.find((l) => l.pays === pays && l.indicateur === 'otd' && l.periode === p)?.valeur ?? null }))
      .filter((x): x is { pays: string; v: number } => x.v != null)
      .sort((a, b) => b.v - a.v)
    return { p, top: otd[0] }
  })
  const nomRythme = ctx.pres.type === 'mensuel' ? 'mois' : 'semaine'

  if (!meilleur)
    return (
      <Diapo surtitre="Classement" titre="Meilleur pays et pays à relever">
        <div className="h-full grid place-items-center text-[26px] text-muted">Aucune donnée à classer.</div>
      </Diapo>
    )

  return (
    <Diapo
      surtitre="Classement"
      titre="Meilleur pays et pays à relever"
      pied={`Score = part des indicateurs atteints (vigilance = ½ point), sur la dernière ${nomRythme}`}
    >
      <div className="h-full grid grid-cols-[1fr_1fr_1.05fr] grid-rows-1 gap-6">
        {/* Meilleur pays */}
        <div className="rounded-3xl p-8 flex flex-col min-h-0 overflow-hidden" style={{ background: STATUTS.bon.doux }}>
          <div className="flex items-center gap-3 text-[20px] font-semibold uppercase tracking-[0.12em]" style={{ color: STATUTS.bon.texte }}>
            <Trophy size={26} strokeWidth={2.3} /> Meilleur pays
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Drapeau code={meilleur.pays} taille={46} />
            <span className="text-[44px] font-bold tracking-tight leading-none">{nomPays(meilleur.pays)}</span>
          </div>
          <div className="mt-5 chiffres text-[80px] font-bold leading-none" style={{ color: STATUTS.bon.texte }}>
            {meilleur.score} %
          </div>
          <div className="mt-2 text-[19px] text-ink-2">
            {meilleur.atteints.length} indicateurs atteints sur {meilleur.evalues}
          </div>
          <div className="mt-auto space-y-2.5 rounded-2xl bg-white/60 p-5">
            <div className="text-[15px] font-semibold uppercase tracking-wider text-ink-2">Points forts</div>
            {meilleur.atteints.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[19px] text-ink">
                <TrendingUp size={19} style={{ color: STATUTS.bon.couleur }} /> {c.libelle} <span className="chiffres text-ink-2">{c.valeur}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pays à relever */}
        <div className="rounded-3xl p-8 flex flex-col min-h-0 overflow-hidden" style={{ background: aRelever ? STATUTS.alerte.doux : '#f1f0ec' }}>
          <div className="flex items-center gap-3 text-[20px] font-semibold uppercase tracking-[0.12em]" style={{ color: STATUTS.alerte.texte }}>
            <TrendingDown size={26} strokeWidth={2.3} /> Suivi et relèvement
          </div>
          {aRelever ? (
            <>
              <div className="mt-6 flex items-center gap-4">
                <Drapeau code={aRelever.pays} taille={46} />
                <span className="text-[44px] font-bold tracking-tight leading-none">{nomPays(aRelever.pays)}</span>
              </div>
              <div className="mt-5 chiffres text-[80px] font-bold leading-none" style={{ color: STATUTS.alerte.texte }}>
                {aRelever.score} %
              </div>
              <div className="mt-2 text-[19px] text-ink-2">
                {aRelever.alertes.length} alerte{aRelever.alertes.length > 1 ? 's' : ''} · {aRelever.vigilances.length} vigilance{aRelever.vigilances.length > 1 ? 's' : ''}
              </div>
              <div className="mt-auto space-y-2.5 rounded-2xl bg-white/60 p-5">
                <div className="text-[15px] font-semibold uppercase tracking-wider text-ink-2">À redresser en priorité</div>
                {[...aRelever.alertes, ...aRelever.vigilances].slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-[19px] text-ink">
                    <ArrowRight size={19} style={{ color: STATUTS.alerte.couleur }} /> {c.libelle} <span className="chiffres text-ink-2">{c.valeur}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 text-[22px] text-ink-2">Un seul pays a des données : pas de comparaison possible.</div>
          )}
        </div>

        {/* Classement par période */}
        <div className={`rounded-3xl bg-carte border border-ligne flex flex-col min-h-0 overflow-hidden ${classement.length > 3 ? 'p-6' : 'p-8'}`}>
          <div className="text-[20px] font-semibold uppercase tracking-[0.12em] text-ink-2">Classement</div>
          {classement.length > 3 ? (
            // Beaucoup de pays : une ligne par pays (rang, drapeau, nom, barre, score)
            <div className="mt-4 space-y-2.5">
              {classement.map((s, i) => (
                <div key={s.pays} className="flex items-center gap-2.5 text-[18px] font-semibold">
                  <span className="chiffres w-5 text-muted">{i + 1}</span>
                  <Drapeau code={s.pays} taille={18} />
                  <span className="w-[118px] truncate">{nomPays(s.pays)}</span>
                  <Jalon s={s} compact />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {classement.map((s, i) => (
                <div key={s.pays}>
                  <div className="flex items-center gap-3 text-[22px] font-semibold mb-2">
                    <span className="chiffres w-7 text-muted">{i + 1}</span>
                    <Drapeau code={s.pays} taille={22} />
                    {nomPays(s.pays)}
                  </div>
                  <div className="pl-10 flex">
                    <Jalon s={s} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {parPeriode.length > 1 && parPeriode.some((x) => x.top) && (
            <div className="mt-auto pt-4 border-t border-ligne">
              <div className="text-[16px] text-muted mb-3">Meilleur OTD par {nomRythme}</div>
              <div className="space-y-2">
                {parPeriode.map(({ p, top }) => {
                  return (
                    <div key={p} className="flex items-center gap-3 text-[19px] whitespace-nowrap">
                      <span className="chiffres font-semibold text-bleu-550 shrink-0">
                        {etiquette(ctx, p)}
                        {ctx.pres.type === 'hebdo' && <span className="font-normal text-muted"> · {date(p).slice(0, 5)}</span>}
                      </span>
                      {top ? (
                        <span className="ml-auto flex items-center gap-2 min-w-0">
                          <Drapeau code={top.pays} taille={18} /> <span className="truncate">{nomPays(top.pays)}</span>
                          <span className="chiffres font-semibold">{fmt(top.v, '%')}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Diapo>
  )
}

/* ---------------------------------------------------------------- Pages rédigées */

function Liste({ items, vide }: { items: { id: string; principal: string; pays?: string; details: string[] }[]; vide: string }) {
  if (!items.length) return <div className="text-[22px] text-muted italic">{vide}</div>
  return (
    <ol className="space-y-3.5">
      {items.slice(0, 7).map((it, i) => (
        <li key={it.id} className="flex items-start gap-4 rounded-2xl bg-carte border border-ligne px-6 py-4">
          <span className="chiffres grid place-items-center w-9 h-9 shrink-0 rounded-full bg-bleu-100 text-bleu-650 text-[18px] font-bold">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[23px] font-medium leading-snug text-ink flex items-center gap-3">
              {it.pays && <Drapeau code={it.pays} taille={20} />}
              <span>{it.principal}</span>
            </div>
            {it.details.length > 0 && <div className="mt-1 text-[17px] text-ink-2">{it.details.join('  ·  ')}</div>}
          </div>
        </li>
      ))}
      {items.length > 7 && <li className="text-[18px] text-ink-2 pl-2">+ {items.length - 7} autres</li>}
    </ol>
  )
}

export function DiapoDivers({ ctx }: { ctx: Ctx }) {
  const n = ctx.pres.notes
  return (
    <Diapo surtitre="Échanges" titre="Divers et axes d'amélioration">
      <div className="h-full grid grid-cols-[0.85fr_1.15fr] gap-8">
        <div className="rounded-3xl bg-page/70 p-7 overflow-hidden">
          <div className="flex items-center gap-3 text-[24px] font-semibold text-ink mb-5">
            <MessageSquareText size={28} className="text-bleu-450" /> Divers
          </div>
          <Liste vide="Aucun point divers." items={(n?.divers ?? []).filter((d) => d.texte.trim()).map((d) => ({ id: d.id, principal: d.texte, details: [] }))} />
        </div>
        <div className="rounded-3xl bg-bleu-100/50 p-7 overflow-hidden">
          <div className="flex items-center gap-3 text-[24px] font-semibold text-ink mb-5">
            <Lightbulb size={28} className="text-bleu-450" /> Axes d'amélioration
          </div>
          <Liste
            vide="Aucun axe d'amélioration saisi."
            items={(n?.axes ?? [])
              .filter((a) => a.texte.trim())
              .map((a) => ({
                id: a.id,
                principal: a.texte,
                pays: a.pays,
                details: [a.responsable && `Responsable : ${a.responsable}`, a.echeance && `Échéance : ${date(a.echeance)}`].filter(Boolean) as string[],
              }))}
          />
        </div>
      </div>
    </Diapo>
  )
}

export function DiapoProblemes({ ctx }: { ctx: Ctx }) {
  const items = (ctx.pres.notes?.problemes ?? []).filter((p) => p.texte.trim())
  return (
    <Diapo surtitre="Récurrences" titre="Problèmes récurrents">
      {items.length === 0 ? (
        <div className="h-full rounded-3xl border-2 border-dashed border-grille grid place-items-center text-[24px] text-muted">
          <span className="flex items-center gap-3">
            <Repeat2 size={30} /> Aucun problème récurrent saisi pour ce mois.
          </span>
        </div>
      ) : (
        <div className="rounded-3xl border border-ligne bg-carte overflow-hidden">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="border-b border-ligne text-[18px] text-muted">
                <th className="py-5 pl-10 font-medium w-[38%]">Problème</th>
                <th className="py-5 px-4 font-medium w-[17%]">Pays</th>
                <th className="py-5 px-4 font-medium w-[13%]">Fréquence</th>
                <th className="py-5 px-4 pr-10 font-medium">Action engagée</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 7).map((p) => (
                <tr key={p.id} className="border-b border-ligne last:border-0 align-top">
                  <td className="py-5 pl-10 text-[23px] font-semibold text-ink">{p.texte}</td>
                  <td className="py-5 px-4 text-[20px]">
                    {p.pays ? (
                      <span className="flex items-center gap-2">
                        <Drapeau code={p.pays} taille={20} /> {nomPays(p.pays)}
                      </span>
                    ) : (
                      <span className="text-muted">Tous</span>
                    )}
                  </td>
                  <td className="py-5 px-4">
                    {p.occurrences && (
                      <span className="chiffres inline-flex rounded-full bg-alerte-doux text-alerte-texte px-3 py-1 text-[19px] font-semibold">{p.occurrences}</span>
                    )}
                  </td>
                  <td className="py-5 px-4 pr-10 text-[20px] text-ink-2">{p.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Diapo>
  )
}

/* ---------------------------------------------------------------- Faits marquants par pays */

export function DiapoCommentaires({ ctx }: { ctx: Ctx }) {
  const com = ctx.pres.notes?.commentaires ?? {}
  const pays = ctx.pres.pays.filter((p) => (com[p] ?? '').trim())
  const n = pays.length
  return (
    <Diapo surtitre="Terrain" titre="Faits marquants par pays">
      {n === 0 ? (
        <div className="h-full rounded-3xl border-2 border-dashed border-grille grid place-items-center text-[24px] text-muted">
          <span className="flex items-center gap-3">
            <MessageSquareText size={30} /> Aucun fait marquant saisi.
          </span>
        </div>
      ) : (
        <div className="h-full grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
          {pays.map((p) => {
            const points = com[p].split('\n').map((x) => x.trim()).filter(Boolean)
            return (
              <div key={p} className="rounded-3xl bg-carte border border-ligne p-7 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center gap-3 text-[28px] font-bold">
                  <Drapeau code={p} taille={32} />
                  {nomPays(p)}
                </div>
                <ul className={`mt-5 space-y-3 ${n > 3 ? 'text-[20px]' : 'text-[24px]'} leading-snug text-ink`}>
                  {points.slice(0, 6).map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-[0.55em] w-2.5 h-2.5 shrink-0 rounded-full bg-bleu-450" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Diapo>
  )
}
