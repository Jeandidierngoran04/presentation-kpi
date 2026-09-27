import { useTabs } from '../../context/TabsContext'
import { useSelection } from '../../context/SelectionContext'
import { moduleParId, type ActionModule } from '../../lib/modules'

export function SousEntete() {
  const { moduleActifId, ongletActifId, ouvrirOnglet } = useTabs()
  const { produitSelectionneId, declencherSortieManuelle } = useSelection()
  const module = moduleParId(moduleActifId)

  function onClic(a: ActionModule) {
    // "Sorties Manuelles" prend en compte le produit selectionne (clic simple)
    // dans Produits, meme si l'onglet Sortie est deja ouvert.
    if (a.ecran === 'sorties') declencherSortieManuelle(produitSelectionneId)
    ouvrirOnglet(a.ecran, a.label)
  }

  return (
    <div className="flex items-center gap-0.5 h-11 shrink-0 bg-card border-b border-border px-2 overflow-x-auto">
      {module.actions.map((a) => {
        const actif = a.ecran === ongletActifId
        return (
          <button
            key={a.ecran}
            onClick={() => onClic(a)}
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors ${
              actif ? 'text-accent' : 'text-text-muted hover:text-text hover:bg-muted'
            }`}
          >
            <a.icone size={15} strokeWidth={1.6} />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}
