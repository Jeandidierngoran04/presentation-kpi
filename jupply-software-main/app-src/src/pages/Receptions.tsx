import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { messageErreur } from '../lib/erreurs'
import { peutValiderReception } from '../lib/permissions'
import { getProduitsAvecStock } from '../lib/api/stock'
import {
  getLignesReception,
  getReceptions,
  validerReception,
  type ReceptionAffichee,
} from '../lib/api/receptions'
import type { ProduitAvecStock, ReceptionLigne, StatutReception } from '../types/stock'
import { libelleMotif } from '../lib/api/quarantaine'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { classeBadge, type TonBadge } from '../components/ui/Badge'
import { EnTetePage } from '../components/ui/EnTetePage'
import { useTabs } from '../context/TabsContext'

// Vert = terminé, bleu = en cours, gris = en attente, rouge = problème.
const STYLES_STATUT: Record<StatutReception, { label: string; ton: TonBadge }> = {
  en_attente: { label: 'En attente', ton: 'neutre' },
  validee: { label: 'Validée', ton: 'succes' },
  partielle: { label: 'Partielle', ton: 'info' },
  anomalie: { label: 'Anomalie', ton: 'danger' },
}

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function Receptions() {
  const { profil, entrepotsAssignes } = useAuth()
  const [receptions, setReceptions] = useState<ReceptionAffichee[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const { ongletActifId, ouvrirOnglet } = useTabs()

  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [lignes, setLignes] = useState<ReceptionLigne[]>([])
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [envoiValidation, setEnvoiValidation] = useState(false)

  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()

  function chargerListe() {
    Promise.all([getReceptions(), getProduitsAvecStock()])
      .then(([r, p]) => {
        setReceptions(r)
        setProduits(p)
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Recharge à chaque retour sur l'onglet (ex. après l'enregistrement d'une
  // réception dans l'onglet "Nouvelle réception").
  useEffect(() => {
    if (ongletActifId === 'entrees') chargerListe()
  }, [ongletActifId])

  useEffect(() => {
    if (!selectionId) return
    getLignesReception(selectionId).then(setLignes)
  }, [selectionId])

  const selection = receptions.find((r) => r.id === selectionId) ?? null
  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])

  function onClicDroitTableau(e: MouseEvent) {
    ouvrirMenu(e, [{ label: 'Créer une entrée manuelle', onClick: () => ouvrirOnglet('nouvelle-reception', 'Entrée manuelle') }])
  }

  async function onValider() {
    if (!selection) return
    setEnvoiValidation(true)
    try {
      await validerReception(selection.id)
      chargerListe()
      getLignesReception(selection.id).then(setLignes)
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setEnvoiValidation(false)
    }
  }

  if (erreur) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">{erreur}</div>
      </div>
    )
  }

  const peutValiderCelle =
    selection != null && peutValiderReception(profil?.role, selection.entrepot_id, entrepotsAssignes)

  return (
    <div className="h-full flex flex-col gap-2 p-4" onContextMenu={onClicDroitTableau}>
      <EnTetePage
        titre="Entrées de stock"
        compteur={receptions.length}
        actions={
          <button
            type="button"
            onClick={() => ouvrirOnglet('nouvelle-reception', 'Entrée manuelle')}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-strong text-accent-contrast text-xs font-semibold rounded-md px-3 h-8"
          >
            <Plus size={14} strokeWidth={1.75} /> Créer une entrée manuelle
          </button>
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
                <th className="font-medium py-1 px-2">Entrepôt</th>
                <th className="font-medium py-1 px-2">Fournisseur</th>
                <th className="font-medium py-1 px-2">N° PO</th>
                <th className="font-medium py-1 px-2">Statut</th>
                <th className="font-medium py-1 px-2">Date</th>
                <th className="font-medium py-1 px-2">Enregistré par</th>
              </tr>
            </thead>
            <tbody>
              {receptions.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectionId(r.id)}
                  className={`border-t border-border cursor-pointer ${
                    selectionId === r.id ? 'bg-accent-soft' : 'hover:bg-muted'
                  }`}
                >
                  <td className="py-1 px-2 font-mono text-xs text-text-muted">{r.numero}</td>
                  <td className="py-1 px-2 font-medium text-text">{r.entrepot_nom}</td>
                  <td className="py-1 px-2 text-text-muted">{r.fournisseur_nom ?? '—'}</td>
                  <td className="py-1 px-2 text-text-muted">{r.numero_po ?? '—'}</td>
                  <td className="py-1 px-2">
                    <span className={classeBadge(STYLES_STATUT[r.statut].ton)}>
                      {STYLES_STATUT[r.statut].label}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-text-muted">{new Date(r.cree_le).toLocaleDateString('fr-FR')}</td>
                  <td className="py-1 px-2 text-text-muted whitespace-nowrap">
                    {heure(r.cree_le)} · <span className="text-text">{r.cree_par_nom}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {receptions.length === 0 && (
            <p className="text-sm text-text-muted py-8 text-center">Aucune réception. Clic droit pour en créer une.</p>
          )}
        </div>
      )}

      {selection && (
        <div className="shrink-0 max-h-[26vh] overflow-y-auto bg-card rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-semibold text-text uppercase tracking-wide">
              Lignes — {selection.numero}
            </h2>
            {selection.valide_le && (
              <span className="text-xs text-text-muted">
                Validée le {new Date(selection.valide_le).toLocaleDateString('fr-FR')} à {heure(selection.valide_le)} ·{' '}
                <span className="text-text">{selection.valide_par_nom ?? '—'}</span>
              </span>
            )}
            {selection.statut === 'en_attente' && peutValiderCelle && (
              <button
                onClick={onValider}
                disabled={envoiValidation}
                className="text-xs font-semibold bg-accent hover:bg-accent-strong text-accent-contrast rounded-lg px-3 py-1.5 disabled:opacity-60"
              >
                {envoiValidation ? 'Validation...' : 'Valider la réception'}
              </button>
            )}
          </div>
          {selection.notes && (
            <p className="text-xs text-text-muted mb-1.5">
              <span className="font-semibold text-text">Notes :</span> {selection.notes}
            </p>
          )}

          <table className="tableau-dense">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                <th className="font-medium pb-1">Produit</th>
                <th className="font-medium pb-1">Attendu</th>
                <th className="font-medium pb-1">Reçu</th>
                <th className="font-medium pb-1">Lot / N° série</th>
                <th className="font-medium pb-1">Prix</th>
                <th className="font-medium pb-1">Non conforme</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-1 font-medium text-text">
                    {produitParId.get(l.produit_id)?.designation ?? l.produit_id}
                  </td>
                  <td className="py-1 text-text-muted">{l.quantite_attendue}</td>
                  <td className="py-1 text-text-muted">{l.quantite_recue}</td>
                  <td className="py-1 text-text-muted font-mono text-[11px]">{l.numero_serie ?? l.lot ?? '—'}</td>
                  <td className="py-1 text-text-muted">{l.prix_unitaire.toLocaleString('fr-FR')}</td>
                  <td className="py-1">
                    {(l.quantite_non_conforme || (l.anomalie ? l.quantite_recue : 0)) > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-danger text-xs font-semibold"
                        title={l.constat_non_conformite ?? undefined}
                      >
                        <AlertTriangle size={12} /> {l.quantite_non_conforme || l.quantite_recue} ·{' '}
                        {libelleMotif(l.motif_non_conformite ?? 'autre')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {menu}
    </div>
  )
}

