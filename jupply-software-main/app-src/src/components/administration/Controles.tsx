import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// ---------- Petits contrôles du panneau (sombre, compact) ----------

export const CLASSE_CHAMP_SOMBRE =
  'h-[30px] rounded-md bg-[#2c2c33] border border-white/10 px-2 text-[12.5px] text-zinc-100 outline-none focus:border-emerald-400/70'

export function Section({ titre, badge, children, ouverteParDefaut = true }: { titre: string; badge?: string; children: ReactNode; ouverteParDefaut?: boolean }) {
  const [ouverte, setOuverte] = useState(ouverteParDefaut)
  return (
    <section className="border-b border-black/40">
      <button
        type="button"
        onClick={() => setOuverte((o) => !o)}
        className="w-full flex items-center gap-2 px-3 h-10 bg-[#24242a] text-[13.5px] font-semibold text-zinc-100 hover:bg-[#2a2a31]"
        aria-expanded={ouverte}
      >
        <ChevronDown size={14} strokeWidth={2} className={`transition-transform ${ouverte ? '' : '-rotate-90'}`} />
        {titre}
        {badge && <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">{badge}</span>}
      </button>
      {ouverte && <div className="flex flex-col gap-2.5 px-3 py-3 bg-[#1d1d22]">{children}</div>}
    </section>
  )
}

export function Ligne({ label, children, retrait = false }: { label: string; children: ReactNode; retrait?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${retrait ? 'pl-3 border-l border-white/15 ml-1' : ''}`}>
      <span className="w-[112px] shrink-0 truncate text-[12.5px] text-zinc-300" title={label}>
        {label}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
    </div>
  )
}

export function ChampNombre({ valeur: v, onChange, min = 0, max = 200, pas = 1, unite = 'px' }: { valeur: number; onChange: (n: number) => void; min?: number; max?: number; pas?: number; unite?: string }) {
  return (
    <label className={`${CLASSE_CHAMP_SOMBRE} w-[104px] flex items-center gap-1`}>
      <input
        type="number"
        value={v}
        min={min}
        max={max}
        step={pas}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className="w-full bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-[11px] text-zinc-500">{unite}</span>
    </label>
  )
}

export function Pastille({ couleur, onChange, titre }: { couleur: string; onChange: (c: string) => void; titre: string }) {
  return (
    <label
      className="relative w-7 h-7 shrink-0 rounded-full border-2 border-white/70 cursor-pointer shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
      style={{ background: couleur }}
      title={titre}
    >
      <input type="color" value={couleur} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
    </label>
  )
}

export function Choix<T extends string | number>({ valeur: v, options, onChange }: { valeur: T; options: { valeur: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select
      value={String(v)}
      onChange={(e) => {
        const trouve = options.find((o) => String(o.valeur) === e.target.value)
        if (trouve) onChange(trouve.valeur)
      }}
      className={`${CLASSE_CHAMP_SOMBRE} w-full cursor-pointer`}
    >
      {options.map((o) => (
        <option key={String(o.valeur)} value={String(o.valeur)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function BoutonVisuel({ actif, onClick, titre, children }: { actif: boolean; onClick: () => void; titre: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titre}
      aria-pressed={actif}
      className={`h-8 min-w-[52px] px-2.5 rounded-md inline-flex items-center justify-center text-[12px] font-bold border transition-colors ${
        actif ? 'bg-teal-700/80 border-teal-500/60 text-white' : 'bg-[#2c2c33] border-white/10 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
