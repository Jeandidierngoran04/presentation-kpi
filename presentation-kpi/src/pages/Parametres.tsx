import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Copy, Plus, Search, Trash2, X } from 'lucide-react'
import { Calendrier } from '../components/Calendrier'
import { Drapeau } from '../components/Drapeau'
import { TableSaisie, lireNombre } from '../components/TableSaisie'
import { cibleDe } from '../lib/catalogue'
import { PAYS_SUIVIS } from '../lib/donnees'
import { mois, numeroSemaine, semaineLongue } from '../lib/format'
import { ciblesManuelles, enregistrerManuel, familleKpi, idElement, nouvelId, useManuel, type ElementKpi, type KpiManuel } from '../lib/manuel'
import { PAYS, chercherPays, nomPays } from '../lib/pays'
import type { Ligne, Sens, Unite } from '../lib/types'
import { PageCibles } from './Cibles'
import { PageSaisie } from './Saisie'

const ONGLETS = [
  { id: 'kpi', libelle: 'Mes KPI' },
  { id: 'realisations', libelle: 'Réalisations' },
  { id: 'cibles', libelle: 'Cibles (Sheet)' },
  { id: 'corrections', libelle: 'Corrections (Sheet)' },
] as const
type Onglet = (typeof ONGLETS)[number]['id']

const UNITES: { id: Unite; libelle: string }[] = [
  { id: '%', libelle: '%' },
  { id: 'nb', libelle: 'Nombre' },
  { id: 'modeles', libelle: 'Modèles' },
  { id: '‰', libelle: '‰' },
  { id: 'mois', libelle: 'Mois' },
  { id: 'note', libelle: 'Note' },
]

const champ = 'w-full rounded-xl border border-ligne bg-page px-3 py-2 outline-none focus:border-bleu-450 focus:bg-white'
const virgule = (v?: number) => (v == null ? '' : String(v).replace('.', ','))

/** Champ texte validé à la sortie (on peut taper « 98,5 » sans être interrompu) */
function Saisie({ valeur, onValider, className = '', placeholder, nombre = false }: { valeur: string; onValider: (v: string) => void; className?: string; placeholder?: string; nombre?: boolean }) {
  return (
    <input
      key={valeur}
      defaultValue={valeur}
      placeholder={placeholder}
      inputMode={nombre ? 'decimal' : undefined}
      onBlur={(e) => e.target.value !== valeur && onValider(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`${champ} ${nombre ? 'chiffres text-right' : ''} ${className}`}
    />
  )
}

/* ================================================================ Mes KPI */

function nouveauKpi(): KpiManuel {
  return { id: nouvelId(), nom: 'Nouveau KPI', elements: [{ id: nouvelId(), libelle: '', unite: '%', sens: 'haut', cible: 100, alerte: 90 }] }
}

function EditeurElement({ e, maj, supprimer, paysConnus }: { e: ElementKpi; maj: (e: ElementKpi) => void; supprimer?: () => void; paysConnus: string[] }) {
  const [ouvert, setOuvert] = useState(false)
  const parPays = e.parPays ?? {}
  const nb = Object.keys(parPays).length
  const liste = [...new Set([...paysConnus, ...Object.keys(parPays)])]
  const majPays = (p: string, champ: 'cible' | 'alerte', t: string) => {
    const v = lireNombre(t)
    const actuel = parPays[p] ?? { cible: e.cible, alerte: e.alerte }
    if (v == null && !parPays[p]) return
    maj({ ...e, parPays: { ...parPays, [p]: { ...actuel, [champ]: v ?? (champ === 'cible' ? e.cible : e.alerte) } } })
  }
  return (
    <div className="rounded-2xl border border-ligne bg-white">
      <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1.3fr_0.9fr_0.9fr_auto_auto] gap-2 items-end p-3">
        <label className="grid gap-1 text-xs text-ink-2 col-span-2 md:col-span-1">
          Élément
          <Saisie valeur={e.libelle} placeholder="ex. Lapaire +" onValider={(v) => maj({ ...e, libelle: v.trim() })} />
        </label>
        <label className="grid gap-1 text-xs text-ink-2">
          Unité
          <select className={champ} value={e.unite} onChange={(x) => maj({ ...e, unite: x.target.value as Unite })}>
            {UNITES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-ink-2">
          Bon résultat
          <select className={champ} value={e.sens} onChange={(x) => maj({ ...e, sens: x.target.value as Sens })}>
            <option value="haut">Plus c'est haut</option>
            <option value="bas">Plus c'est bas</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-ink-2">
          Cible
          <Saisie nombre valeur={virgule(e.cible)} onValider={(v) => maj({ ...e, cible: lireNombre(v) ?? e.cible })} />
        </label>
        <label className="grid gap-1 text-xs text-ink-2" title={e.sens === 'haut' ? 'En dessous (ou égal), c’est rouge' : 'Au-dessus (ou égal), c’est rouge'}>
          Alerte
          <Saisie nombre valeur={virgule(e.alerte)} onValider={(v) => maj({ ...e, alerte: lireNombre(v) ?? e.alerte })} />
        </label>
        <button
          onClick={() => setOuvert(!ouvert)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap ${nb ? 'bg-bleu-100 text-bleu-650' : 'text-ink-2 hover:bg-page'}`}
        >
          Par pays{nb ? ` (${nb})` : ''} <ChevronDown size={14} className={ouvert ? 'rotate-180' : ''} />
        </button>
        {supprimer ? (
          <button onClick={supprimer} className="p-2 rounded-full text-muted hover:text-alerte hover:bg-alerte-doux" aria-label="Supprimer l'élément">
            <Trash2 size={16} />
          </button>
        ) : (
          <span />
        )}
      </div>
      {ouvert && (
        <div className="mx-3 mb-3 rounded-xl bg-page p-3">
          <div className="text-xs text-ink-2 mb-2">Cible propre à chaque pays. Vide = cible par défaut ({virgule(e.cible)}).</div>
          <div className="grid gap-1.5">
            {liste.map((p) => (
              <div key={p} className="grid grid-cols-[1fr_110px_110px_28px] gap-2 items-center">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Drapeau code={p} taille={14} /> {nomPays(p)}
                </span>
                <Saisie nombre valeur={virgule(parPays[p]?.cible)} placeholder={virgule(e.cible)} onValider={(v) => majPays(p, 'cible', v)} className="py-1.5" />
                <Saisie nombre valeur={virgule(parPays[p]?.alerte)} placeholder={virgule(e.alerte)} onValider={(v) => majPays(p, 'alerte', v)} className="py-1.5" />
                {parPays[p] ? (
                  <button
                    onClick={() => {
                      const r = { ...parPays }
                      delete r[p]
                      maj({ ...e, parPays: r })
                    }}
                    className="p-1 rounded-full text-muted hover:text-alerte"
                    title="Revenir à la cible par défaut"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
          <select value="" onChange={(x) => x.target.value && majPays(x.target.value, 'cible', virgule(e.cible))} className="mt-2 rounded-lg border border-ligne bg-white px-2 py-1.5 text-sm">
            <option value="">+ Ajouter un pays…</option>
            {PAYS.filter((p) => !liste.includes(p.code)).map((p) => (
              <option key={p.code} value={p.code}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function MesKpi() {
  const m = useManuel()
  const [choisi, setChoisi] = useState<string | undefined>(m.kpis[0]?.id)
  const kpi = m.kpis.find((k) => k.id === choisi)
  const paysConnus = [...new Set([...PAYS_SUIVIS, ...m.valeurs.map((v) => v.pays)])]
  const majKpi = (k: KpiManuel) => enregistrerManuel({ ...m, kpis: m.kpis.map((x) => (x.id === k.id ? k : x)) })

  const creer = () => {
    const k = nouveauKpi()
    enregistrerManuel({ ...m, kpis: [...m.kpis, k] })
    setChoisi(k.id)
  }
  const dupliquer = (k: KpiManuel) => {
    const c: KpiManuel = { ...k, id: nouvelId(), nom: `${k.nom} (copie)`, elements: k.elements.map((e) => ({ ...e, id: nouvelId() })) }
    enregistrerManuel({ ...m, kpis: [...m.kpis, c] })
    setChoisi(c.id)
  }
  const supprimer = (k: KpiManuel) => {
    if (!confirm(`Supprimer le KPI « ${k.nom} » et toutes ses réalisations ?`)) return
    const ids = new Set(k.elements.map((e) => idElement(k, e)))
    enregistrerManuel({ kpis: m.kpis.filter((x) => x.id !== k.id), valeurs: m.valeurs.filter((v) => !ids.has(v.indicateur)) })
    setChoisi(m.kpis.find((x) => x.id !== k.id)?.id)
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
      <div className="rounded-3xl bg-carte border border-ligne p-4">
        <button onClick={creer} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-bleu-450 hover:bg-bleu-550 text-white font-semibold py-3">
          <Plus size={18} /> Nouveau KPI
        </button>
        <ul className="mt-3 grid gap-1">
          {m.kpis.length === 0 && <li className="text-sm text-muted text-center py-6">Aucun KPI enregistré.</li>}
          {m.kpis.map((k) => (
            <li key={k.id}>
              <button
                onClick={() => setChoisi(k.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition ${k.id === choisi ? 'bg-nuit text-white' : 'hover:bg-page'}`}
              >
                <div className="font-semibold truncate">{k.nom || 'Sans nom'}</div>
                <div className={`text-xs ${k.id === choisi ? 'text-white/70' : 'text-muted'}`}>
                  {k.elements.length} élément{k.elements.length > 1 ? 's' : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {kpi ? (
        <div className="rounded-3xl bg-carte border border-ligne p-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 flex-1 min-w-[240px]">
              <span className="text-sm text-ink-2">Nom du KPI (titre de la diapo)</span>
              <Saisie valeur={kpi.nom} placeholder="ex. Niveau de stocks" onValider={(v) => majKpi({ ...kpi, nom: v.trim() })} className="text-lg font-semibold" />
            </label>
            <button onClick={() => dupliquer(kpi)} className="inline-flex items-center gap-2 rounded-full border border-ligne px-4 py-2 text-sm font-medium hover:border-base">
              <Copy size={15} /> Dupliquer
            </button>
            <button onClick={() => supprimer(kpi)} className="inline-flex items-center gap-2 rounded-full border border-ligne px-4 py-2 text-sm font-medium text-alerte-texte hover:bg-alerte-doux">
              <Trash2 size={15} /> Supprimer
            </button>
          </div>

          <h3 className="mt-6 font-semibold">Éléments</h3>
          <p className="text-sm text-ink-2">Chaque élément a sa propre cible (et, si besoin, une cible par pays). Un graphique par élément sur la diapo.</p>
          <div className="mt-3 grid gap-3">
            {kpi.elements.map((e) => (
              <EditeurElement
                key={e.id}
                e={e}
                paysConnus={paysConnus}
                maj={(ne) => majKpi({ ...kpi, elements: kpi.elements.map((x) => (x.id === e.id ? ne : x)) })}
                supprimer={
                  kpi.elements.length > 1
                    ? () => {
                        const id = idElement(kpi, e)
                        enregistrerManuel({
                          kpis: m.kpis.map((x) => (x.id === kpi.id ? { ...kpi, elements: kpi.elements.filter((y) => y.id !== e.id) } : x)),
                          valeurs: m.valeurs.filter((v) => v.indicateur !== id),
                        })
                      }
                    : undefined
                }
              />
            ))}
          </div>
          <button
            onClick={() => majKpi({ ...kpi, elements: [...kpi.elements, { id: nouvelId(), libelle: '', unite: kpi.elements.at(-1)?.unite ?? '%', sens: 'haut', cible: 100, alerte: 90 }] })}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-base px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            <Plus size={16} /> Ajouter un élément
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-grille p-10 text-center text-muted">Crée ton premier KPI avec « Nouveau KPI ».</div>
      )}
    </div>
  )
}

/* ================================================================ Réalisations */

function Realisations() {
  const m = useManuel()
  const [type, setType] = useState<Ligne['type']>('semaine')
  const disponibles = [...new Set(m.valeurs.filter((v) => v.type === type).map((v) => v.periode))].sort()
  const [periode, setPeriode] = useState<string | undefined>(disponibles.at(-1))
  const [kpiId, setKpiId] = useState<string | undefined>(m.kpis[0]?.id)
  const kpi = m.kpis.find((k) => k.id === kpiId)
  const [pays, setPays] = useState<string[]>([...new Set([...PAYS_SUIVIS, ...m.valeurs.map((v) => v.pays)])])
  const [q, setQ] = useState('')
  const resultats = useMemo(() => chercherPays(q).filter((p) => !pays.includes(p.code)).slice(0, 8), [q, pays])
  const cibles = useMemo(() => ciblesManuelles(m), [m])

  if (!m.kpis.length) return <div className="rounded-3xl border-2 border-dashed border-grille p-10 text-center text-muted">Crée d'abord un KPI dans l'onglet « Mes KPI ».</div>

  return (
    <div className="rounded-3xl bg-carte border border-ligne p-6 grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      <div>
        <div className="inline-flex rounded-full bg-page border border-ligne p-1 text-sm mb-3">
          {(['semaine', 'mois'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`px-4 py-1.5 rounded-full font-medium ${type === t ? 'bg-nuit text-white' : 'text-ink-2'}`}>
              {t === 'semaine' ? 'Hebdo' : 'Mensuel'}
            </button>
          ))}
        </div>
        <Calendrier key={type} type={type} selection={periode ? [periode] : []} disponibles={disponibles} onChange={(s) => setPeriode(s[0])} multiple={false} />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-ink-2 mb-3">
          Période :{' '}
          <span className="font-semibold text-ink">{periode ? (type === 'semaine' ? `S${numeroSemaine(periode)} · ${semaineLongue(periode)}` : mois(periode)) : 'choisis-la dans le calendrier'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.kpis.map((k) => (
            <button key={k.id} onClick={() => setKpiId(k.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${kpiId === k.id ? 'bg-nuit border-nuit text-white' : 'border-ligne text-ink-2 hover:border-base'}`}>
              {k.nom || 'Sans nom'}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pays.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-page border border-ligne pl-2 pr-1 py-0.5 text-sm">
              <Drapeau code={c} taille={14} /> {nomPays(c)}
              <button onClick={() => setPays(pays.filter((x) => x !== c))} className="p-1 rounded-full text-muted hover:text-ink" aria-label={`Retirer ${nomPays(c)}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un pays" className="rounded-full border border-ligne bg-page pl-8 pr-3 py-1 text-sm outline-none focus:border-bleu-450 w-[170px]" />
            {q && (
              <ul className="absolute z-10 mt-1 w-[220px] rounded-xl bg-white border border-ligne shadow-lg overflow-hidden">
                {resultats.map((p) => (
                  <li key={p.code}>
                    <button
                      onClick={() => {
                        setPays([...pays, p.code])
                        setQ('')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-page"
                    >
                      <Drapeau code={p.code} taille={14} /> {p.nom}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {kpi && (
          <div className="mt-5">
            <TableSaisie
              type={type}
              periode={periode}
              famille={familleKpi(kpi)}
              pays={pays}
              valeurs={m.valeurs}
              onChange={(v) => enregistrerManuel({ ...m, valeurs: v })}
              cibles={(id, p) => cibleDe(cibles, id, p).cible}
            />
            <p className="mt-2 text-xs text-muted">Tape ce qui a été réalisé. En gris : la cible du pays. Laisse vide si pas de chiffre.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================ Page */

export function PageParametres() {
  const [params, setParams] = useSearchParams()
  const onglet = (params.get('onglet') as Onglet) || 'kpi'
  return (
    <div>
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-2 text-ink-2">Crée tes KPI, saisis les réalisations, règle les cibles. Tout est enregistré et réutilisable dans d'autres présentations.</p>
        <div className="mt-6 flex flex-wrap gap-1 border-b border-ligne">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => setParams({ onglet: o.id })}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${onglet === o.id ? 'border-bleu-450 text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
            >
              {o.libelle}
            </button>
          ))}
        </div>
      </div>
      {onglet === 'kpi' && (
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-8">
          <MesKpi />
        </div>
      )}
      {onglet === 'realisations' && (
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-8">
          <Realisations />
        </div>
      )}
      {onglet === 'cibles' && <PageCibles />}
      {onglet === 'corrections' && <PageSaisie />}
    </div>
  )
}
