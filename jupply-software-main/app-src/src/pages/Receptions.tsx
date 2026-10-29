import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { getReceptions, STATUTS_RECEPTION, type ReceptionAffichee } from '../lib/api/receptions'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { classeBadge } from '../components/ui/Badge'
import { EnTetePage } from '../components/ui/EnTetePage'
import { ChampRecherche } from '../components/ui/ChampRecherche'
import { texteFiltre } from '../lib/filtreTexte'
import { useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Liste des entrées. Un clic sur le numéro (ou un double-clic sur la ligne)
 * ouvre la page de l'entrée, où l'on valide, modifie ou annule.
 */
export function Receptions() {
  const [receptions, setReceptions] = useState<ReceptionAffichee[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const { ongletActifId, ouvrirOnglet } = useTabs()
  const { afficherEntree } = useSelection()
  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()

  function chargerListe() {
    getReceptions()
      .then(setReceptions)
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Recharge à chaque retour sur l'onglet (après un enregistrement, une validation, une annulation...).
  useEffect(() => {
    if (ongletActifId === 'entrees') chargerListe()
  }, [ongletActifId])

  const receptionsFiltrees = useMemo(() => {
    if (!recherche.trim()) return receptions
    return receptions.filter((r) =>
      [r.numero, ...r.depots_noms, r.fournisseur_nom ?? '', r.numero_po ?? '', STATUTS_RECEPTION[r.statut].label].some((v) =>
        texteFiltre(v, recherche),
      ),
    )
  }, [receptions, recherche])

  function creer() {
    ouvrirOnglet('nouvelle-reception', 'Nouvelle entrée')
  }

  function ouvrirEntree(r: ReceptionAffichee) {
    setSelectionId(r.id)
    afficherEntree(r.id)
    ouvrirOnglet('entree', `Entrée ${r.numero}`)
  }

  function onClicDroitTableau(e: MouseEvent) {
    const selection = receptions.find((r) => r.id === selectionId)
    ouvrirMenu(e, [
      ...(selection ? [{ label: `Ouvrir ${selection.numero}`, onClick: () => ouvrirEntree(selection) }] : []),
      { label: 'Créer', onClick: creer },
    ])
  }

  if (erreur) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">{erreur}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2" onContextMenu={onClicDroitTableau}>
      <EnTetePage
        titre="Entrées de stock"
        actions={
          <>
            <ChampRecherche
              valeur={recherche}
              onChange={setRecherche}
              aide="N° d'entrée, dépôt, fournisseur, n° de commande ou statut (* en tête = contient)"
            />
            <button
              type="button"
              onClick={creer}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-strong text-accent-contrast text-xs font-semibold rounded-md px-3 h-8"
            >
              <Plus size={14} strokeWidth={1.75} /> Créer
            </button>
          </>
        }
      />

      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : (
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="tableau-dense">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-medium py-1 px-2">Numéro</th>
                  <th className="font-medium py-1 px-2">Dépôt</th>
                  <th className="font-medium py-1 px-2">Fournisseur</th>
                  <th className="font-medium py-1 px-2">N° PO</th>
                  <th className="font-medium py-1 px-2">Statut</th>
                  <th className="font-medium py-1 px-2">Date</th>
                  <th className="font-medium py-1 px-2">Enregistré par</th>
                </tr>
              </thead>
              <tbody>
                {receptionsFiltrees.map((r) => {
                  const annulee = r.statut === 'annulee'
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectionId(r.id)}
                      onDoubleClick={() => ouvrirEntree(r)}
                      className={`border-t border-border cursor-pointer ${selectionId === r.id ? 'bg-accent-soft' : 'hover:bg-muted'} ${
                        annulee ? 'text-text-muted' : ''
                      }`}
                    >
                      <td className="py-1 px-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            ouvrirEntree(r)
                          }}
                          className={`font-mono text-xs hover:underline ${annulee ? 'text-text-muted line-through' : 'text-info-deep'}`}
                          title="Ouvrir l'entrée"
                        >
                          {r.numero}
                        </button>
                      </td>
                      <td className={`py-1 px-2 font-medium ${annulee ? '' : 'text-text'}`} title={r.depots_noms.join(', ')}>
                        {r.depots_noms.join(', ')}
                      </td>
                      <td className="py-1 px-2 text-text-muted">{r.fournisseur_nom ?? '—'}</td>
                      <td className="py-1 px-2 text-text-muted">{r.numero_po ?? '—'}</td>
                      <td className="py-1 px-2">
                        <span className={classeBadge(STATUTS_RECEPTION[r.statut].ton)}>{STATUTS_RECEPTION[r.statut].label}</span>
                      </td>
                      <td className="py-1 px-2 text-text-muted">{new Date(r.cree_le).toLocaleDateString('fr-FR')}</td>
                      <td className="py-1 px-2 text-text-muted whitespace-nowrap">
                        {heure(r.cree_le)} · <span className={annulee ? '' : 'text-text'}>{r.cree_par_nom}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {receptionsFiltrees.length === 0 && (
            <p className="text-sm text-text-muted py-8 text-center">
              {receptions.length === 0 ? 'Aucune entrée. Clique sur « Créer » pour en saisir une.' : 'Aucune entrée ne correspond à la recherche.'}
            </p>
          )}
        </div>
      )}

      {menu}
    </div>
  )
}
