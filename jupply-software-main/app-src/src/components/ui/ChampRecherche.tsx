import { Search, X } from 'lucide-react'

interface ChampRechercheProps {
  valeur: string
  onChange: (valeur: string) => void
  /** Ce que la recherche couvre, affiché au survol (le champ lui-même indique juste « Recherche »). */
  aide?: string
  className?: string
}

/** Zone « Recherche » d'un écran à liste, identique partout. */
export function ChampRecherche({ valeur, onChange, aide, className = 'w-[260px]' }: ChampRechercheProps) {
  return (
    <div
      title={aide}
      className={`flex items-center gap-2 bg-card border border-border rounded-md px-2.5 h-[30px] max-w-full focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 ${className}`}
    >
      <Search size={14} strokeWidth={1.75} className="text-text-muted shrink-0" />
      <input
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Recherche"
        aria-label={aide ? `Recherche : ${aide}` : 'Recherche'}
        className="bg-transparent outline-none text-[12.5px] w-full text-text placeholder:text-text-muted"
      />
      {valeur && (
        <button type="button" onClick={() => onChange('')} className="text-text-muted hover:text-text" title="Effacer la recherche">
          <X size={13} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}
