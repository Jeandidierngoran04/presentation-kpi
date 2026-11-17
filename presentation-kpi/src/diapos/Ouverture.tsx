import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { Diapo } from '../components/CadreDiapo'
import { Drapeau } from '../components/Drapeau'
import { Pastille, STATUTS } from '../components/Statut'
import { libelleFamille, pire } from '../lib/catalogue'
import { date, dateLongue, mois, numeroSemaine, semaineLongue } from '../lib/format'
import { nomPays } from '../lib/pays'
import { constats, type Ctx } from './contexte'
import { messageSynthese } from './messages'

export function periodeTexte(ctx: Ctx) {
  const p = ctx.periodes
  if (ctx.pres.type === 'mensuel') return p.map(mois).join(' · ')
  if (p.length === 1) return `${semaineLongue(p[0])} · S${numeroSemaine(p[0])}`
  return `${p.length} semaines comparées · S${numeroSemaine(p[0])} à S${numeroSemaine(p.at(-1)!)}`
}

function GardeMensuelle({ ctx }: { ctx: Ctx }) {
  const p = ctx.periodes
  const [moisNom, annee] = mois(p.at(-1)!).split(' ')
  return (
    <div className="relative w-full h-full overflow-hidden bg-surface flex">
      <div className="flex-1 flex flex-col justify-between px-24 py-20">
        <div className="flex items-center gap-4 text-[20px] font-semibold uppercase tracking-[0.24em] text-bleu-450">
          <span className="w-12 h-[3px] rounded bg-bleu-450" />
          Revue mensuelle · Supply Chain
        </div>
        <div>
          <div className="text-[34px] font-medium text-ink-2">{ctx.pres.titre}</div>
          <div className="mt-2 text-[150px] leading-[0.95] font-bold tracking-[-0.04em] text-nuit">{moisNom}</div>
          <div className="mt-2 text-[64px] leading-none font-light text-bleu-450 chiffres">{annee}</div>
          {p.length > 1 && <div className="mt-8 text-[24px] text-ink-2">Comparé à {p.slice(0, -1).map(mois).join(', ')}</div>}
        </div>
        <div className="text-[20px] text-muted">{dateLongue(new Date().toISOString().slice(0, 10))}</div>
      </div>
      <div className="w-[470px] shrink-0 bg-nuit text-white flex flex-col justify-center px-14 gap-7 relative overflow-hidden">
        <svg className="absolute -right-40 -bottom-56 opacity-[0.08]" width="460" height="460" viewBox="0 0 460 460" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={30 + i * 30} y={30 + i * 30} width={400 - i * 60} height={400 - i * 60} rx="40" fill="none" stroke="white" strokeWidth="2" />
          ))}
        </svg>
        <div className="text-[16px] font-semibold uppercase tracking-[0.24em] text-white/50">Pays présentés</div>
        {ctx.pres.pays.map((c) => (
          <div key={c} className="relative flex items-center gap-5 text-[30px] font-medium">
            <Drapeau code={c} taille={34} />
            {nomPays(c)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DiapoGarde({ ctx }: { ctx: Ctx }) {
  if (ctx.pres.type === 'mensuel') return <GardeMensuelle ctx={ctx} />
  const p = ctx.periodes
  return (
    <div className="relative w-full h-full overflow-hidden bg-nuit text-white">
      {/* motif discret */}
      <svg className="absolute -right-40 -top-40 opacity-[0.07]" width="900" height="900" viewBox="0 0 900 900" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <circle key={i} cx="450" cy="450" r={60 + i * 48} fill="none" stroke="white" strokeWidth="2" />
        ))}
      </svg>
      <div className="absolute left-0 top-0 h-full w-3 bg-bleu-450" />
      <div className="relative h-full flex flex-col justify-between px-28 py-24">
        <div className="text-[22px] font-semibold uppercase tracking-[0.2em] text-bleu-250">
          {ctx.pres.type === 'hebdo' ? 'Réunion hebdomadaire' : 'Revue mensuelle'} · Supply Chain
        </div>
        <div>
          <h1 className="text-[96px] leading-[1] font-semibold tracking-tight">{ctx.pres.titre}</h1>
          <div className="mt-8 text-[34px] text-white/75">{periodeTexte(ctx)}</div>
          {ctx.pres.type === 'hebdo' && p.length > 1 && (
            <div className="mt-3 text-[24px] text-white/50">
              Semaines du {p.map((x, i) => (i === p.length - 1 ? date(x) : date(x).slice(0, 5))).join(', du ').replace(/, du (?=[^,]*$)/, ' et du ')}
            </div>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {ctx.pres.pays.map((c) => (
              <div key={c} className="flex items-center gap-3 text-[26px] text-white/90">
                <Drapeau code={c} taille={30} />
                {nomPays(c)}
              </div>
            ))}
          </div>
          <div className="text-[22px] text-white/50">{dateLongue(new Date().toISOString().slice(0, 10))}</div>
        </div>
      </div>
    </div>
  )
}

export function DiapoSynthese({ ctx }: { ctx: Ctx }) {
  const liste = constats(ctx)
  // Rubriques sans aucun chiffre : pas de colonne vide
  const familles = ctx.pres.familles.filter((f) => f !== 'reclamations' && liste.some((c) => c.famille === f)).map((id) => ({ id, libelle: libelleFamille(id) }))
  const nb = (s: 'alerte' | 'vigilance' | 'bon') => liste.filter((c) => c.statut === s).length
  return (
    <Diapo
      surtitre="Vue d'ensemble"
      titre="Synthèse par pays"
      legende
      droite={
        <div className="flex gap-3 mt-3">
          {(['alerte', 'vigilance', 'bon'] as const).map((s) => (
            <div key={s} className="rounded-2xl px-6 py-4 text-center min-w-[150px]" style={{ background: STATUTS[s].doux }}>
              <div className="chiffres text-[48px] font-semibold leading-none" style={{ color: STATUTS[s].texte }}>
                {nb(s)}
              </div>
              <div className="mt-2 text-[17px] font-medium" style={{ color: STATUTS[s].texte }}>
                {s === 'bon' ? 'Atteints' : s === 'alerte' ? 'Alertes' : 'Vigilances'}
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className="rounded-3xl border border-ligne bg-carte overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[18px] text-muted border-b border-ligne">
              <th className="py-5 pl-10 font-medium w-[340px]">Pays</th>
              {familles.map((f) => (
                <th key={f.id} className="py-5 px-4 font-medium">
                  {f.libelle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ctx.pres.pays.map((p) => (
              <tr key={p} className="border-b border-ligne last:border-0">
                <td className="py-6 pl-10">
                  <span className="flex items-center gap-4 text-[26px] font-semibold whitespace-nowrap">
                    <Drapeau code={p} taille={30} />
                    {nomPays(p)}
                  </span>
                </td>
                {familles.map((f) => {
                  const cs = liste.filter((c) => c.pays === p && c.famille === f.id)
                  const st = pire(cs.map((c) => c.statut))
                  const nbAlertes = cs.filter((c) => c.statut === 'alerte').length
                  const nbVigil = cs.filter((c) => c.statut === 'vigilance').length
                  // Un seul chiffre dans la rubrique (ex. OTD) : on l'affiche ; sinon le décompte qui compte
                  const libelle =
                    st === 'vide'
                      ? 'Pas de donnée'
                      : cs.length === 1
                        ? cs[0].valeur
                        : nbAlertes
                          ? `${nbAlertes} alerte${nbAlertes > 1 ? 's' : ''}`
                          : nbVigil
                            ? `${nbVigil} à surveiller`
                            : `${cs.length}/${cs.length} OK`
                  return (
                    <td key={f.id} className={ctx.pres.pays.length > 4 ? 'py-3 px-3' : 'py-5 px-3'}>
                      {st === 'vide' ? <span className="text-[26px] text-muted pl-4">—</span> : <Pastille statut={st} taille="lg" libelle={libelle} />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Diapo>
  )
}

export function DiapoAttention({ ctx }: { ctx: Ctx }) {
  const liste = constats(ctx)
  // Un récapitulatif par pays : d'abord ce qui est en alerte, puis ce qui est à surveiller
  const pays = ctx.pres.pays
    .map((p) => {
      const cs = liste.filter((c) => c.pays === p)
      return { p, alertes: cs.filter((c) => c.statut === 'alerte'), vigil: cs.filter((c) => c.statut === 'vigilance'), ok: cs.filter((c) => c.statut === 'bon').length, total: cs.length }
    })
    .filter((x) => x.total > 0)
    .sort((x, y) => y.alertes.length - x.alertes.length || y.vigil.length - x.vigil.length)
  const n = pays.length
  const colonnes = n <= 3 ? n : n === 4 ? 2 : 3
  const dense = n > 3
  const max = dense ? 4 : 7
  return (
    <Diapo surtitre="À traiter" titre="Points d'attention par pays" legende>
      <div className="h-full grid gap-5" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
        {pays.map(({ p, alertes, vigil, ok, total }) => {
          const items = [...alertes, ...vigil]
          const visibles = items.slice(0, max)
          return (
            <div key={p} className="rounded-3xl bg-carte border border-ligne flex flex-col min-h-0 overflow-hidden">
              <div className={`flex items-center justify-between gap-3 border-b border-ligne ${dense ? 'px-5 py-3' : 'px-7 py-5'}`}>
                <span className={`flex items-center gap-3 font-bold text-ink ${dense ? 'text-[21px]' : 'text-[28px]'}`}>
                  <Drapeau code={p} taille={dense ? 22 : 32} />
                  {nomPays(p)}
                </span>
                <span className="flex items-center gap-2">
                  {alertes.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[15px] font-bold" style={{ background: STATUTS.alerte.doux, color: STATUTS.alerte.texte }}>
                      <XCircle size={16} strokeWidth={2.6} /> {alertes.length}
                    </span>
                  )}
                  {vigil.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[15px] font-bold" style={{ background: STATUTS.vigilance.doux, color: STATUTS.vigilance.texte }}>
                      <AlertTriangle size={16} strokeWidth={2.6} /> {vigil.length}
                    </span>
                  )}
                </span>
              </div>
              <ul className={`flex-1 min-h-0 overflow-hidden ${dense ? 'px-5 py-3 space-y-2' : 'px-7 py-5 space-y-3.5'}`}>
                {items.length === 0 && (
                  <li className={`flex items-start gap-3 text-ink ${dense ? 'text-[17px]' : 'text-[21px]'}`}>
                    <CheckCircle2 size={dense ? 20 : 24} className="shrink-0 mt-0.5" style={{ color: STATUTS.bon.couleur }} />
                    Tous les indicateurs sont dans la cible.
                  </li>
                )}
                {visibles.map((c, i) => {
                  const S = STATUTS[c.statut]
                  return (
                    <li key={i} className={`flex items-start gap-3 leading-snug text-ink ${dense ? 'text-[16px]' : 'text-[21px]'}`}>
                      <S.Icone size={dense ? 18 : 23} strokeWidth={2.5} className="shrink-0 mt-[0.15em]" style={{ color: c.statut === 'vigilance' ? S.texte : S.couleur }} />
                      <span>{c.phrase}</span>
                    </li>
                  )
                })}
                {items.length > max && <li className="text-[15px] text-ink-2 pl-8">+ {items.length - max} autre{items.length - max > 1 ? 's' : ''} point{items.length - max > 1 ? 's' : ''}</li>}
              </ul>
              <div className={`border-t border-ligne flex items-center gap-2 text-ink-2 ${dense ? 'px-5 py-2 text-[14px]' : 'px-7 py-3 text-[16px]'}`}>
                <CheckCircle2 size={dense ? 15 : 18} style={{ color: STATUTS.bon.couleur }} />
                {ok} indicateur{ok > 1 ? 's' : ''} sur {total} dans la cible
              </div>
            </div>
          )
        })}
      </div>
    </Diapo>
  )
}
