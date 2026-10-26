// Fenêtre « Info » d'un produit (tableau Produits, et plus tard Alertes stock).
// Lecture seule : affiche les informations déjà présentes dans l'application.
import { useEffect, useState } from 'react'
import { getFournisseursProduit, getMouvementsProduit } from '../../lib/api/produits'
import { getStockLots } from '../../lib/api/lots'
import type {
  Fournisseur,
  LocalisationProduit,
  MouvementAffiche,
  ProduitAvecStock,
  StockLot,
  TypeMouvement,
  TypeProduit,
} from '../../types/stock'
import { StatutBadge } from '../dashboard/StatutBadge'
import { InfoChamps, InfoSection, InfoVide, ItemInfoPanel } from '../ui/ItemInfo'

const LABEL_TYPE: Record<TypeProduit, string> = {
  consommable: 'Consommable',
  outillage: 'Outillage',
  rotable: 'Rotable',
}

const SENS_MOUVEMENT: Record<TypeMouvement, { label: string; classe: string; signe: string }> = {
  entree: { label: 'Entrée', classe: 'text-accent-deep', signe: '+' },
  sortie: { label: 'Sortie', classe: 'text-danger-deep', signe: '-' },
  transfert: { label: 'Transfert', classe: 'text-text-muted', signe: '' },
  ajustement: { label: 'Ajustement', classe: 'text-warn-deep', signe: '' },
  inventaire: { label: 'Inventaire', classe: 'text-warn-deep', signe: '' },
  deplacement: { label: 'Déplacement', classe: 'text-text-muted', signe: '' },
  reintegration: { label: 'Réintégration', classe: 'text-accent-deep', signe: '+' },
}

const nombre = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('fr-FR'))
const ouiNon = (b: boolean) => (b ? 'Oui' : 'Non')
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

interface Props {
  produit: ProduitAvecStock
  /** Quantité restant attendue (réceptions et commandes en cours). */
  enCommande: number
  localisations: LocalisationProduit[]
  equivalents: ProduitAvecStock[]
  onFermer: () => void
  elementRetour?: HTMLElement | null
}

export function ProduitInfoPanel({ produit, enCommande, localisations, equivalents, onFermer, elementRetour }: Props) {
  const [mouvements, setMouvements] = useState<MouvementAffiche[] | null>(null)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[] | null>(null)
  const [lots, setLots] = useState<StockLot[] | null>(null)

  useEffect(() => {
    let actif = true
    setMouvements(null)
    setFournisseurs(null)
    setLots(null)
    getMouvementsProduit(produit.id, 10).then((m) => actif && setMouvements(m)).catch(() => actif && setMouvements([]))
    getFournisseursProduit(produit.id).then((f) => actif && setFournisseurs(f)).catch(() => actif && setFournisseurs([]))
    getStockLots(produit.id).then((l) => actif && setLots(l?.get(produit.id) ?? [])).catch(() => actif && setLots([]))
    return () => {
      actif = false
    }
  }, [produit.id])

  const suiviParLot = produit.gere_lot || produit.gere_numero_serie || produit.gere_expiration
  const aujourdhui = new Date().toISOString().slice(0, 10)

  const details = (
    <>
      <InfoSection titre="Identification">
        <InfoChamps
          champs={[
            { label: 'Référence', valeur: <span className="font-mono">{produit.reference}</span> },
            { label: 'Désignation', valeur: produit.designation },
            { label: 'Catégorie', valeur: produit.categorie_nom ?? '—' },
            { label: 'Type', valeur: LABEL_TYPE[produit.type] },
            { label: 'Unité de mesure', valeur: produit.unite_mesure },
            {
              label: 'Prix moyen pondéré',
              valeur: <span className="tabular-nums">{produit.prix_moyen_pondere.toLocaleString('fr-FR')} XOF</span>,
            },
          ]}
        />
      </InfoSection>
      <InfoSection titre="Suivi">
        <InfoChamps
          champs={[
            { label: 'Par lot', valeur: ouiNon(produit.gere_lot) },
            { label: 'Par n° de série', valeur: ouiNon(produit.gere_numero_serie) },
            { label: "Date d'expiration", valeur: ouiNon(produit.gere_expiration) },
          ]}
        />
      </InfoSection>
      <InfoSection titre="Produits équivalents">
        {equivalents.length === 0 ? (
          <InfoVide>Aucun produit équivalent.</InfoVide>
        ) : (
          <ul className="flex flex-col gap-1">
            {equivalents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-text-muted mr-1.5">{e.reference}</span>
                  {e.designation}
                </span>
                <span className="shrink-0 tabular-nums text-text-muted">stock {nombre(e.stock_actuel)}</span>
              </li>
            ))}
          </ul>
        )}
      </InfoSection>
    </>
  )

  const stock = (
    <>
      <InfoSection titre="Niveaux">
        <InfoChamps
          champs={[
            { label: 'Stock disponible', valeur: <span className="font-semibold tabular-nums">{nombre(produit.stock_actuel)} {produit.unite_mesure}</span> },
            { label: 'Statut', valeur: <StatutBadge statut={produit.statut} /> },
            { label: 'En commande', valeur: <span className="tabular-nums">{nombre(enCommande)}</span> },
            { label: 'Stock minimum', valeur: <span className="tabular-nums">{nombre(produit.stock_min)}</span> },
            { label: 'Seuil de réappro.', valeur: <span className="tabular-nums">{nombre(produit.seuil_reappro)}</span> },
            { label: 'Stock maximum', valeur: <span className="tabular-nums">{nombre(produit.stock_max)}</span> },
          ]}
        />
      </InfoSection>
      <InfoSection titre="Répartition par emplacement">
        {localisations.length === 0 ? (
          <InfoVide>Aucun stock rangé pour ce produit.</InfoVide>
        ) : (
          <table className="tableau-dense tableau-ajuste">
            <colgroup>
              <col style={{ width: '45%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr className="text-left">
                <th>Dépôt</th>
                <th>Emplacement</th>
                <th className="text-right">Qté</th>
              </tr>
            </thead>
            <tbody>
              {localisations.map((l) => (
                <tr key={`${l.entrepot_id}-${l.emplacement_id}`}>
                  <td>{l.entrepot_nom}</td>
                  <td className="font-mono">{l.emplacement_code}</td>
                  <td className="text-right tabular-nums">{nombre(l.quantite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </InfoSection>
      {suiviParLot && (
        <InfoSection titre="Lots en stock (ordre de sortie)">
          {lots == null ? (
            <InfoVide>Chargement...</InfoVide>
          ) : lots.length === 0 ? (
            <InfoVide>Aucun lot en stock.</InfoVide>
          ) : (
            <table className="tableau-dense tableau-ajuste">
              <colgroup>
                <col style={{ width: '34%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr className="text-left">
                  <th>Lot / Série</th>
                  <th>Expiration</th>
                  <th>Emplacement</th>
                  <th className="text-right">Qté</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l, i) => {
                  const perime = l.date_expiration != null && l.date_expiration < aujourdhui
                  return (
                    <tr key={l.id ?? i}>
                      <td className="font-mono">{l.numero_serie ?? l.lot ?? 'Sans lot'}</td>
                      <td className={perime ? 'text-danger-deep font-semibold' : ''} title={perime ? 'Lot périmé' : undefined}>
                        {l.date_expiration ? dateCourte(l.date_expiration) : '—'}
                      </td>
                      <td className="font-mono">{l.emplacement_code}</td>
                      <td className="text-right tabular-nums">{nombre(l.quantite)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </InfoSection>
      )}
    </>
  )

  const historique =
    mouvements == null ? (
      <InfoVide>Chargement...</InfoVide>
    ) : mouvements.length === 0 ? (
      <InfoVide>Aucun mouvement pour ce produit.</InfoVide>
    ) : (
      <InfoSection titre="10 derniers mouvements">
        <ul className="flex flex-col">
          {mouvements.map((m) => {
            const sens = SENS_MOUVEMENT[m.type]
            return (
              <li key={m.id} className="flex items-start gap-2 py-1.5 border-t border-border first:border-t-0">
                <div className="w-[68px] shrink-0 text-text-muted tabular-nums">
                  {dateCourte(m.cree_le)}
                  <div className="text-[10.5px]">
                    {new Date(m.cree_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-semibold ${sens.classe}`}>{sens.label}</span>
                    <span className={`tabular-nums font-semibold ${sens.classe}`}>
                      {sens.signe}
                      {nombre(m.quantite)}
                    </span>
                  </div>
                  <div className="text-text-muted truncate" title={m.motif ?? undefined}>
                    {[m.reference, m.motif, m.numero_serie ?? m.lot].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="text-[10.5px] text-text-muted">par {m.utilisateur_nom}</div>
                </div>
              </li>
            )
          })}
        </ul>
      </InfoSection>
    )

  const fournisseur =
    fournisseurs == null ? (
      <InfoVide>Chargement...</InfoVide>
    ) : fournisseurs.length === 0 ? (
      <InfoVide>Aucun fournisseur rattaché à ce produit.</InfoVide>
    ) : (
      <>
        {fournisseurs.map((f) => (
          <InfoSection key={f.id} titre={f.nom}>
            <InfoChamps
              champs={[
                { label: 'Contact', valeur: f.contact ?? '—' },
                { label: 'Téléphone', valeur: f.telephone ?? '—' },
                { label: 'E-mail', valeur: f.email ?? '—' },
                { label: 'Adresse', valeur: f.adresse ?? '—' },
              ]}
            />
          </InfoSection>
        ))}
      </>
    )

  return (
    <ItemInfoPanel
      titre={produit.reference}
      sousTitre={produit.designation}
      onFermer={onFermer}
      elementRetour={elementRetour}
      onglets={[
        { id: 'details', label: 'Détails', contenu: details },
        { id: 'stock', label: 'Stock', contenu: stock },
        { id: 'historique', label: 'Historique', contenu: historique },
        { id: 'fournisseur', label: 'Fournisseur', contenu: fournisseur },
      ]}
    />
  )
}
