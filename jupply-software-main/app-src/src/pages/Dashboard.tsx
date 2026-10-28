import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Package, PackageX, ShieldAlert } from 'lucide-react'
import {
  calculerKpis,
  calculerStockParCategorie,
  getProduitsAvecStock,
  getMouvementsAujourdhui,
  getMouvementsRecents,
  getStockParEntrepot,
  type KpisStock,
} from '../lib/api/stock'
import type { ProduitAvecStock, MouvementAffiche, StockParEntrepot as StockParEntrepotType } from '../types/stock'
import { useTabs } from '../context/TabsContext'
import { compterDossiersOuverts } from '../lib/api/quarantaine'
import { KpiCard } from '../components/dashboard/KpiCard'
import { AlertesStock } from '../components/dashboard/AlertesStock'
import { MouvementsRecents } from '../components/dashboard/MouvementsRecents'
import { StockParCategorieChart } from '../components/dashboard/StockParCategorieChart'
import { TopArticles } from '../components/dashboard/TopArticles'
import { StockParEntrepot } from '../components/dashboard/StockParEntrepot'

interface DonneesDashboard {
  produits: ProduitAvecStock[]
  mouvements: MouvementAffiche[]
  entrepots: StockParEntrepotType[]
  kpis: KpisStock
  /** Null tant que la base n'a pas la gestion de la quarantaine. */
  quarantaine: { dossiers: number; unites: number } | null
}

export function Dashboard() {
  const { ongletActifId, ouvrirOnglet } = useTabs()
  const [donnees, setDonnees] = useState<DonneesDashboard | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const estActif = ongletActifId === 'dashboard'

  // Rechargé à chaque retour sur l'onglet : les indicateurs suivent les
  // opérations faites dans les autres onglets.
  useEffect(() => {
    if (!estActif) return
    let annule = false
    Promise.all([
      getProduitsAvecStock(),
      getMouvementsRecents(8),
      getStockParEntrepot(),
      getMouvementsAujourdhui(),
      compterDossiersOuverts(),
    ])
      .then(([produits, mouvements, entrepots, mouvementsAujourdhui, quarantaine]) => {
        if (annule) return
        setDonnees({ produits, mouvements, entrepots, kpis: calculerKpis(produits, mouvementsAujourdhui), quarantaine })
      })
      .catch((e) => {
        if (!annule) setErreur(e.message ?? 'Erreur inconnue lors du chargement des données.')
      })
    return () => {
      annule = true
    }
  }, [estActif])

  if (erreur) {
    return (
      <div className="h-full overflow-y-auto bg-canvas p-6">
        <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">
          <p className="font-semibold mb-1">Impossible de charger le Dashboard</p>
          <p className="opacity-90">{erreur}</p>
          <p className="mt-2 opacity-70">
            Vérifie que le fichier .env.local contient bien les clés Supabase, que le schéma SQL a été exécuté, et
            que des données de démo existent.
          </p>
        </div>
      </div>
    )
  }

  if (!donnees) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas text-sm text-text-muted">
        Chargement du tableau de bord...
      </div>
    )
  }

  const { produits, mouvements, entrepots, kpis, quarantaine } = donnees

  return (
    <div className="h-full overflow-y-auto bg-canvas p-4 flex flex-col gap-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">Gestion des Stocks</h1>
          <p className="text-[13px] text-text-muted mt-1">
            Suivez vos stocks, vos mouvements et vos niveaux d'approvisionnement en temps réel.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => ouvrirOnglet('nouvelle-reception', 'Nouvelle entrée')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-card border border-border text-text rounded-lg px-3 py-2 hover:bg-muted transition-colors"
          >
            <ArrowDownToLine size={14} strokeWidth={1.75} /> Nouvelle entrée
          </button>
          <button
            onClick={() => ouvrirOnglet('nouvelle-sortie', 'Nouvelle sortie')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-card border border-border text-text rounded-lg px-3 py-2 hover:bg-muted transition-colors"
          >
            <ArrowUpFromLine size={14} strokeWidth={1.75} /> Nouvelle sortie
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-accent-contrast rounded-lg px-3 py-2 hover:bg-accent-strong transition-colors">
            <ClipboardList size={14} strokeWidth={1.75} /> Inventaire
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icone={Package} label="Produits" valeur={String(kpis.totalProduits)} indication="Références enregistrées" />
        <KpiCard
          icone={ClipboardList}
          label="Stock total"
          valeur={kpis.stockTotal.toLocaleString('fr-FR')}
          indication="Unités disponibles"
        />
        <KpiCard
          icone={AlertTriangle}
          label="En alerte"
          valeur={String(kpis.stockFaible)}
          indication="Au niveau du stock d'alerte"
          tonalite="alerte"
        />
        <KpiCard
          icone={PackageX}
          label="En rupture"
          valeur={String(kpis.enRupture)}
          indication="Stock à zéro"
          tonalite="danger"
        />
        <KpiCard
          icone={ArrowDownToLine}
          label="Entrées aujourd'hui"
          valeur={String(kpis.entreesAujourdhui)}
          indication="Unités entrées"
          tonalite="succes"
        />
        <KpiCard
          icone={ArrowUpFromLine}
          label="Sorties aujourd'hui"
          valeur={String(kpis.sortiesAujourdhui)}
          indication="Unités sorties"
          tonalite="neutre"
        />
        <button type="button" onClick={() => ouvrirOnglet('quarantaine', 'Quarantaine')} className="text-left" title="Ouvrir la quarantaine">
          <KpiCard
            icone={ShieldAlert}
            label="En quarantaine"
            valeur={String(quarantaine?.unites ?? 0)}
            indication={`${quarantaine?.dossiers ?? 0} dossier(s) à traiter`}
            tonalite={quarantaine && quarantaine.dossiers > 0 ? 'danger' : 'succes'}
          />
        </button>
      </div>

      <AlertesStock produits={produits} />
      <MouvementsRecents mouvements={mouvements} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StockParCategorieChart donnees={calculerStockParCategorie(produits)} />
        <TopArticles />
      </div>

      <StockParEntrepot donnees={entrepots} />
    </div>
  )
}
