// Écrans du module Historique : une liste par type de document, toutes
// construites sur ListeDocuments (filtres, détail, exports).
import { useTabs, type EcranId } from '../context/TabsContext'
import { ListeDocuments, type ConfigDocuments } from '../components/historique/ListeDocuments'
import {
  CONFIG_COMMANDES,
  CONFIG_ENTREES,
  CONFIG_MOUVEMENTS,
  CONFIG_NON_CONFORMITES,
  CONFIG_REINTEGRATIONS,
  CONFIG_SORTIES,
  CONFIG_TRANSFERTS,
} from '../components/historique/configs'
import type { DocumentHistorique } from '../lib/api/historique'

function EcranHistorique<D extends DocumentHistorique, L extends { id?: unknown }>({
  ecran,
  config,
}: {
  ecran: EcranId
  config: ConfigDocuments<D, L>
}) {
  const { ongletActifId } = useTabs()
  return <ListeDocuments config={config} titre={`Historique des ${config.libelle.toLowerCase()}`} estActif={ongletActifId === ecran} />
}

export function HistoriqueSorties() {
  return <EcranHistorique ecran="historique-sorties" config={CONFIG_SORTIES} />
}

export function HistoriqueEntrees() {
  return <EcranHistorique ecran="historique-entrees" config={CONFIG_ENTREES} />
}

export function HistoriqueReintegrations() {
  return <EcranHistorique ecran="historique-reintegrations" config={CONFIG_REINTEGRATIONS} />
}

export function HistoriqueTransferts() {
  return <EcranHistorique ecran="historique-transferts" config={CONFIG_TRANSFERTS} />
}

export function HistoriqueNonConformites() {
  return <EcranHistorique ecran="historique-non-conformites" config={CONFIG_NON_CONFORMITES} />
}

export function HistoriqueCommandes() {
  return <EcranHistorique ecran="historique-commandes" config={CONFIG_COMMANDES} />
}

export function HistoriqueMouvements() {
  return <EcranHistorique ecran="mouvements" config={CONFIG_MOUVEMENTS} />
}
