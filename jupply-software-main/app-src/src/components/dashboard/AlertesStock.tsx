import type { ProduitAvecStock } from '../../types/stock'
import { useTabs } from '../../context/TabsContext'
import { stockAlerte } from '../../lib/api/stock'
import { SectionCard } from './SectionCard'
import { StatutBadge } from './StatutBadge'

export function AlertesStock({ produits }: { produits: ProduitAvecStock[] }) {
  const { ouvrirOnglet } = useTabs()
  const alertes = produits
    .filter((p) => p.statut !== 'normal')
    .sort((a, b) => (a.statut === b.statut ? 0 : a.statut === 'rupture' ? -1 : 1))
    .slice(0, 6)

  function voirAlertes() {
    ouvrirOnglet('alertes', 'Alertes stock')
  }

  return (
    <SectionCard titre="Alertes stock" lienTout={{ label: 'Voir tous les produits en alerte', onClick: voirAlertes }}>
      {alertes.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">
          Aucune alerte, tous les produits sont au-dessus de leur stock d'alerte.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
              <th className="font-semibold pb-2">Produit</th>
              <th className="font-semibold pb-2">Stock actuel</th>
              <th className="font-semibold pb-2">Stock d'alerte</th>
              <th className="font-semibold pb-2">Statut</th>
              <th className="font-semibold pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {alertes.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="py-2.5 font-medium text-text">{a.designation}</td>
                <td className="py-2.5 text-text-muted">{a.stock_actuel}</td>
                <td className="py-2.5 text-text-muted">{stockAlerte(a)}</td>
                <td className="py-2.5">
                  <StatutBadge statut={a.statut} />
                </td>
                <td className="py-2.5 text-right">
                  <button onClick={voirAlertes} className="text-xs font-semibold text-accent-deep hover:text-accent">
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  )
}
