import { ArrowDownRight, ArrowUpRight, Inbox, Minus } from 'lucide-react'
import { Diapo } from '../components/CadreDiapo'
import { Drapeau } from '../components/Drapeau'
import { Jauge } from '../components/Jauge'
import { BarresGroupees, type Serie } from '../components/BarresGroupees'
import { GrilleCouverture } from '../components/GrilleCouverture'
import { CartesKpi } from '../components/CartesKpi'
import { CourbesOtd } from '../components/CourbesOtd'
import { Pastille, Point, STATUTS } from '../components/Statut'
import { ARTICLES, CATALOGUE, cibleDe, libelleFamille, statut } from '../lib/catalogue'
import { valeur } from '../lib/donnees'
import { date, fmt, fmtEcart, mois, numeroSemaine, semaine } from '../lib/format'
import { nomPays } from '../lib/pays'
import type { Famille, Statut } from '../lib/types'
import { nbCorrections, periodeEtat, PREFIXES, type Ctx } from './contexte'
import { messageCouverture, messageFamille, messageOtd } from './messages'


function SansDonnees(_: { ctx: Ctx; famille: Famille }) {
  // Les pays sans chiffres sont simplement retirés du visuel : pas de mention « pas de donnée »
  return null

}

function Vide({ texte = 'Aucune donnée pour les pays et la période choisis.' }: { texte?: string }) {
  return (
    <div className="h-full rounded-3xl border-2 border-dashed border-grille flex flex-col items-center justify-center gap-4 text-muted">
      <Inbox size={56} strokeWidth={1.5} />
      <div className="text-[26px]">{texte}</div>
    </div>
  )
}

const libPeriode = (ctx: Ctx, p: string) => (ctx.pres.type === 'mensuel' ? mois(p) : semaine(p))

/** Icône de statut seule (mode dense) : la forme porte le sens, pas seulement la couleur */
function IconeStatut({ statut: s, taille = 22 }: { statut: Statut; taille?: number }) {
  const S = STATUTS[s]
  return <S.Icone size={taille} strokeWidth={2.4} style={{ color: s === 'vigilance' ? S.texte : S.couleur }} aria-label={S.libelle} />
}


/** « S45 · semaine du 02/11 » ou « Octobre 2026 » : la seule période montrée par une diapo d'état */
export const periodeEnClair = (ctx: Ctx, d: string) =>
  ctx.pres.type === 'mensuel' ? mois(d) : `S${numeroSemaine(d)} · semaine du ${date(d).slice(0, 5)}`
export const periodeDerniere = (ctx: Ctx) => periodeEnClair(ctx, ctx.derniere)

/* ---------------------------------------------------------------- OTD */

/** Périodes en clair sous chaque barre : « S45 » et « du 02/11 », ou le mois */
export function seriesPeriodes(ctx: Ctx, periodes = ctx.periodes): Serie[] {
  return periodes.map((p) =>
    ctx.pres.type === 'mensuel' ? { id: p, haut: mois(p).split(' ')[0], bas: mois(p).split(' ')[1] } : { id: p, haut: `S${numeroSemaine(p)}`, bas: `du ${date(p).slice(0, 5)}` },
  )
}

export function DiapoOtd({ ctx }: { ctx: Ctx }) {
  const pays = ctx.paysAvecDonnees(['otd']).filter((p) => ctx.periodes.some((per) => ctx.lignes.some((x) => x.pays === p && x.indicateur === 'otd' && x.periode === per && x.valeur != null)))
  const zone = ctx.pres.type === 'mensuel' ? 1384 : 1440
  const series = seriesPeriodes(ctx)
  return (
    <Diapo surtitre="Livraison client" titre="On-Time Delivery (OTD)" numero={ctx.numeros.otd} legende corrections={nbCorrections(ctx, ['otd'])}>
      {pays.length === 0 ? (
        <Vide />
      ) : (
        <CourbesOtd
          largeur={zone}
          hauteur={ctx.pres.type === 'mensuel' ? 560 : 590}
          pays={pays}
          couleur={ctx.pres.type === 'mensuel' ? '#6250d6' : '#2a78d6'}
          points={(p) => series.map((sr) => ({ periode: sr.id, haut: sr.haut, bas: sr.bas, valeur: ctx.lignes.find((x) => x.pays === p && x.indicateur === 'otd' && x.periode === sr.id)?.valeur ?? null }))}
          cible={(p) => cibleDe(ctx.cibles, 'otd', p).cible}
          statut={(p, v) => statut('otd', v, ctx.cibles, p)}
        />
      )}
    </Diapo>
  )
}

/** Une carte par pays : réalisé (dernière période), cible, écart à la cible et évolution vs période précédente */
function BandeauEcarts({ ctx, pays }: { ctx: Ctx; pays: string[] }) {
  const n = pays.length
  const v = (p: string, per?: string) => (per ? (ctx.lignes.find((x) => x.pays === p && x.indicateur === 'otd' && x.periode === per)?.valeur ?? null) : null)
  const prec = ctx.periodes.length > 1 ? ctx.periodes.at(-2) : undefined
  const compact = n > 3
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {pays.map((p) => {
        const reel = v(p, ctx.derniere)
        const c = cibleDe(ctx.cibles, 'otd', p).cible
        const st = statut('otd', reel, ctx.cibles, p)
        const S = STATUTS[st]
        const evo = reel != null && v(p, prec) != null ? reel - (v(p, prec) as number) : null
        const ecartCible = reel != null ? reel - c : null
        const Fl = evo == null || Math.abs(evo) < 0.05 ? Minus : evo > 0 ? ArrowUpRight : ArrowDownRight
        return (
          <div key={p} className={`rounded-2xl bg-carte border border-ligne overflow-hidden ${compact ? 'px-4 py-2.5' : 'px-5 py-3'}`} style={{ borderTop: `5px solid ${S.couleur}` }}>
            <div className={`flex items-center gap-2 font-semibold text-ink-2 ${compact ? 'text-[16px]' : 'text-[19px]'}`}>
              <Drapeau code={p} taille={compact ? 16 : 19} />
              <span className="truncate">{nomPays(p)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className={`chiffres font-bold leading-none tracking-tight ${compact ? 'text-[32px]' : 'text-[40px]'}`}>{fmt(reel, '%')}</span>
              {evo != null && (
                <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold ${compact ? 'text-[14px]' : 'text-[16px]'}`} style={{ background: evo >= 0 ? STATUTS.bon.doux : STATUTS.alerte.doux, color: evo >= 0 ? STATUTS.bon.texte : STATUTS.alerte.texte }}>
                  <Fl size={compact ? 14 : 16} strokeWidth={2.8} />
                  {fmtEcart(evo, '%')}
                </span>
              )}
            </div>
            <div className={`mt-1.5 text-ink-2 ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
              Cible <b className="text-ink">{c} %</b>
              {ecartCible != null && (
                <span style={{ color: ecartCible >= 0 ? STATUTS.bon.texte : STATUTS.alerte.texte }}>
                  {' '}· écart {fmtEcart(ecartCible, '%')}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- Stock montures */

export function DiapoStock({ ctx }: { ctx: Ctx }) {
  const etat = periodeEtat(ctx, ['stock.'])
  const pays = ctx.pres.pays.filter((p) => CATALOGUE.some((i) => i.famille === 'stock' && valeur(ctx.lignes, p, i.id, etat) != null))
  const inds = CATALOGUE.filter((i) => i.famille === 'stock')
  const n = pays.length
  const compact = n > 2
  const taille = n <= 3 ? 150 : n === 4 ? 140 : n === 5 ? 132 : 122
  return (
    <Diapo
      surtitre="Gestion des stocks"
      titre="Montures et solaires"
      numero={ctx.numeros.stock}
      periode={periodeEnClair(ctx, etat)}
      legende
      corrections={nbCorrections(ctx, PREFIXES.stock)}
      pied={<SansDonnees ctx={ctx} famille="stock" />}
    >
      {n === 0 ? (
        <Vide />
      ) : compact ? (
        <div className="h-full grid gap-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
          {pays.map((p) => (
            <div key={p} className="rounded-3xl bg-carte border border-ligne px-3 py-5 flex flex-col items-center min-w-0">
              <div className={`flex items-center gap-2 font-semibold max-w-full ${n > 4 ? 'text-[19px]' : 'text-[23px]'}`}>
                <Drapeau code={p} taille={n > 4 ? 19 : 23} />
                <span className="truncate">{nomPays(p)}</span>
              </div>
              <div className="flex-1 flex flex-col justify-around mt-2">
                {inds.map((i) => {
                  const v = valeur(ctx.lignes, p, i.id, etat)
                  return <Jauge key={i.id} present={v} cible={cibleDe(ctx.cibles, i.id, p).cible} statut={statut(i.id, v, ctx.cibles, p)} libelle={i.court ?? i.libelle} taille={taille} />
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col gap-6">
          {pays.map((p) => (
            <div key={p} className="flex-1 rounded-3xl bg-carte border border-ligne px-10 flex items-center">
              <div className="w-[260px] flex items-center gap-4 text-[30px] font-semibold">
                <Drapeau code={p} taille={34} />
                {nomPays(p)}
              </div>
              <div className="flex-1 flex justify-around">
                {inds.map((i) => {
                  const v = valeur(ctx.lignes, p, i.id, etat)
                  return (
                    <Jauge
                      key={i.id}
                      present={v}
                      cible={cibleDe(ctx.cibles, i.id, p).cible}
                      statut={statut(i.id, v, ctx.cibles, p)}
                      libelle={i.libelle}
                      taille={n === 1 ? 300 : 215}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Diapo>
  )
}

/* ---------------------------------------------------------------- Matrices */

type Cellule = { valeur: string; sous?: string; statut: Statut }

function Matrice({
  lignesDef,
  pays,
  compact = false,
}: {
  compact?: boolean
  lignesDef: { id: string; libelle: string; cible: string; rendu: (pays: string) => Cellule }[]
  pays: string[]
}) {
  // Au-delà de 3 pays : cellules resserrées, statut en icône (forme + couleur), drapeau au-dessus du nom
  const dense = pays.length > 3
  const serre = compact || lignesDef.length > 4
  return (
    <div className="rounded-3xl border border-ligne bg-carte overflow-hidden">
      <table className="w-full text-left table-fixed">
        <thead>
          <tr className="border-b border-ligne text-[18px] text-muted">
            <th className={`py-4 pl-8 font-medium ${dense ? 'w-[24%]' : 'w-[30%]'}`}>Indicateur</th>
            {pays.map((p) => (
              <th key={p} className="py-4 px-2 font-medium">
                {dense ? (
                  <span className="flex flex-col items-center gap-1.5 text-[18px] font-semibold text-ink text-center leading-tight">
                    <Drapeau code={p} taille={22} />
                    {nomPays(p)}
                  </span>
                ) : (
                  <span className="flex items-center gap-3 text-[22px] font-semibold text-ink">
                    <Drapeau code={p} taille={22} />
                    {nomPays(p)}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignesDef.map((l) => (
            <tr key={l.id} className="border-b border-ligne last:border-0">
              <td className={serre ? 'py-2.5 pl-8' : 'py-5 pl-8'}>
                <div className={`font-semibold text-ink leading-tight ${dense ? 'text-[21px]' : 'text-[24px]'}`}>{l.libelle}</div>
                <div className="text-[15px] text-muted mt-0.5">{l.cible}</div>
              </td>
              {pays.map((p) => {
                const r = l.rendu(p)
                const s = STATUTS[r.statut]
                return (
                  <td key={p} className={serre ? 'py-2 px-2' : 'py-4 px-3'}>
                    {dense ? (
                      <div className="flex flex-col items-center rounded-2xl px-2 py-2" style={{ background: r.statut === 'vide' ? 'transparent' : s.doux }}>
                        <div className="flex items-center gap-2">
                          {r.statut !== 'vide' && <IconeStatut statut={r.statut} taille={18} />}
                          <span className="chiffres text-[24px] leading-tight font-semibold" style={{ color: r.statut === 'vide' ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                            {r.valeur}
                          </span>
                        </div>
                        {r.sous && <div className="chiffres text-[13px] text-ink-2">{r.sous}</div>}
                      </div>
                    ) : (
                      <div className={`flex items-center gap-4 rounded-2xl px-5 ${serre ? 'py-2' : 'py-3'}`} style={{ background: r.statut === 'vide' ? 'transparent' : s.doux }}>
                        <Point statut={r.statut} taille={14} />
                        <div className="min-w-0">
                          <div className="chiffres text-[30px] leading-tight font-semibold" style={{ color: r.statut === 'vide' ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                            {r.valeur}
                          </div>
                          {r.sous && <div className="chiffres text-[15px] text-ink-2">{r.sous}</div>}
                        </div>
                        <span className="ml-auto text-[15px] font-medium" style={{ color: s.texte }}>
                          {r.statut === 'vide' ? '' : s.libelle}
                        </span>
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const nfEntier = new Intl.NumberFormat('fr-FR')

/** Libellé de cible : « Cible ≥ 100 % », et « (selon le pays) » si certains pays ont la leur */
function texteCible(ctx: Ctx, id: string, pays: string[]) {
  const ind = CATALOGUE.find((i) => i.id === id)
  if (!ind) return ''
  const c = cibleDe(ctx.cibles, id)
  const differe = pays.some((p) => cibleDe(ctx.cibles, id, p).cible !== c.cible)
  return `Cible ${ind.sens === 'haut' ? '≥' : '≤'} ${fmt(c.cible, ind.unite)}${ind.unite === '‰' ? ' (pour 1 000 montages)' : ''}${differe ? ' · selon le pays' : ''}`
}

export function DiapoConsommables({ ctx }: { ctx: Ctx }) {
  const etat = periodeEtat(ctx, ['couverture.', 'stock_conso.'])
  const cov = (p: string, x: string) => valeur(ctx.lignes, p, `couverture.${x}`, etat)
  const stk = (p: string, x: string) => valeur(ctx.lignes, p, `stock_conso.${x}`, etat)
  const pays = ctx.pres.pays.filter((p) => ARTICLES.some((x) => cov(p, x.id) != null || stk(p, x.id) != null))
  const articles = ARTICLES.filter((x) => pays.some((p) => cov(p, x.id) != null || stk(p, x.id) != null))
  const c = cibleDe(ctx.cibles, 'couverture')
  return (
    <Diapo
      surtitre="Gestion des stocks"
      titre="Couverture des consommables"
      numero={ctx.numeros.consommables}
      legende
      corrections={nbCorrections(ctx, ['couverture.', 'stock_conso.'])}
      periode={periodeEnClair(ctx, etat)}
    >
      {pays.length === 0 ? (
        <Vide />
      ) : (
        <GrilleCouverture
          hauteur={ctx.pres.type === 'mensuel' ? 520 : 540}
          articles={articles}
          pays={pays}
          couverture={cov}
          stock={stk}
          statut={(p, x) => statut(`couverture.${x}`, cov(p, x), ctx.cibles, p)}
          alerte={c.alerte}
          cible={c.cible}
        />
      )}
    </Diapo>
  )
}

/** Diapo générique d'un KPI : un graphique par élément (Montures, Lapaire +…), pays côte à côte, valeur et cible écrites */
export function DiapoKpi({ ctx, famille, surtitre, titre }: { ctx: Ctx; famille: Famille; surtitre?: string; titre?: string }) {
  const tous = CATALOGUE.filter((i) => i.famille === famille)
  const etat = periodeEtat(ctx, tous.map((i) => i.id))
  const pays = ctx.pres.pays.filter((p) => tous.some((i) => valeur(ctx.lignes, p, i.id, etat) != null))
  const inds = tous.filter((i) => pays.some((p) => valeur(ctx.lignes, p, i.id, etat) != null))
  const n = inds.length
  const periodes = ctx.periodes
  // Un seul élément suivi sur plusieurs périodes : graphique ; sinon (état à une date) : cartes Réalisé / Cible / Écart
  const nbPeriodesAvecChiffres = n === 1 ? periodes.filter((per) => pays.some((p) => ctx.lignes.some((x) => x.pays === p && x.indicateur === inds[0].id && x.periode === per && x.valeur != null))).length : 0
  const graphique = n === 1 && nbPeriodesAvecChiffres > 1
  const colonnes = n <= 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : 3
  const rangees = Math.ceil(n / colonnes)
  const zoneL = ctx.pres.type === 'mensuel' ? 1384 : 1440
  const zoneH = ctx.pres.type === 'mensuel' ? 510 : 530
  const gap = 20
  const panneauL = (zoneL - gap * (colonnes - 1)) / colonnes
  const panneauH = (zoneH - gap * (rangees - 1)) / rangees
  const petit = n > 1
  return (
    <Diapo
      surtitre={surtitre}
      titre={titre ?? libelleFamille(famille)}
      numero={ctx.numeros[famille]}
      legende
      corrections={nbCorrections(ctx, tous.map((i) => i.id))}
      periode={graphique ? undefined : periodeEnClair(ctx, etat)}
    >
      {pays.length === 0 ? (
        <Vide />
      ) : graphique ? (
        <BarresGroupees
          largeur={zoneL}
          hauteur={zoneH}
          pays={pays}
          series={seriesPeriodes(ctx, periodes)}
          echelle={inds[0].unite === '%' ? 'pourcent' : 'auto'}
          unite={inds[0].unite}
          valeur={(p, per) => ctx.lignes.find((x) => x.pays === p && x.indicateur === inds[0].id && x.periode === per)?.valeur ?? null}
          statut={(p, per) => statut(inds[0].id, ctx.lignes.find((x) => x.pays === p && x.indicateur === inds[0].id && x.periode === per)?.valeur, ctx.cibles, p)}
          cible={(p) => cibleDe(ctx.cibles, inds[0].id, p).cible}
        />
      ) : (
        <CartesKpi
          hauteur={zoneH}
          indicateurs={inds}
          pays={pays}
          valeur={(id, p) => valeur(ctx.lignes, p, id, etat)}
          cible={(id, p) => cibleDe(ctx.cibles, id, p).cible}
          statut={(id, p) => statut(id, valeur(ctx.lignes, p, id, etat), ctx.cibles, p)}
        />
      )}
    </Diapo>
  )
}

export const DiapoProduction = ({ ctx }: { ctx: Ctx }) => <DiapoKpi ctx={ctx} famille="production" surtitre="Atelier" titre="Production" />
export const DiapoLivreurs = ({ ctx }: { ctx: Ctx }) => <DiapoKpi ctx={ctx} famille="livreurs" surtitre="Livraisons" titre="Qualité des tournées" />
export const DiapoAutres = ({ ctx }: { ctx: Ctx }) => <DiapoKpi ctx={ctx} famille="autres" surtitre="Suivi complémentaire" titre="Autres indicateurs" />

export function DiapoReclamations() {
  return (
    <Diapo surtitre="Qualité" titre="Réclamations qualité">
      <Vide texte="Le Google Sheet des réclamations sera connecté à l'étape 5 (par pays, agence et nature)." />
    </Diapo>
  )
}
