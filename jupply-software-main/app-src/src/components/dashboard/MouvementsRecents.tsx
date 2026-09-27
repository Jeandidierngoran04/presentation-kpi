import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, SlidersHorizontal, ClipboardCheck, Move, RotateCcw } from 'lucide-react'
import type { MouvementAffiche, TypeMouvement } from '../../types/stock'
import { SectionCard } from './SectionCard'

function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('fr-FR'),
    heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}

// Couleurs imposées par le cahier des charges : entrées en vert, sorties en
// rouge. Les autres types de mouvement restent neutres.
const STYLES_TYPE: Record<TypeMouvement, { label: string; icone: typeof ArrowDownToLine; classe: string; signe: '+' | '-' | '' }> = {
  entree: { label: 'Entrée', icone: ArrowDownToLine, classe: 'bg-accent-soft text-accent-deep', signe: '+' },
  sortie: { label: 'Sortie', icone: ArrowUpFromLine, classe: 'bg-danger-soft text-danger-deep', signe: '-' },
  transfert: { label: 'Transfert', icone: ArrowLeftRight, classe: 'bg-muted text-text-muted', signe: '' },
  ajustement: { label: 'Ajustement', icone: SlidersHorizontal, classe: 'bg-warn-soft text-warn-deep', signe: '' },
  inventaire: { label: 'Inventaire', icone: ClipboardCheck, classe: 'bg-warn-soft text-warn-deep', signe: '' },
  deplacement: { label: 'Déplacement', icone: Move, classe: 'bg-muted text-text-muted', signe: '' },
  reintegration: { label: 'Réintégration', icone: RotateCcw, classe: 'bg-accent-soft text-accent-deep', signe: '+' },
}

export function MouvementsRecents({ mouvements }: { mouvements: MouvementAffiche[] }) {
  return (
    <SectionCard titre="Mouvements récents" lienTout={{ label: 'Voir tous les mouvements', to: '/stocks/mouvements' }}>
      {mouvements.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">Aucun mouvement enregistré pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
                <th className="font-semibold pb-2">Date</th>
                <th className="font-semibold pb-2">Heure</th>
                <th className="font-semibold pb-2">Produit</th>
                <th className="font-semibold pb-2">Type</th>
                <th className="font-semibold pb-2">Quantité</th>
                <th className="font-semibold pb-2">Stock avant</th>
                <th className="font-semibold pb-2">Stock après</th>
                <th className="font-semibold pb-2">Utilisateur</th>
                <th className="font-semibold pb-2">Référence</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m) => {
                const { date, heure } = formatDate(m.cree_le)
                const { label, icone: Icone, classe, signe } = STYLES_TYPE[m.type]
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-2.5 text-text-muted">{date}</td>
                    <td className="py-2.5 text-text-muted">{heure}</td>
                    <td className="py-2.5 font-medium text-text">{m.produit_designation}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${classe}`}>
                        <Icone size={11} strokeWidth={1.75} />
                        {label}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-text">
                      {signe}
                      {m.quantite}
                    </td>
                    <td className="py-2.5 text-text-muted">{m.stock_avant}</td>
                    <td className="py-2.5 text-text-muted">{m.stock_apres}</td>
                    <td className="py-2.5 text-text-muted">{m.utilisateur_nom}</td>
                    <td className="py-2.5 text-text-muted font-mono text-xs">{m.reference}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
