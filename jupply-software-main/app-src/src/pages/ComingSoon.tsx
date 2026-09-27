import { Construction } from 'lucide-react'

export function ComingSoon({ titre }: { titre: string }) {
  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center text-center py-24 gap-3">
      <div className="w-14 h-14 rounded-xl bg-accent-soft flex items-center justify-center">
        <Construction size={24} className="text-accent-deep" strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-text">{titre}</h1>
      <p className="text-sm text-text-muted max-w-sm">
        Fonctionnalité à venir. Cet écran fait partie de la navigation prévue pour le module Gestion des Stocks,
        son contenu sera développé dans une prochaine étape.
      </p>
    </div>
  )
}
