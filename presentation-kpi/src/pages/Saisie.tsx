import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { Calendrier } from '../components/Calendrier'
import { TableSaisie, lireNombre } from '../components/TableSaisie'
import { Drapeau } from '../components/Drapeau'
import { ARTICLES, CATALOGUE, FAMILLES } from '../lib/catalogue'
import { PAYS_SUIVIS, periodesDisponibles } from '../lib/donnees'
import { fmt, mois, numeroSemaine, semaineLongue } from '../lib/format'
import { chercherPays, nomPays } from '../lib/pays'
import { cleLigne, enregistrerSaisie, useLignes } from '../lib/saisie'
import type { Famille, Indicateur, Ligne, Sens, Unite } from '../lib/types'

const FAMILLES_SAISIE = FAMILLES.filter((f) => f.id !== 'reclamations')
const FAMILLES_PERSO: { id: Famille; libelle: string }[] = [
  { id: 'autres', libelle: 'Autres indicateurs (diapo dédiée)' },
  { id: 'production', libelle: 'Production' },
  { id: 'livreurs', libelle: 'Livreurs' },
]
const UNITES: { id: Unite; libelle: string }[] = [
  { id: '%', libelle: 'Pourcentage (%)' },
  { id: 'nb', libelle: 'Nombre' },
  { id: '‰', libelle: 'Pour mille (‰)' },
  { id: 'mois', libelle: 'Mois' },
  { id: 'note', libelle: 'Note' },
]

const champ = 'w-full rounded-xl border border-ligne bg-page px-3 py-2 outline-none focus:border-bleu-450 focus:bg-white'



export function PageSaisie() {
  const { donnees, saisie } = useLignes()
  const [type, setType] = useState<Ligne['type']>('semaine')
  const disponibles = periodesDisponibles(donnees.lignes, type)
  const [periode, setPeriode] = useState<string | undefined>(disponibles.at(-1))
  const [famille, setFamille] = useState<Famille>('otd')
  const paysDonnees = [...new Set([...donnees.lignes.map((l) => l.pays), ...saisie.valeurs.map((l) => l.pays)])]
  const [pays, setPays] = useState<string[]>([...new Set([...PAYS_SUIVIS, ...paysDonnees])])
  const [q, setQ] = useState('')
  const resultats = useMemo(() => chercherPays(q).filter((p) => !pays.includes(p.code)).slice(0, 8), [q, pays])




  /* ---------- nouvel indicateur */
  const [nouveau, setNouveau] = useState<{ libelle: string; famille: Famille; unite: Unite; sens: Sens; cible: string; alerte: string }>({
    libelle: '',
    famille: 'autres',
    unite: '%',
    sens: 'haut',
    cible: '100',
    alerte: '90',
  })
  const ajouterIndicateur = () => {
    const libelle = nouveau.libelle.trim()
    if (!libelle) return
    const slug = libelle.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const ind: Indicateur = {
      id: `perso.${slug}_${Math.random().toString(36).slice(2, 6)}`,
      libelle,
      famille: nouveau.famille,
      unite: nouveau.unite,
      sens: nouveau.sens,
      cible: lireNombre(nouveau.cible) ?? 0,
      alerte: lireNombre(nouveau.alerte) ?? 0,
      perso: true,
    }
    enregistrerSaisie({ ...saisie, indicateurs: [...saisie.indicateurs, ind] })
    setNouveau({ ...nouveau, libelle: '' })
    setFamille(ind.famille)
  }
  const supprimerIndicateur = (id: string) => {
    if (!confirm('Supprimer cet indicateur et les chiffres saisis pour lui ?')) return
    enregistrerSaisie({ indicateurs: saisie.indicateurs.filter((i) => i.id !== id), valeurs: saisie.valeurs.filter((l) => l.indicateur !== id) })
  }

  const nbSaisis = saisie.valeurs.length

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Saisie</h1>
      <p className="mt-2 text-ink-2">Complète ou corrige les chiffres du Sheet, et ajoute tes propres indicateurs. Une valeur saisie ici l'emporte sur celle du Sheet.</p>

      {/* ------------------------------------------------ Chiffres */}
      <section className="mt-8 rounded-3xl bg-carte border border-ligne p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Saisir des chiffres</h2>
          {nbSaisis > 0 && <span className="text-sm text-muted">{nbSaisis} chiffre(s) saisi(s) au total</span>}
        </div>

        <div className="mt-5 grid lg:grid-cols-[420px_1fr] gap-6 items-start">
          <div>
            <div className="inline-flex rounded-full bg-page border border-ligne p-1 text-sm mb-3">
              {(['semaine', 'mois'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setType(t)
                    setPeriode(periodesDisponibles(donnees.lignes, t).at(-1))
                  }}
                  className={`px-4 py-1.5 rounded-full font-medium ${type === t ? 'bg-nuit text-white' : 'text-ink-2'}`}
                >
                  {t === 'semaine' ? 'Hebdo' : 'Mensuel'}
                </button>
              ))}
            </div>
            <Calendrier key={type} type={type} selection={periode ? [periode] : []} disponibles={disponibles} onChange={(s) => setPeriode(s[0])} multiple={false} />
          </div>

          <div className="min-w-0">
            <div className="text-sm text-ink-2 mb-2">
              Période :{' '}
              <span className="font-semibold text-ink">{periode ? (type === 'semaine' ? `S${numeroSemaine(periode)} · ${semaineLongue(periode)}` : mois(periode)) : 'choisis-la dans le calendrier'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FAMILLES_SAISIE.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFamille(f.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${famille === f.id ? 'bg-nuit border-nuit text-white' : 'border-ligne text-ink-2 hover:border-base'}`}
                >
                  {f.libelle}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {pays.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-page border border-ligne pl-2 pr-1 py-0.5 text-sm">
                  <Drapeau code={c} taille={14} />
                  {nomPays(c)}
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

            <div className="mt-5">
              <TableSaisie type={type} periode={periode} famille={famille} pays={pays} valeurs={saisie.valeurs} reference={donnees.lignes} onChange={(v) => enregistrerSaisie({ ...saisie, valeurs: v })} />
            </div>
            <p className="mt-2 text-xs text-muted">En gris : chiffre du Sheet. En bleu : chiffre saisi ici (il l'emporte). Laisse vide ou clique sur ↺ pour revenir au Sheet.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Indicateurs */}
      <section className="mt-6 rounded-3xl bg-carte border border-ligne p-6">
        <h2 className="text-lg font-semibold">Mes indicateurs</h2>
        <p className="mt-1 text-sm text-ink-2">
          Si ta feuille « Donnée » contient une ligne qui porte exactement le même nom, ses chiffres sont repris automatiquement. Sinon, saisis-les ci-dessus.
        </p>

        {saisie.indicateurs.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {saisie.indicateurs.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-page px-4 py-3">
                <span className="font-semibold">{i.libelle}</span>
                <span className="text-sm text-ink-2">{FAMILLES.find((f) => f.id === i.famille)?.libelle}</span>
                <span className="text-sm text-ink-2">
                  cible {i.sens === 'haut' ? '≥' : '≤'} {fmt(i.cible, i.unite)} · alerte {fmt(i.alerte, i.unite)}
                </span>
                <button onClick={() => supprimerIndicateur(i.id)} className="ml-auto p-2 rounded-full text-muted hover:text-alerte hover:bg-alerte-doux" aria-label="Supprimer">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1.2fr_1.3fr_0.8fr_0.8fr_auto] gap-2 items-end">
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Nom de l'indicateur</span>
            <input className={champ} value={nouveau.libelle} onChange={(e) => setNouveau({ ...nouveau, libelle: e.target.value })} placeholder="ex. Taux de retour client" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Rubrique</span>
            <select className={champ} value={nouveau.famille} onChange={(e) => setNouveau({ ...nouveau, famille: e.target.value as Famille })}>
              {FAMILLES_PERSO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Unité</span>
            <select className={champ} value={nouveau.unite} onChange={(e) => setNouveau({ ...nouveau, unite: e.target.value as Unite })}>
              {UNITES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Bon résultat</span>
            <select className={champ} value={nouveau.sens} onChange={(e) => setNouveau({ ...nouveau, sens: e.target.value as Sens })}>
              <option value="haut">Plus c'est haut</option>
              <option value="bas">Plus c'est bas</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Cible</span>
            <input className={`${champ} chiffres`} value={nouveau.cible} onChange={(e) => setNouveau({ ...nouveau, cible: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Alerte</span>
            <input className={`${champ} chiffres`} value={nouveau.alerte} onChange={(e) => setNouveau({ ...nouveau, alerte: e.target.value })} />
          </label>
          <button
            onClick={ajouterIndicateur}
            disabled={!nouveau.libelle.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bleu-450 hover:bg-bleu-550 disabled:opacity-40 text-white font-semibold px-4 py-2.5"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </section>
    </div>
  )
}
