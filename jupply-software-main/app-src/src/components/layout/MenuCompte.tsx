import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function initiales(nom: string) {
  return nom
    .split(' ')
    .map((mot) => mot[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function MenuCompte() {
  const { profil, deconnexion } = useAuth()
  const nom = profil?.nom_complet ?? 'Utilisateur'
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function onClicExterieur(e: MouseEvent) {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false)
    }
    function onEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    window.addEventListener('mousedown', onClicExterieur)
    window.addEventListener('keydown', onEchap)
    return () => {
      window.removeEventListener('mousedown', onClicExterieur)
      window.removeEventListener('keydown', onEchap)
    }
  }, [ouvert])

  return (
    <div className="relative" ref={conteneur}>
      <button
        onClick={() => setOuvert((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg pl-1 pr-1.5 py-1 hover:bg-topbar-hover transition-colors"
        title="Mon compte"
      >
        <span className="w-6 h-6 rounded-md bg-accent text-accent-contrast flex items-center justify-center text-[10px] font-bold">
          {initiales(nom)}
        </span>
        <ChevronDown size={14} className="text-topbar-muted" strokeWidth={1.75} />
      </button>

      {ouvert && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-card border border-border rounded-xl py-1.5 z-50 text-text">
          <div className="px-3 py-2">
            <div className="text-[13px] font-semibold leading-tight">{nom}</div>
            <div className="text-[11px] text-text-muted capitalize">{profil?.role ?? ''}</div>
          </div>
          <div className="h-px bg-border my-1" />
          <button
            disabled
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-muted/70 cursor-not-allowed"
          >
            <UserRound size={15} strokeWidth={1.6} />
            Mon profil
          </button>
          <button
            disabled
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-muted/70 cursor-not-allowed"
          >
            <Settings size={15} strokeWidth={1.6} />
            Préférences
          </button>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => {
              setOuvert(false)
              deconnexion()
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-danger hover:bg-danger-soft"
          >
            <LogOut size={15} strokeWidth={1.6} />
            Sortie
          </button>
        </div>
      )}
    </div>
  )
}
