// Commandes fournisseurs qui attendent encore un produit : N° PO, statut,
// fournisseur, reste à recevoir, livraison prévue (en rouge si dépassée).
// Partagé par les fenêtres Info de Produits et d'Alertes stock.
import { STATUTS_COMMANDE, type CommandeEnCoursProduit } from '../../lib/api/commandes'
import { Badge } from '../ui/Badge'

const nombre = (n: number) => n.toLocaleString('fr-FR')
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

export function CommandesEnCoursListe({ commandes }: { commandes: CommandeEnCoursProduit[] }) {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  return (
    <ul className="flex flex-col">
      {commandes.map((c) => {
        const enRetard = c.date_livraison_prevue != null && c.date_livraison_prevue < aujourdhui
        return (
          <li key={c.commande_id} className="py-1.5 border-t border-border first:border-t-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-info-deep">{c.numero}</span>
              <Badge ton={STATUTS_COMMANDE[c.statut].ton}>{STATUTS_COMMANDE[c.statut].label}</Badge>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate">{c.fournisseur_nom}</span>
              <span className="shrink-0 tabular-nums">
                reste <span className="font-semibold">{nombre(c.quantite_restante)}</span> / {nombre(c.quantite_commandee)}
              </span>
            </div>
            <div className={enRetard ? 'text-danger-deep font-semibold' : 'text-text-muted'}>
              {c.date_livraison_prevue
                ? `Livraison prévue le ${dateCourte(c.date_livraison_prevue)}${enRetard ? ' (en retard)' : ''}`
                : 'Pas de date de livraison prévue'}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
