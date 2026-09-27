import type { InputHTMLAttributes } from 'react'
import { CLASSE_CHAMP, CLASSE_CHAMP_COMPACT } from './styles'

interface ChampProps extends InputHTMLAttributes<HTMLInputElement> {
  compact?: boolean
}

export function Champ({ compact = false, className = '', ...rest }: ChampProps) {
  return <input className={`${compact ? CLASSE_CHAMP_COMPACT : CLASSE_CHAMP} ${className}`} {...rest} />
}
