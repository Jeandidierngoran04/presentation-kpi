import { useState, type FormEvent } from 'react'
import { Bell, Search, X } from 'lucide-react'
import { useTabs, type EcranId } from '../../context/TabsContext'
import { useSelection } from '../../context/SelectionContext'
import { MENU, MENU_PARAMETRE, MODULE_PAR_ECRAN } from '../../lib/modules'

/** Icône du groupe d'un écran : distingue les onglets homonymes (Sorties / Historique des sorties). */
function iconeDe(ecran: EcranId) {
  const groupe = [...MENU, MENU_PARAMETRE].find((g) => g.id === MODULE_PAR_ECRAN[ecran])
  return groupe?.icone
}

/**
 * Seule ligne du haut de la zone de travail : les onglets ouverts à gauche
 * (déplaçables par glisser-déposer, qui rétrécissent comme dans un navigateur
 * au lieu de défiler), la recherche de produits et les notifications à droite.
 */
export function BarreOnglets() {
  const { onglets, ongletActifId, activerOnglet, fermerOnglet, deplacerOnglet, ouvrirOnglet } = useTabs()
  const { demanderRechercheProduit } = useSelection()
  const [glisse, setGlisse] = useState<EcranId | null>(null)
  const [recherche, setRecherche] = useState('')

  // La recherche ouvre la liste des produits filtrée (code ou désignation, * = "contient").
  function onRechercher(e: FormEvent) {
    e.preventDefault()
    if (!recherche.trim()) return
    demanderRechercheProduit(recherche.trim())
    ouvrirOnglet('produits', 'Produits')
    setRecherche('')
  }

  return (
    <div className="shrink-0 h-[var(--barre-haute-height)] flex items-end gap-3 bg-canvas pl-2 pr-3">
      <div className="flex-1 min-w-0 h-full flex items-end gap-1 overflow-x-auto overflow-y-hidden pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {onglets.map((o) => {
          const actif = o.id === ongletActifId
          const Icone = iconeDe(o.id)
          return (
            <div
              key={o.id}
              draggable
              onDragStart={(e) => {
                setGlisse(o.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (glisse && glisse !== o.id) {
                  e.preventDefault()
                  deplacerOnglet(glisse, o.id)
                }
              }}
              onDragEnd={() => setGlisse(null)}
              onClick={() => activerOnglet(o.id)}
              onAuxClick={(e) => {
                // Clic molette : ferme l'onglet, comme dans un navigateur.
                if (e.button === 1) fermerOnglet(o.id)
              }}
              title={o.titre}
              className={`group relative flex-[0_1_200px] min-w-[96px] flex items-center gap-1.5 pl-2.5 pr-1.5 h-8 text-[13px] font-medium whitespace-nowrap cursor-pointer rounded-t-[10px] transition-colors ${
                actif ? 'onglet-actif bg-card text-text' : 'text-text-muted hover:text-text hover:bg-card/50'
              } ${glisse === o.id ? 'opacity-60' : ''}`}
            >
              {Icone && <Icone size={13} strokeWidth={1.75} className="shrink-0 opacity-70" />}
              <span className="flex-1 min-w-0 truncate">{o.titre}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fermerOnglet(o.id)
                }}
                className={`shrink-0 rounded p-0.5 text-text-muted hover:text-danger ${actif ? '' : 'opacity-0 group-hover:opacity-100'}`}
                title="Fermer l'onglet"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="shrink-0 self-center flex items-center gap-1.5">
        <form
          onSubmit={onRechercher}
          className="flex items-center gap-2 bg-card border border-border rounded-md px-2.5 h-7 w-60 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30"
        >
          <Search size={14} className="text-text-muted shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Code ou nom du produit (* = contient)"
            className="bg-transparent outline-none text-[12.5px] w-full text-text placeholder:text-text-muted"
          />
        </form>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-card relative"
          title="Notifications"
        >
          <Bell size={16} strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
        </button>
      </div>
    </div>
  )
}
