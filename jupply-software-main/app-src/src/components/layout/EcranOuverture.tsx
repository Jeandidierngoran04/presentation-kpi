import { useEffect, useState } from 'react'

/** Durée minimale de l'animation : elle se joue en entier, même si l'application est prête avant. */
const DUREE_MINIMALE = 1900
const DUREE_SORTIE = 450

/**
 * Écran d'ouverture de Jupply : le « J » apparaît en tournant, des ondes
 * s'en échappent, un anneau tourne autour, le nom s'écrit lettre par lettre,
 * puis l'écran s'efface en douceur sur l'application. Il remplace le
 * « Chargement... » et masque le temps de démarrage.
 */
export function EcranOuverture({ pret }: { pret: boolean }) {
  const [debut, setDebut] = useState(() => Date.now())
  const [etat, setEtat] = useState<'visible' | 'sortie' | 'fini'>('visible')

  // L'application redevient en chargement (ex. connexion) : l'ouverture rejoue.
  useEffect(() => {
    if (!pret && etat === 'fini') {
      setDebut(Date.now())
      setEtat('visible')
    }
  }, [pret, etat])

  useEffect(() => {
    if (!pret || etat !== 'visible') return
    const attente = Math.max(0, DUREE_MINIMALE - (Date.now() - debut))
    const t1 = setTimeout(() => setEtat('sortie'), attente)
    return () => clearTimeout(t1)
  }, [pret, etat, debut])

  useEffect(() => {
    if (etat !== 'sortie') return
    const t = setTimeout(() => setEtat('fini'), DUREE_SORTIE)
    return () => clearTimeout(t)
  }, [etat])

  if (etat === 'fini') return null

  return (
    <div
      className={`ouverture fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas ${etat === 'sortie' ? 'ouverture-sortie' : ''}`}
      role="status"
      aria-label="Ouverture de Jupply"
    >
      {/* Halo de fond */}
      <div className="ouverture-halo" aria-hidden />

      <div className="relative w-36 h-36 flex items-center justify-center" aria-hidden>
        {/* Ondes qui s'échappent du logo */}
        <span className="ouverture-onde" />
        <span className="ouverture-onde ouverture-onde-2" />
        <span className="ouverture-onde ouverture-onde-3" />
        {/* Anneau qui tourne autour */}
        <span className="ouverture-anneau" />
        {/* Le J */}
        <div className="ouverture-logo w-20 h-20 rounded-[22px] bg-accent flex items-center justify-center">
          <span className="ouverture-lettre font-bold text-accent-contrast text-[44px] leading-none">J</span>
          <span className="ouverture-reflet" />
        </div>
      </div>

      {/* Le nom, lettre par lettre */}
      <div className="mt-7 flex text-[26px] font-semibold tracking-tight text-text" aria-hidden>
        {'Jupply'.split('').map((lettre, i) => (
          <span key={i} className="ouverture-nom" style={{ animationDelay: `${600 + i * 70}ms` }}>
            {lettre}
          </span>
        ))}
      </div>

      {/* Barre de progression lumineuse */}
      <div className="mt-6 w-44 h-1 rounded-full bg-border/60 overflow-hidden" aria-hidden>
        <span className="ouverture-barre" />
      </div>
    </div>
  )
}
