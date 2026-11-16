import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { numeroSemaine } from '../lib/format'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => new Date(s + 'T00:00:00')
const lundiDe = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * Calendrier de sélection : semaines (une ligne = une semaine, clic sur la ligne) ou mois (grille de l'année).
 * Un point vert signale les périodes qui ont des chiffres.
 */
export function Calendrier({
  type,
  selection,
  disponibles,
  onChange,
  multiple = true,
}: {
  type: 'semaine' | 'mois'
  selection: string[]
  disponibles: string[]
  onChange: (s: string[]) => void
  multiple?: boolean
}) {
  const reference = deIso([...selection].sort().at(-1) ?? [...disponibles].sort().at(-1) ?? iso(new Date()))
  const [vue, setVue] = useState(new Date(reference.getFullYear(), type === 'mois' ? 0 : reference.getMonth(), 1))
  const dispo = new Set(disponibles)
  const choisi = new Set(selection)
  const basculer = (p: string) => {
    if (!multiple) return onChange([p])
    onChange(choisi.has(p) ? selection.filter((x) => x !== p) : [...selection, p].sort())
  }

  const entete = (titre: string, pas: number) => (
    <div className="flex items-center justify-between mb-3">
      <button onClick={() => setVue(new Date(vue.getFullYear(), vue.getMonth() - pas, 1))} className="p-2 rounded-full hover:bg-page" aria-label="Précédent">
        <ChevronLeft size={18} />
      </button>
      <span className="font-semibold capitalize">{titre}</span>
      <button onClick={() => setVue(new Date(vue.getFullYear(), vue.getMonth() + pas, 1))} className="p-2 rounded-full hover:bg-page" aria-label="Suivant">
        <ChevronRight size={18} />
      </button>
    </div>
  )

  if (type === 'mois') {
    const annee = vue.getFullYear()
    return (
      <div className="rounded-2xl border border-ligne p-4 max-w-[420px]">
        {entete(String(annee), 12)}
        <div className="grid grid-cols-4 gap-2">
          {MOIS_COURTS.map((m, i) => {
            const p = iso(new Date(annee, i, 1))
            const actif = choisi.has(p)
            return (
              <button
                key={p}
                onClick={() => basculer(p)}
                className={`relative rounded-xl py-3 text-sm font-medium transition ${actif ? 'bg-nuit text-white' : 'hover:bg-page text-ink'}`}
              >
                {m}
                {dispo.has(p) && <span className={`absolute right-2 top-2 w-1.5 h-1.5 rounded-full ${actif ? 'bg-white' : 'bg-bon'}`} />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Semaines qui touchent le mois affiché
  const debut = lundiDe(vue)
  const finMois = new Date(vue.getFullYear(), vue.getMonth() + 1, 0)
  const semaines: Date[] = []
  for (let d = new Date(debut); d <= finMois; d.setDate(d.getDate() + 7)) semaines.push(new Date(d))

  return (
    <div className="rounded-2xl border border-ligne p-4 max-w-[420px]">
      {entete(`${NOMS_MOIS[vue.getMonth()]} ${vue.getFullYear()}`, 1)}
      <div className="grid grid-cols-[52px_repeat(7,1fr)] text-xs text-muted mb-1">
        <span />
        {JOURS.map((j, i) => (
          <span key={i} className="text-center">
            {j}
          </span>
        ))}
      </div>
      <div className="grid gap-1">
        {semaines.map((l) => {
          const p = iso(l)
          const actif = choisi.has(p)
          return (
            <button
              key={p}
              onClick={() => basculer(p)}
              className={`grid grid-cols-[52px_repeat(7,1fr)] items-center rounded-xl py-1.5 text-sm transition ${actif ? 'bg-nuit text-white' : 'hover:bg-page'}`}
              title={`Semaine du ${l.toLocaleDateString('fr-FR')}`}
            >
              <span className={`chiffres font-semibold text-left pl-2 flex items-center gap-1 ${actif ? 'text-white' : 'text-bleu-550'}`}>
                S{numeroSemaine(p)}
                {dispo.has(p) && <span className={`w-1.5 h-1.5 rounded-full ${actif ? 'bg-white' : 'bg-bon'}`} />}
              </span>
              {Array.from({ length: 7 }, (_, i) => {
                const j = new Date(l)
                j.setDate(j.getDate() + i)
                const horsMois = j.getMonth() !== vue.getMonth()
                return (
                  <span key={i} className={`chiffres text-center ${horsMois ? (actif ? 'text-white/50' : 'text-muted/60') : ''}`}>
                    {j.getDate()}
                  </span>
                )
              })}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-bon" /> semaine avec des chiffres
      </div>
    </div>
  )
}
