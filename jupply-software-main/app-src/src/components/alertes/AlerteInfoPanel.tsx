// Fenêtre Info d'une alerte de stock : depuis quand le produit est en alerte
// ou en rupture, et si une action est déjà en cours (commande fournisseur).
// Les données sont déjà chargées par l'écran Alertes stock : aucun appel ici.
import { stockAlerte } from '../../lib/api/stock'
import type { CommandeEnCoursProduit } from '../../lib/api/commandes'
import type { PassagesAlerte } from '../../lib/api/suiviStock'
import { dureeLisible } from '../../lib/dates'
import type { ProduitAvecStock } from '../../types/stock'
import { StatutBadge } from '../dashboard/StatutBadge'
import { Badge } from '../ui/Badge'
import { InfoChamps, InfoSection, InfoVide, ItemInfoPanel } from '../ui/ItemInfo'
import { CommandesEnCoursListe } from '../commandes/CommandesEnCoursListe'

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function datePassage(iso: string | null | undefined) {
  if (!iso) return 'Non enregistré'
  return (
    <span>
      {dateHeure(iso)} <span className="text-text-muted">(il y a {dureeLisible(Date.now() - new Date(iso).getTime())})</span>
    </span>
  )
}

interface Props {
  produit: ProduitAvecStock
  commandes: CommandeEnCoursProduit[]
  /** undefined = journal des statuts indisponible (migration non exécutée). */
  passages: PassagesAlerte | undefined
  journalDisponible: boolean
  onFermer: () => void
  elementRetour?: HTMLElement | null
}

export function AlerteInfoPanel({ produit, commandes, passages, journalDisponible, onFermer, elementRetour }: Props) {
  const resteARecevoir = commandes.reduce((t, c) => t + c.quantite_restante, 0)
  const contenu = (
    <>
      <InfoSection titre="Alerte">
        <InfoChamps
          champs={[
            { label: 'Statut', valeur: <StatutBadge statut={produit.statut} /> },
            {
              label: 'Stock / stock d’alerte',
              valeur: (
                <span className="tabular-nums">
                  <span className="font-semibold">{produit.stock_actuel.toLocaleString('fr-FR')}</span> / {stockAlerte(produit)}
                </span>
              ),
            },
            ...(journalDisponible
              ? [
                  { label: 'Passé en alerte le', valeur: datePassage(passages?.alerte) },
                  ...(produit.statut === 'rupture' ? [{ label: 'Passé en rupture le', valeur: datePassage(passages?.rupture) }] : []),
                ]
              : []),
          ]}
        />
        {!journalDisponible && (
          <InfoVide>Les dates de passage s'afficheront après l'exécution de la migration « suivi des statuts » dans Supabase.</InfoVide>
        )}
      </InfoSection>
      <InfoSection titre="Action en cours">
        {commandes.length === 0 ? (
          <div className="flex items-center gap-2 py-1">
            <Badge ton="danger">Aucune</Badge>
            <span className="text-text-muted">Aucune commande fournisseur n'attend ce produit.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 py-1">
              <Badge ton="info">Commande en cours</Badge>
              <span className="text-text-muted tabular-nums">
                {resteARecevoir.toLocaleString('fr-FR')} à recevoir sur {commandes.length} commande{commandes.length > 1 ? 's' : ''}
              </span>
            </div>
            <CommandesEnCoursListe commandes={commandes} />
          </>
        )}
      </InfoSection>
    </>
  )

  return (
    <ItemInfoPanel
      titre={produit.reference}
      sousTitre={produit.designation}
      onglets={[{ id: 'alerte', label: 'Alerte', contenu }]}
      onFermer={onFermer}
      elementRetour={elementRetour}
    />
  )
}
