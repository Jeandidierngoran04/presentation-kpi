import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, CalendarRange, Lock, Play, Trash2 } from 'lucide-react'
import { Drapeau } from '../components/Drapeau'
import { usePresentations } from '../lib/stockage'
import { dateLongue, mois, numeroSemaine } from '../lib/format'
import type { Presentation } from '../lib/types'

function resumePeriode(p: Presentation) {
  if (p.glissant) return `Automatique · ${p.glissant} ${p.type === 'mensuel' ? 'derniers mois' : 'dernières semaines'}`
  const per = [...p.periodes].sort()
  if (p.type === 'mensuel') return per.map(mois).join(', ')
  return per.map((x) => `S${numeroSemaine(x)}`).join(' · ')
}

export function Accueil() {
  const { liste, supprimer } = usePresentations()
  const [filtre, setFiltre] = useState<'tout' | 'hebdo' | 'mensuel'>('tout')
  const nav = useNavigate()
  const visibles = liste.filter((p) => filtre === 'tout' || p.type === filtre)

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-10">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Bonjour Jean Didier</h1>
      <p className="mt-2 text-ink-2 text-lg">Quelle réunion prépares-tu ?</p>

      <div className="mt-8 grid sm:grid-cols-2 gap-5">
        <Link
          to="/nouvelle/hebdo"
          className="apparait group relative overflow-hidden rounded-3xl bg-nuit text-white p-7 sm:p-8 min-h-[200px] flex flex-col justify-between shadow-[0_10px_30px_-12px_rgba(13,27,46,.5)] hover:-translate-y-0.5 transition-transform"
        >
          <svg className="absolute -right-16 -bottom-24 opacity-10" width="320" height="320" viewBox="0 0 320 320" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx="160" cy="160" r={40 + i * 28} fill="none" stroke="white" strokeWidth="2" />
            ))}
          </svg>
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-bleu-450">
            <CalendarDays size={24} />
          </span>
          <div>
            <div className="text-2xl font-semibold">Réunion hebdo</div>
            <div className="mt-1 text-white/65">Avec les collaborateurs · OTD, stock, production, livreurs</div>
          </div>
          <ArrowRight className="absolute right-7 top-8 text-white/50 group-hover:text-white group-hover:translate-x-1 transition" />
        </Link>

        <Link
          to="/nouvelle/mensuel"
          className="apparait theme-mensuel group relative overflow-hidden rounded-3xl bg-carte border border-ligne p-7 sm:p-8 min-h-[200px] flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md transition"
          style={{ animationDelay: '60ms' }}
        >
          <span className="absolute left-0 top-0 h-full w-2 bg-nuit" />
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-bleu-100 text-bleu-650">
            <CalendarRange size={24} />
          </span>
          <div>
            <div className="text-2xl font-semibold text-nuit">Revue mensuelle</div>
            <div className="mt-1 text-ink-2">Avec le directeur · KPI du mois et problèmes récurrents</div>
          </div>
          <ArrowRight className="absolute right-7 top-8 text-muted group-hover:text-bleu-450 group-hover:translate-x-1 transition" />
        </Link>
      </div>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold">Historique</h2>
        <div className="flex rounded-full bg-carte border border-ligne p-1 text-sm">
          {(['tout', 'hebdo', 'mensuel'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-4 py-1.5 rounded-full font-medium transition-colors ${filtre === f ? 'bg-nuit text-white' : 'text-ink-2 hover:text-ink'}`}
            >
              {f === 'tout' ? 'Toutes' : f === 'hebdo' ? 'Hebdo' : 'Mensuelles'}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="mt-5 rounded-3xl border-2 border-dashed border-grille py-16 text-center text-muted">
          Aucune présentation pour l'instant.
        </div>
      ) : (
        <ul className="mt-5 grid gap-3">
          {visibles.map((p) => (
            <li
              key={p.id}
              onClick={() => nav(`/p/${p.id}`)}
              className="group cursor-pointer rounded-2xl bg-carte border border-ligne px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 hover:border-base hover:shadow-sm transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[17px] truncate">{p.titre}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider rounded-full bg-page text-ink-2 px-2 py-0.5">
                    {p.type === 'hebdo' ? 'Hebdo' : 'Mensuel'}
                  </span>
                  {p.clotureeLe && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-2">
                      <Lock size={12} /> Clôturée
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-ink-2 chiffres">
                  {resumePeriode(p)} · créée le {dateLongue(p.creeLe.slice(0, 10))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {p.pays.map((c) => (
                  <Drapeau key={c} code={c} taille={18} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    nav(`/p/${p.id}?diapo=0`)
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-bleu-450 text-white px-4 py-2 text-sm font-medium hover:bg-bleu-550"
                >
                  <Play size={15} fill="currentColor" /> Diaporama
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Supprimer « ${p.titre} » ?`)) supprimer(p.id)
                  }}
                  className="p-2 rounded-full text-muted hover:text-alerte hover:bg-alerte-doux opacity-0 group-hover:opacity-100 transition"
                  aria-label="Supprimer"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
