import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Database, PencilLine, Search, Settings2, X } from 'lucide-react'
import { CadreDiapo } from '../components/CadreDiapo'
import { Drapeau } from '../components/Drapeau'
import { FAMILLES } from '../lib/catalogue'
import { PAYS_SUIVIS, periodesDisponibles } from '../lib/donnees'
import { useLignes } from '../lib/saisie'
import { ciblesManuelles, familleKpi, useManuel } from '../lib/manuel'
import { Calendrier } from '../components/Calendrier'
import { mois, numeroSemaine, semaineLongue } from '../lib/format'
import { chercherPays, nomPays } from '../lib/pays'
import { useCibles, usePresentations } from '../lib/stockage'
import type { Famille, Presentation } from '../lib/types'
import { creerCtx, periodesDe } from '../diapos/contexte'
import { construireDiapos, diaposVisibles } from '../diapos'

function Etape({ n, titre, children, droite }: { n: number; titre: string; children: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-carte border border-ligne p-6">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-7 h-7 rounded-full bg-nuit text-white text-sm font-semibold">{n}</span>
        <h2 className="text-lg font-semibold">{titre}</h2>
        <div className="ml-auto">{droite}</div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const puce = (actif: boolean) =>
  `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
    actif ? 'bg-nuit border-nuit text-white' : 'bg-carte border-ligne text-ink-2 hover:border-base hover:text-ink'
  }`

export function Preparation() {
  const { id, type: typeParam } = useParams()
  const nav = useNavigate()
  const { liste, enregistrer } = usePresentations()
  const [cibles] = useCibles()
  const existante = id ? liste.find((p) => p.id === id) : undefined
  const type: Presentation['type'] = existante?.type ?? (typeParam === 'mensuel' ? 'mensuel' : 'hebdo')
  const hebdo = type === 'hebdo'

  const { lignes: lignesSheet, donnees } = useLignes()
  const manuel = useManuel()
  const [source, setSource] = useState<'sheet' | 'manuel'>(existante?.source ?? 'sheet')
  const estManuel = source === 'manuel'
  const lignes = estManuel ? manuel.valeurs : lignesSheet
  const ciblesTout = useMemo(() => ({ ...cibles, ...ciblesManuelles(manuel) }), [cibles, manuel])
  const semaines = periodesDisponibles(lignes, hebdo ? 'semaine' : 'mois')
  const famillesDispo: { id: Famille; libelle: string; description: string }[] = estManuel
    ? manuel.kpis.map((k) => ({ id: familleKpi(k), libelle: k.nom || 'Sans nom', description: k.elements.map((e) => e.libelle).filter(Boolean).join(', ') || 'Aucun élément' }))
    : FAMILLES

  const [mode, setMode] = useState<'auto' | 'choix'>(existante && !existante.glissant ? 'choix' : 'auto')
  const [nbAuto, setNbAuto] = useState(existante?.glissant ?? 2)
  const [periodes, setPeriodes] = useState<string[]>(existante?.periodes ?? semaines.slice(-2))
  const paysDispo = [...new Set(lignes.map((l) => l.pays))]
  const [pays, setPays] = useState<string[]>(existante?.pays ?? (paysDispo.length ? [...new Set([...PAYS_SUIVIS, ...paysDispo])] : PAYS_SUIVIS))
  // Si les données arrivent après l'ouverture de l'écran, on présélectionne les 2 dernières périodes
  const nbPeriodes = semaines.length
  useEffect(() => {
    if (!existante && periodes.length === 0 && nbPeriodes) setPeriodes(semaines.slice(-2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nbPeriodes])
  // Changer de source : on propose les pays et les périodes qui ont des chiffres dans cette source
  useEffect(() => {
    if (existante) return
    const dispo = [...new Set(lignes.map((l) => l.pays))]
    setPays(estManuel ? (dispo.length ? dispo : PAYS_SUIVIS) : [...new Set([...PAYS_SUIVIS, ...dispo])])
    setPeriodes(periodesDisponibles(lignes, hebdo ? 'semaine' : 'mois').slice(-2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])
  const [famillesSheet, setFamillesSheet] = useState<Famille[]>(existante?.source !== 'manuel' ? (existante?.familles ?? FAMILLES.map((f) => f.id)) : FAMILLES.map((f) => f.id))
  const [famillesManuel, setFamillesManuel] = useState<Famille[]>(existante?.source === 'manuel' ? existante.familles : manuel.kpis.map(familleKpi))
  const familles = estManuel ? famillesManuel : famillesSheet
  const setFamilles = estManuel ? setFamillesManuel : setFamillesSheet
  const [q, setQ] = useState('')
  const [auteur, setAuteur] = useState(existante?.auteur ?? 'Jean Didier N’GORAN')
  const [titre, setTitre] = useState(existante?.titre ?? (hebdo ? 'Point hebdo Supply Chain' : 'Revue mensuelle Supply Chain'))

  const resultats = useMemo(() => chercherPays(q).filter((p) => !pays.includes(p.code)).slice(0, 8), [q, pays])
  const basculer = <T,>(liste: T[], v: T) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

  const brouillon: Presentation = {
    id: existante?.id ?? crypto.randomUUID(),
    type,
    source,
    titre: titre.trim() || (hebdo ? 'Point hebdo Supply Chain' : 'Revue mensuelle Supply Chain'),
    notes: existante?.notes,
    diaposAjoutees: existante?.diaposAjoutees,
    auteur: auteur.trim() || undefined,
    periodes: [...periodes].sort(),
    glissant: mode === 'auto' ? nbAuto : undefined,
    pays,
    familles: famillesDispo.map((f) => f.id).filter((f) => familles.includes(f)),
    creeLe: existante?.creeLe ?? new Date().toISOString(),
  }
  const periodesVues = periodesDe(brouillon, lignes)
  const valide = periodesVues.length > 0 && pays.length > 0 && familles.length > 0
  const apercu = valide ? diaposVisibles(construireDiapos(creerCtx(brouillon, lignes, ciblesTout)), brouillon) : []

  const creer = (diapo: boolean) => {
    enregistrer(brouillon)
    nav(`/p/${brouillon.id}${diapo ? '?diapo=0' : ''}`)
  }

  return (
    <div className={`mx-auto max-w-[1280px] px-4 sm:px-6 py-8 ${hebdo ? '' : 'theme-mensuel'}`}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="rounded-full bg-bleu-100 text-bleu-650 px-3 py-1 text-xs font-semibold uppercase tracking-wider">{hebdo ? 'Hebdo' : 'Mensuel'}</span>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          className="flex-1 min-w-[240px] bg-transparent text-3xl font-semibold tracking-tight outline-none border-b-2 border-transparent focus:border-bleu-450 py-1"
          aria-label="Titre de la présentation"
        />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Présenté par
          <input value={auteur} onChange={(e) => setAuteur(e.target.value)} className="rounded-xl border border-ligne bg-carte px-3 py-1.5 font-medium text-ink outline-none focus:border-bleu-450" />
        </label>
      </div>

      <div className="mt-6 grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <div className="grid gap-5">
          <Etape n={1} titre="Source des chiffres">
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  { id: 'sheet', titre: 'Data KPI (Sheet)', texte: 'Les chiffres de ta feuille « Donnée », mis à jour automatiquement.', Icone: Database },
                  { id: 'manuel', titre: 'Manuel', texte: 'Tes KPI créés dans Paramètres, avec les réalisations saisies à la main.', Icone: PencilLine },
                ] as const
              ).map((o) => {
                const actif = source === o.id
                return (
                  <button
                    key={o.id}
                    onClick={() => setSource(o.id)}
                    className={`text-left rounded-2xl border-2 p-4 flex items-start gap-3 transition ${actif ? 'border-bleu-450 bg-bleu-100/40' : 'border-ligne hover:border-base'}`}
                  >
                    <span className={`grid place-items-center w-10 h-10 shrink-0 rounded-xl ${actif ? 'bg-bleu-450 text-white' : 'bg-page text-ink-2'}`}>
                      <o.Icone size={20} />
                    </span>
                    <span>
                      <span className="block font-semibold">{o.titre}</span>
                      <span className="block text-sm text-ink-2">{o.texte}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Etape>

          <Etape
            n={2}
            titre={hebdo ? 'Semaines à présenter' : 'Mois à présenter'}
            droite={<span className="text-sm text-muted">{periodesVues.map((x) => (hebdo ? `S${numeroSemaine(x)}` : mois(x))).join(' · ') || 'aucune'}</span>}
          >
            {semaines.length === 0 && (
              <div className="mb-4 rounded-2xl bg-vigilance-doux text-vigilance-texte px-4 py-3 text-sm">
                {estManuel
                  ? `Aucune réalisation saisie pour l'instant. Saisis-les dans Paramètres → Réalisations. `
                  : donnees.statut === 'chargement'
                  ? 'Lecture du Google Sheet en cours…'
                  : donnees.statut === 'erreur'
                    ? `Le Google Sheet n'a pas pu être lu : ${donnees.erreur}`
                    : `Aucune ${hebdo ? 'semaine' : 'période mensuelle'} avec des chiffres. `}
                <Link to={estManuel ? '/parametres?onglet=realisations' : '/donnees'} className="font-semibold underline">
                  {estManuel ? 'Ouvrir Paramètres' : "Voir l'écran Données"}
                </Link>
              </div>
            )}
            <div className="inline-flex rounded-full bg-page border border-ligne p-1 text-sm">
              <button onClick={() => setMode('auto')} className={`px-4 py-2 rounded-full font-medium transition ${mode === 'auto' ? 'bg-nuit text-white' : 'text-ink-2 hover:text-ink'}`}>
                Automatique
              </button>
              <button onClick={() => setMode('choix')} className={`px-4 py-2 rounded-full font-medium transition ${mode === 'choix' ? 'bg-nuit text-white' : 'text-ink-2 hover:text-ink'}`}>
                Choisir dans le calendrier
              </button>
            </div>
            {mode === 'auto' ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-3 text-[15px]">
                  <span>Toujours les</span>
                  <div className="inline-flex rounded-xl border border-ligne overflow-hidden">
                    {[1, 2, 3, 4, 6, 8].map((k) => (
                      <button key={k} onClick={() => setNbAuto(k)} className={`chiffres px-3.5 py-1.5 font-semibold ${nbAuto === k ? 'bg-bleu-450 text-white' : 'hover:bg-page'}`}>
                        {k}
                      </button>
                    ))}
                  </div>
                  <span>{hebdo ? 'dernières semaines' : 'derniers mois'} qui ont des chiffres.</span>
                </div>
                <p className="mt-2 text-sm text-ink-2">
                  Dès qu'une nouvelle {hebdo ? 'semaine' : 'période'} arrive dans le Sheet, la présentation se met à jour toute seule.
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <Calendrier type={hebdo ? 'semaine' : 'mois'} selection={periodes} disponibles={semaines} onChange={setPeriodes} />
              </div>
            )}
          </Etape>

          <Etape n={3} titre="Pays" droite={<span className="text-sm text-muted">{pays.length} choisi(s)</span>}>
            <div className="flex flex-wrap gap-2">
              {pays.map((c) => (
                <span key={c} className="inline-flex items-center gap-2 rounded-full bg-page border border-ligne pl-2 pr-1 py-1 text-sm font-medium">
                  <Drapeau code={c} taille={16} />
                  {nomPays(c)}
                  <button onClick={() => setPays(pays.filter((x) => x !== c))} className="p-1 rounded-full text-muted hover:text-ink hover:bg-white" aria-label={`Retirer ${nomPays(c)}`}>
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-4 relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ajouter un pays du monde…"
                className="w-full rounded-2xl border border-ligne bg-page pl-10 pr-4 py-3 outline-none focus:border-bleu-450 focus:bg-white"
              />
              {q && (
                <ul className="absolute z-10 mt-2 w-full rounded-2xl bg-white border border-ligne shadow-lg overflow-hidden">
                  {resultats.length === 0 && <li className="px-4 py-3 text-muted">Aucun pays trouvé</li>}
                  {resultats.map((p) => (
                    <li key={p.code}>
                      <button
                        onClick={() => {
                          setPays([...pays, p.code])
                          setQ('')
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-page"
                      >
                        <Drapeau code={p.code} taille={18} />
                        {p.nom}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Etape>

          <Etape
            n={4}
            titre={estManuel ? 'KPI à présenter' : 'Indicateurs'}
            droite={
              estManuel && (
                <Link to="/parametres" className="inline-flex items-center gap-1.5 text-sm font-medium text-bleu-450">
                  <Settings2 size={15} /> Créer ou modifier un KPI
                </Link>
              )
            }
          >
            {estManuel && famillesDispo.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-grille p-6 text-center text-sm text-muted">
                Aucun KPI enregistré.{' '}
                <Link to="/parametres" className="font-semibold text-bleu-450 underline">
                  Créer un KPI dans Paramètres
                </Link>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {famillesDispo.map((f) => {
                const actif = familles.includes(f.id)
                return (
                  <button
                    key={f.id}
                    onClick={() => setFamilles(basculer(familles, f.id))}
                    className={`text-left rounded-2xl border p-4 flex items-start gap-3 transition ${actif ? 'border-bleu-450 bg-bleu-100/40' : 'border-ligne hover:border-base'}`}
                  >
                    <span className={`mt-0.5 grid place-items-center w-5 h-5 rounded-md border-2 ${actif ? 'bg-bleu-450 border-bleu-450 text-white' : 'border-base'}`}>
                      {actif && <Check size={13} strokeWidth={3.5} />}
                    </span>
                    <span>
                      <span className="block font-semibold">{f.libelle}</span>
                      <span className="block text-sm text-ink-2">{f.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Etape>
        </div>

        <aside className="lg:sticky lg:top-24 rounded-3xl bg-carte border border-ligne p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Aperçu</h2>
            <span className="text-sm text-muted">{apercu.length} diapos</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1">
            {apercu.map((d, i) => (
              <div key={d.id}>
                <div className="rounded-lg overflow-hidden ring-1 ring-ligne pointer-events-none anim-figee">
                  <CadreDiapo>{d.rendu}</CadreDiapo>
                </div>
                <div className="mt-1 text-xs text-ink-2 truncate">
                  {i + 1}. {d.titre}
                </div>
              </div>
            ))}
            {!valide && <div className="col-span-2 py-10 text-center text-muted text-sm">Choisis au moins une semaine, un pays et un indicateur.</div>}
          </div>
          <div className="mt-5 grid gap-2">
            <button disabled={!valide} onClick={() => creer(true)} className="rounded-2xl bg-bleu-450 hover:bg-bleu-550 disabled:opacity-40 text-white font-semibold py-3.5 transition">
              Lancer le diaporama
            </button>
            <button disabled={!valide} onClick={() => creer(false)} className="rounded-2xl border border-ligne hover:border-base disabled:opacity-40 font-medium py-3 transition">
              Enregistrer et voir le tableau de bord
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
