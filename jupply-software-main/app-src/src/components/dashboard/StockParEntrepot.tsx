import type { StockParEntrepot as StockParEntrepotType } from '../../types/stock'
import { useTabs } from '../../context/TabsContext'
import { SectionCard } from './SectionCard'

export function StockParEntrepot({ donnees }: { donnees: StockParEntrepotType[] }) {
  const { ouvrirOnglet } = useTabs()
  return (
    <SectionCard
      titre="Stock par entrepôt"
      lienTout={{ label: 'Voir les entrepôts', onClick: () => ouvrirOnglet('entrepots', 'Entrepôts') }}
    >
      {donnees.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">Aucun entrepôt enregistré.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
              <th className="font-semibold pb-2">Entrepôt</th>
              <th className="font-semibold pb-2">Produits</th>
              <th className="font-semibold pb-2">Quantité totale</th>
              <th className="font-semibold pb-2">En rupture</th>
              <th className="font-semibold pb-2">En alerte</th>
            </tr>
          </thead>
          <tbody>
            {donnees.map((e) => (
              <tr key={e.entrepot_id} className="border-t border-border">
                <td className="py-2.5 font-medium text-text">{e.entrepot_nom}</td>
                <td className="py-2.5 text-text-muted">{e.nb_produits}</td>
                <td className="py-2.5 text-text-muted">{e.quantite_totale.toLocaleString('fr-FR')}</td>
                <td className="py-2.5 text-danger font-medium">{e.nb_rupture}</td>
                <td className="py-2.5 text-warn-deep font-medium">{e.nb_stock_faible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  )
}
