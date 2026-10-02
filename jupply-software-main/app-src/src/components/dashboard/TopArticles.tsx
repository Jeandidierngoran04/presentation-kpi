import { useEffect, useState } from 'react'
import { getTopProduitsMouvementes, type PeriodeFiltre } from '../../lib/api/stock'
import type { TopProduitMouvemente } from '../../types/stock'
import { useTabs } from '../../context/TabsContext'
import { SectionCard } from './SectionCard'

const PERIODES: { valeur: PeriodeFiltre; label: string }[] = [
  { valeur: 'jour', label: "Aujourd'hui" },
  { valeur: 'semaine', label: 'Cette semaine' },
  { valeur: 'mois', label: 'Ce mois' },
  { valeur: 'annee', label: 'Cette année' },
]

export function TopArticles() {
  const [periode, setPeriode] = useState<PeriodeFiltre>('semaine')
  const [produits, setProduits] = useState<TopProduitMouvemente[]>([])
  const [chargement, setChargement] = useState(true)
  const { ongletActifId } = useTabs()
  const estActif = ongletActifId === 'dashboard'

  // Rechargé au changement de période et à chaque retour sur le Dashboard.
  useEffect(() => {
    if (!estActif) return
    let annule = false
    getTopProduitsMouvementes(periode)
      .then((data) => {
        if (!annule) setProduits(data)
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [periode, estActif])

  return (
    <SectionCard titre="Produits les plus mouvementés">
      <div className="flex gap-1.5 mb-4">
        {PERIODES.map((p) => (
          <button
            key={p.valeur}
            onClick={() => setPeriode(p.valeur)}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-colors ${
              periode === p.valeur ? 'bg-accent text-accent-contrast' : 'bg-muted text-text-muted hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="text-sm text-text-muted py-4 text-center">Chargement...</p>
      ) : produits.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">Aucun mouvement sur cette période.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
              <th className="font-semibold pb-2">Produit</th>
              <th className="font-semibold pb-2">Qté entrée</th>
              <th className="font-semibold pb-2">Qté sortie</th>
              <th className="font-semibold pb-2">Mouvements</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => (
              <tr key={p.produit_id} className="border-t border-border">
                <td className="py-2.5 font-medium text-text">{p.produit_designation}</td>
                <td className="py-2.5 text-accent-deep font-medium">+{p.quantite_entree}</td>
                <td className="py-2.5 text-danger font-medium">-{p.quantite_sortie}</td>
                <td className="py-2.5 text-text-muted">{p.nb_mouvements}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  )
}
