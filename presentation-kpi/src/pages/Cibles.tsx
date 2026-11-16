import { useState } from 'react'
import { ChevronDown, Plus, RotateCcw, X } from 'lucide-react'
import { Drapeau } from '../components/Drapeau'
import { CATALOGUE, FAMILLES, ciblesParDefaut } from '../lib/catalogue'
import { PAYS_SUIVIS } from '../lib/donnees'
import { PAYS, nomPays } from '../lib/pays'
import { useLignes } from '../lib/saisie'
import { useCibles } from '../lib/stockage'
import type { Indicateur, Seuils, Unite } from '../lib/types'

const UNITES: Record<Unite, string> = { '%': '%', nb: 'affaires', '‰': '‰', mois: 'mois', modeles: 'modèles', note: '' }

function Champ({ valeur, onChange, unite, vide }: { valeur?: number; onChange: (v: number | undefined) => void; unite: Unite; vide?: number }) {
  return (
    <label className="inline-flex items-center rounded-xl border border-ligne bg-page focus-within:border-bleu-450 focus-within:bg-white">
      <input
        type="number"
        step="any"
        value={valeur != null && Number.isFinite(valeur) ? valeur : ''}
        placeholder={vide != null ? String(vide) : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        className="chiffres w-24 bg-transparent px-3 py-2 text-right font-semibold outline-none placeholder:font-normal placeholder:text-muted"
      />
      {UNITES[unite] && <span className="pr-3 text-sm text-muted">{UNITES[unite]}</span>}
    </label>
  )
}

export function PageCibles() {
  const [cibles, setCibles] = useCibles()
  const { lignes, saisie } = useLignes() // saisie : pour se redessiner quand un indicateur est ajouté
  void saisie
  const [ouvert, setOuvert] = useState<string | null>('otd')
  const paysConnus = [...new Set([...PAYS_SUIVIS, ...lignes.map((l) => l.pays)])]

  const majDefaut = (id: string, champ: keyof Seuils, v: number | undefined) =>
    v !== undefined && setCibles({ ...cibles, [id]: { ...cibles[id], [champ]: v } })

  const majPays = (ind: Indicateur, pays: string, champ: keyof Seuils, v: number | undefined) => {
    const c = cibles[ind.id]
    const actuel = c.parPays?.[pays] ?? { cible: c.cible, alerte: c.alerte }
    const parPays = { ...(c.parPays ?? {}), [pays]: { ...actuel, [champ]: v ?? (champ === 'cible' ? c.cible : c.alerte) } }
    setCibles({ ...cibles, [ind.id]: { ...c, parPays } })
  }
  const retirerPays = (ind: Indicateur, pays: string) => {
    const c = cibles[ind.id]
    const parPays = { ...(c.parPays ?? {}) }
    delete parPays[pays]
    setCibles({ ...cibles, [ind.id]: { ...c, parPays } })
  }

  return (
    <div className="mx-auto max-w-[980px] px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Cibles et seuils</h1>
          <p className="mt-2 text-ink-2">Vert si la cible est atteinte, rouge au seuil d'alerte, orange entre les deux. Chaque pays peut avoir sa propre cible.</p>
        </div>
        <button
          onClick={() => confirm('Revenir aux valeurs de départ (cibles par pays comprises) ?') && setCibles(ciblesParDefaut())}
          className="inline-flex items-center gap-2 rounded-full border border-ligne bg-carte px-4 py-2 text-sm font-medium hover:border-base"
        >
          <RotateCcw size={15} /> Valeurs de départ
        </button>
      </div>

      <div className="mt-8 grid gap-6">
        {FAMILLES.filter((f) => CATALOGUE.some((i) => i.famille === f.id)).map((f) => (
          <section key={f.id} className="rounded-3xl bg-carte border border-ligne overflow-hidden">
            <h2 className="px-6 pt-5 pb-3 font-semibold text-lg">{f.libelle}</h2>
            <div className="hidden sm:grid grid-cols-[1fr_170px_170px_120px] gap-4 px-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <span>Indicateur</span>
              <span>Cible (défaut)</span>
              <span>Seuil d'alerte</span>
              <span />
            </div>
            {CATALOGUE.filter((i) => i.famille === f.id).map((i) => {
              const c = cibles[i.id] ?? { cible: i.cible, alerte: i.alerte }
              const parPays = c.parPays ?? {}
              const nbPays = Object.keys(parPays).length
              const estOuvert = ouvert === i.id
              const listePays = [...new Set([...paysConnus, ...Object.keys(parPays)])]
              return (
                <div key={i.id} className="border-t border-ligne">
                  <div className="grid sm:grid-cols-[1fr_170px_170px_120px] gap-x-4 gap-y-2 items-center px-6 py-3.5">
                    <div>
                      <div className="font-medium">{i.libelle}</div>
                      <div className="text-sm text-muted">{i.sens === 'haut' ? 'Plus c’est haut, mieux c’est' : 'Plus c’est bas, mieux c’est'}</div>
                    </div>
                    <Champ valeur={c.cible} unite={i.unite} onChange={(v) => majDefaut(i.id, 'cible', v)} />
                    <Champ valeur={c.alerte} unite={i.unite} onChange={(v) => majDefaut(i.id, 'alerte', v)} />
                    <button
                      onClick={() => setOuvert(estOuvert ? null : i.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${nbPays ? 'bg-bleu-100 text-bleu-650' : 'text-ink-2 hover:bg-page'}`}
                    >
                      Par pays{nbPays ? ` (${nbPays})` : ''}
                      <ChevronDown size={15} className={`transition-transform ${estOuvert ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {estOuvert && (
                    <div className="mx-6 mb-4 rounded-2xl bg-page p-4">
                      <div className="text-sm text-ink-2 mb-3">Laisse vide pour utiliser la cible par défaut ({c.cible}{UNITES[i.unite] ? ` ${UNITES[i.unite]}` : ''}).</div>
                      <div className="grid gap-2">
                        {listePays.map((p) => {
                          const propre = parPays[p]
                          return (
                            <div key={p} className="grid grid-cols-[1fr_auto_auto_32px] gap-3 items-center">
                              <span className="flex items-center gap-2 font-medium">
                                <Drapeau code={p} taille={16} />
                                {nomPays(p)}
                              </span>
                              <Champ valeur={propre?.cible} vide={c.cible} unite={i.unite} onChange={(v) => (v === undefined && !propre ? null : majPays(i, p, 'cible', v))} />
                              <Champ valeur={propre?.alerte} vide={c.alerte} unite={i.unite} onChange={(v) => (v === undefined && !propre ? null : majPays(i, p, 'alerte', v))} />
                              {propre ? (
                                <button onClick={() => retirerPays(i, p)} className="p-1.5 rounded-full text-muted hover:text-alerte hover:bg-white" title="Revenir à la cible par défaut">
                                  <X size={15} />
                                </button>
                              ) : (
                                <span />
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <Plus size={15} className="text-muted" />
                        <select
                          value=""
                          onChange={(e) => e.target.value && majPays(i, e.target.value, 'cible', c.cible)}
                          className="rounded-lg border border-ligne bg-white px-2 py-1.5 outline-none"
                        >
                          <option value="">Ajouter un autre pays…</option>
                          {PAYS.filter((p) => !listePays.includes(p.code)).map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
