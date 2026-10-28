import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface ChampRechercheProps {
  valeur: string
  onChange: (valeur: string) => void
  /** Ce que la recherche couvre, affiché au survol (le champ lui-même indique juste « Recherche »). */
  aide?: string
  /** Largeur du champ une fois ouvert. */
  className?: string
}

/**
 * Recherche d'un écran à liste, identique partout : une simple loupe, qui
 * s'ouvre en champ au clic. Le champ se referme quand il est vide et perd le
 * focus, ou avec Échap (qui efface aussi la recherche).
 */
export function ChampRecherche({ valeur, onChange, aide, className = 'w-[260px]' }: ChampRechercheProps) {
  const [ouvert, setOuvert] = useState(false)
  const champRef = useRef<HTMLInputElement>(null)
  const visible = ouvert || valeur !== ''

  useEffect(() => {
    if (ouvert) champRef.current?.focus()
  }, [ouvert])

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        title={aide ? `Recherche : ${aide}` : 'Recherche'}
        aria-label="Recherche"
        className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text hover:bg-muted transition-colors"
      >
        <Search size={15} strokeWidth={1.75} />
      </button>
    )
  }

  return (
    <div
      title={aide}
      className={`flex items-center gap-2 bg-card border border-border rounded-md px-2.5 h-8 max-w-full focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 animate-[ouverture-recherche_140ms_ease-out] ${className}`}
    >
      <Search size={14} strokeWidth={1.75} className="text-text-muted shrink-0" />
      <input
        ref={champRef}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!valeur) setOuvert(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('')
            setOuvert(false)
          }
        }}
        placeholder="Recherche"
        aria-label={aide ? `Recherche : ${aide}` : 'Recherche'}
        className="bg-transparent outline-none text-[12.5px] w-full text-text placeholder:text-text-muted"
      />
      {valeur && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            champRef.current?.focus()
          }}
          className="text-text-muted hover:text-text"
          title="Effacer la recherche"
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}
