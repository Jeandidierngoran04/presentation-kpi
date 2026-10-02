import type { ReactNode } from 'react'

interface SectionCardProps {
  titre: string
  lienTout?: { label: string; onClick: () => void }
  children: ReactNode
  className?: string
}

export function SectionCard({ titre, lienTout, children, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-card rounded-xl border border-border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text">{titre}</h2>
        {lienTout && (
          <button onClick={lienTout.onClick} className="text-xs font-semibold text-accent-deep hover:text-accent">
            {lienTout.label}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
