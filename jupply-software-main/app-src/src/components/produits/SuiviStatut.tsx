// Section « Suivi du statut » de la fenêtre Info d'un produit : quand le
// produit est passé en alerte, en rupture, et le temps écoulé entre les deux.
import { ArrowRight } from 'lucide-react'
import type { ChangementStatut } from '../../lib/api/suiviStock'
import { dureeLisible } from '../../lib/dates'
import type { StatutStock } from '../../types/stock'
import { StatutBadge } from '../dashboard/StatutBadge'
import { InfoChamps, InfoSection, InfoVide } from '../ui/ItemInfo'

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

interface Props {
  statutActuel: StatutStock
  /** null = chargement ; 'indisponible' = migration pas encore exécutée. */
  changements: ChangementStatut[] | null | 'indisponible'
}

export function SuiviStatut({ statutActuel, changements }: Props) {
  if (changements === null) {
    return (
      <InfoSection titre="Suivi du statut">
        <InfoVide>Chargement...</InfoVide>
      </InfoSection>
    )
  }
  if (changements === 'indisponible') {
    return (
      <InfoSection titre="Suivi du statut">
        <InfoVide>Disponible après l'exécution de la migration « suivi des statuts » dans Supabase.</InfoVide>
      </InfoSection>
    )
  }

  // Changements du plus récent au plus ancien.
  const dernierAlerte = changements.find((c) => c.nouveau_statut === 'faible')
  const dernierRupture = changements.find((c) => c.nouveau_statut === 'rupture')
  const depuis = changements[0]?.nouveau_statut === statutActuel ? changements[0].date_changement : null
  const ecartAlerteRupture =
    dernierAlerte && dernierRupture && dernierRupture.date_changement > dernierAlerte.date_changement
      ? new Date(dernierRupture.date_changement).getTime() - new Date(dernierAlerte.date_changement).getTime()
      : null

  return (
    <InfoSection titre="Suivi du statut">
      <InfoChamps
        champs={[
          {
            label: 'Statut actuel',
            valeur: (
              <span className="inline-flex items-center gap-1.5 flex-wrap">
                <StatutBadge statut={statutActuel} />
                {depuis && <span className="text-text-muted">depuis {dureeLisible(Date.now() - new Date(depuis).getTime())}</span>}
              </span>
            ),
          },
          {
            label: 'Passé en alerte le',
            valeur: dernierAlerte ? (
              <span title={dernierAlerte.reference ?? undefined}>
                {dateHeure(dernierAlerte.date_changement)}
                {dernierAlerte.reference && <span className="text-text-muted"> · {dernierAlerte.reference}</span>}
              </span>
            ) : (
              'Jamais'
            ),
          },
          {
            label: 'Passé en rupture le',
            valeur: dernierRupture ? (
              <span title={dernierRupture.reference ?? undefined}>
                {dateHeure(dernierRupture.date_changement)}
                {dernierRupture.reference && <span className="text-text-muted"> · {dernierRupture.reference}</span>}
              </span>
            ) : (
              'Jamais'
            ),
          },
          {
            label: "De l'alerte à la rupture",
            valeur: ecartAlerteRupture != null ? <span className="font-semibold">{dureeLisible(ecartAlerteRupture)}</span> : '—',
          },
        ]}
      />

      {changements.length === 0 ? (
        <InfoVide>Aucun changement de statut enregistré.</InfoVide>
      ) : (
        <ul className="flex flex-col mt-1">
          {changements.slice(0, 8).map((c) => (
            <li key={c.id} className="py-1.5 border-t border-border flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.ancien_statut && <StatutBadge statut={c.ancien_statut} />}
                <ArrowRight size={11} className="text-text-muted" />
                <StatutBadge statut={c.nouveau_statut} />
                <span className="ml-auto tabular-nums text-text-muted">stock {c.stock.toLocaleString('fr-FR')}</span>
              </div>
              <div className="text-text-muted">
                {dateHeure(c.date_changement)}
                {c.reference && (
                  <>
                    {' · '}
                    <span className="text-text">{c.reference}</span>
                  </>
                )}
                {c.utilisateur_nom && <> · par {c.utilisateur_nom}</>}
                {c.origine === 'reprise' && (
                  <span title="Reconstitué à partir des anciens mouvements, avec les seuils actuels du produit"> · reconstitué</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </InfoSection>
  )
}
