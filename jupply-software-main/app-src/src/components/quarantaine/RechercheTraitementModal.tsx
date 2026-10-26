import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { libelleMotif, STATUTS_NC, type NonConformite } from '../../lib/api/quarantaine'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { CLASSE_BOUTON_PRIMAIRE_PETIT } from '../ui/styles'

interface RechercheTraitementModalProps {
  dossiers: NonConformite[]
  onFermer: () => void
  onChoisir: (dossier: NonConformite) => void
}

function correspond(nc: NonConformite, terme: string): boolean {
  return [nc.numero, nc.numero_po, nc.produit_reference, nc.produit_designation, nc.fournisseur_nom, nc.lot, nc.numero_serie, nc.reception_numero]
    .some((v) => v != null && v.toLowerCase().includes(terme))
}

/** "Traitement" : retrouver un dossier ouvert par N° de commande, code, désignation... puis le traiter. */
export function RechercheTraitementModal({ dossiers, onFermer, onChoisir }: RechercheTraitementModalProps) {
  const [recherche, setRecherche] = useState('')
  const ouverts = useMemo(() => dossiers.filter((d) => d.statut !== 'cloturee'), [dossiers])
  const terme = recherche.trim().toLowerCase()
  const resultats = terme ? ouverts.filter((d) => correspond(d, terme)) : ouverts

  return (
    <Modal titre="Traitement d'une non-conformité" onFermer={onFermer} large>
      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-2 border border-border rounded-lg px-3 h-10 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search size={16} strokeWidth={1.75} className="text-text-muted shrink-0" />
          <input
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultats.length === 1) onChoisir(resultats[0])
            }}
            placeholder="N° de commande, code, désignation, fournisseur, lot, N° NC..."
            className="text-[13px] bg-transparent text-text placeholder:text-text-muted outline-none w-full"
          />
        </div>
        <p className="text-xs text-text-muted">
          {resultats.length} dossier(s) à traiter{terme ? ` pour "${recherche.trim()}"` : ''}. Clique sur "Traiter" pour
          ouvrir la fenêtre de traitement.
        </p>
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                <th className="font-semibold h-8 px-3">N° NC</th>
                <th className="font-semibold h-8 px-3">N° commande</th>
                <th className="font-semibold h-8 px-3">Référence</th>
                <th className="font-semibold h-8 px-3">Désignation</th>
                <th className="font-semibold h-8 px-3">Motif</th>
                <th className="font-semibold h-8 px-3 text-right">Qté</th>
                <th className="font-semibold h-8 px-3">Statut</th>
                <th className="h-8 px-3" />
              </tr>
            </thead>
            <tbody>
              {resultats.map((d) => (
                <tr key={d.id} className="h-10 border-t border-border hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-3 font-mono text-text-muted">{d.numero}</td>
                  <td className="px-3 font-mono text-text-muted">{d.numero_po ?? '—'}</td>
                  <td className="px-3 font-mono text-text">{d.produit_reference}</td>
                  <td className="px-3 text-text">{d.produit_designation}</td>
                  <td className="px-3 text-text-muted">{libelleMotif(d.motif)}</td>
                  <td className="px-3 text-right font-semibold text-text">{d.quantite_restante}</td>
                  <td className="px-3">
                    <Badge ton={STATUTS_NC[d.statut].ton}>{STATUTS_NC[d.statut].label}</Badge>
                  </td>
                  <td className="px-3 text-right">
                    <button type="button" onClick={() => onChoisir(d)} className={CLASSE_BOUTON_PRIMAIRE_PETIT}>
                      Traiter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {resultats.length === 0 && (
            <p className="text-sm text-text-muted py-8 text-center">
              {ouverts.length === 0 ? 'Aucun dossier en quarantaine.' : 'Aucun dossier ne correspond à cette recherche.'}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
