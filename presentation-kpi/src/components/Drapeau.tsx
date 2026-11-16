import { nomPays } from '../lib/pays'

export function Drapeau({ code, taille = 20 }: { code: string; taille?: number }) {
  return (
    <span
      className={`fi fi-${code.toLowerCase()} inline-block shrink-0 bg-cover`}
      style={{ width: taille * (4 / 3), height: taille, lineHeight: `${taille}px` }}
      role="img"
      aria-label={nomPays(code)}
    />
  )
}

export function NomPays({ code, taille = 20, className = '' }: { code: string; taille?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Drapeau code={code} taille={taille} />
      <span>{nomPays(code)}</span>
    </span>
  )
}
