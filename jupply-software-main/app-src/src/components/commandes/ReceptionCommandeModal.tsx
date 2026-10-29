import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, PackageCheck } from 'lucide-react'
import { getEmplacements } from '../../lib/api/entrepots'
import { getLocalisationsProduits } from '../../lib/api/produits'
import { MOTIFS_NC, type MotifNonConformite } from '../../lib/api/quarantaine'
import {
  receptionnerCommande,
  type CommandeFournisseur,
  type LigneCommande,
  type LigneReceptionCommande,
} from '../../lib/api/commandes'
import { messageErreur } from '../../lib/erreurs'
import type { Emplacement } from '../../types/stock'
import { Modal } from '../ui/Modal'
import { Bouton } from '../ui/Bouton'

interface Saisie {
  quantite: string
  emplacementId: string
  lot: string
  numeroSerie: string
  dateExpiration: string
  quantiteNc: string
  motifNc: MotifNonConformite | ''
  constatNc: string
}

const CLASSE_CELLULE =
  'w-full h-7 px-1.5 bg-card text-xs text-text outline-none placeholder:text-text-muted ' +
  'focus:ring-2 focus:ring-inset focus:ring-accent/40 disabled:bg-muted disabled:cursor-not-allowed'
const CLASSE_TD = 'border border-border p-0'
const CLASSE_TH = 'border border-border bg-muted font-semibold h-7 px-1.5 text-left'

interface Props {
  commande: CommandeFournisseur
  lignes: LigneCommande[]
  onFermer: () => void
  /** Appelé après l'enregistrement, avec le message de résultat. */
  onReceptionnee: (message: string) => void
}

/**
 * Réception d'une commande : on saisit ce qui est réellement arrivé, ligne
 * par ligne. Un récapitulatif (écarts, quarantaine) est affiché avant
 * l'enregistrement définitif, qui met le stock à jour immédiatement.
 */
export function ReceptionCommandeModal({ commande, lignes, onFermer, onReceptionnee }: Props) {
  const lignesOuvertes = useMemo(() => lignes.filter((l) => l.quantite_restante > 0), [lignes])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [saisies, setSaisies] = useState<Record<string, Saisie>>({})
  const [notes, setNotes] = useState('')
  const [etape, setEtape] = useState<'saisie' | 'verification'>('saisie')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    Promise.all([getEmplacements(commande.entrepot_id), getLocalisationsProduits()]).then(([emps, locs]) => {
      setEmplacements(emps)
      const initiales: Record<string, Saisie> = {}
      for (const l of lignesOuvertes) {
        // Emplacement proposé : là où le produit est déjà rangé dans ce dépôt.
        const existant = (locs.get(l.produit_id) ?? []).find(
          (loc) => loc.entrepot_id === commande.entrepot_id && emps.some((e) => e.id === loc.emplacement_id && !e.est_quarantaine),
        )
        initiales[l.id] = {
          quantite: '',
          emplacementId: existant?.emplacement_id ?? emps.find((e) => !e.est_quarantaine)?.id ?? '',
          lot: '',
          numeroSerie: '',
          dateExpiration: '',
          quantiteNc: '',
          motifNc: '',
          constatNc: '',
        }
      }
      setSaisies(initiales)
    })
  }, [commande.entrepot_id, lignesOuvertes])

  function maj(id: string, champs: Partial<Saisie>) {
    setSaisies((prev) => ({ ...prev, [id]: { ...prev[id], ...champs } }))
  }

  function toutRecevoir() {
    setSaisies((prev) => {
      const suivant = { ...prev }
      for (const l of lignesOuvertes) suivant[l.id] = { ...suivant[l.id], quantite: String(l.quantite_restante) }
      return suivant
    })
  }

  const lignesSaisies = lignesOuvertes.filter((l) => Number(saisies[l.id]?.quantite || 0) > 0)
  const total = lignesSaisies.reduce((t, l) => t + Number(saisies[l.id].quantite), 0)
  const totalNc = lignesSaisies.reduce((t, l) => t + Number(saisies[l.id].quantiteNc || 0), 0)
  const partielles = lignesOuvertes.filter((l) => Number(saisies[l.id]?.quantite || 0) < l.quantite_restante)
  const surplus = lignesSaisies.filter((l) => Number(saisies[l.id].quantite) > l.quantite_restante)
  const completera = partielles.length === 0

  function erreurDeSaisie(): string | null {
    if (lignesSaisies.length === 0) return 'Saisis au moins une quantité reçue (ou clique sur « Tout recevoir »).'
    for (const l of lignesOuvertes) {
      const s = saisies[l.id]
      if (!s) continue
      const q = Number(s.quantite || 0)
      const ref = l.produit_reference
      if (!Number.isInteger(q) || q < 0) return `${ref} : la quantité reçue doit être un nombre entier positif.`
      if (q === 0) {
        if (s.quantiteNc || s.lot || s.dateExpiration) return `${ref} : indique la quantité reçue (ou vide la ligne).`
        continue
      }
      if (!s.emplacementId) return `${ref} : choisis l'emplacement de rangement.`
      if (l.gere_expiration && !s.dateExpiration) return `${ref} : la date d'expiration est obligatoire pour ce produit.`
      if (s.dateExpiration && !s.lot.trim() && !s.numeroSerie.trim()) {
        return `${ref} : le numéro de lot (ou de série) est obligatoire avec une date d'expiration.`
      }
      const nc = Number(s.quantiteNc || 0)
      if (!Number.isInteger(nc) || nc < 0 || nc > q) return `${ref} : la quantité non conforme doit être comprise entre 0 et la quantité reçue.`
      if (nc > 0 && !s.motifNc) return `${ref} : choisis le motif de la non-conformité.`
      if (nc === 0 && (s.motifNc || s.constatNc.trim())) return `${ref} : indique la quantité non conforme (ou retire le motif).`
    }
    return null
  }

  function verifier() {
    const probleme = erreurDeSaisie()
    setErreur(probleme)
    if (!probleme) setEtape('verification')
  }

  async function enregistrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      const donnees: LigneReceptionCommande[] = lignesSaisies.map((l) => {
        const s = saisies[l.id]
        return {
          commandeLigneId: l.id,
          emplacementId: s.emplacementId,
          quantiteRecue: Number(s.quantite),
          lot: s.lot.trim() || null,
          numeroSerie: s.numeroSerie.trim() || null,
          dateExpiration: s.dateExpiration || null,
          quantiteNonConforme: Number(s.quantiteNc || 0),
          motifNonConformite: s.motifNc || null,
          constatNonConformite: s.constatNc.trim() || null,
        }
      })
      await receptionnerCommande(commande.id, donnees, notes.trim() || null)
      onReceptionnee(
        completera
          ? `Réception enregistrée : la commande ${commande.numero} est complète.`
          : `Réception partielle enregistrée sur ${commande.numero}.`,
      )
    } catch (e) {
      setErreur(messageErreur(e))
      setEnvoi(false)
    }
  }

  const codeEmplacement = (id: string) => emplacements.find((e) => e.id === id)?.code ?? '—'

  return (
    <Modal titre={`Réceptionner la commande ${commande.numero}`} onFermer={envoi ? () => {} : onFermer} large>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5">
        <p className="text-xs text-text-muted">
          {commande.fournisseur_nom} · livraison à <span className="text-text font-medium">{commande.entrepot_nom}</span>
        </p>

        {etape === 'saisie' ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-muted">
                Saisis la quantité <span className="font-semibold text-text">réellement reçue</span> sur chaque ligne. Ce qui est non conforme part en quarantaine.
              </span>
              <Bouton variante="secondaire" taille="sm" onClick={toutRecevoir}>
                <PackageCheck size={14} strokeWidth={1.75} /> Tout recevoir
              </Bouton>
            </div>
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[1180px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 text-[10.5px] text-text-muted uppercase tracking-wide">
                  <tr>
                    <th className={`${CLASSE_TH} w-28`}>Référence</th>
                    <th className={CLASSE_TH}>Désignation</th>
                    <th className={`${CLASSE_TH} w-16 text-right`}>Cmdé</th>
                    <th className={`${CLASSE_TH} w-16 text-right`}>Déjà reçu</th>
                    <th className={`${CLASSE_TH} w-16 text-right`}>Reste</th>
                    <th className={`${CLASSE_TH} w-20 text-right`}>Qté reçue</th>
                    <th className={`${CLASSE_TH} w-28`}>Emplacement</th>
                    <th className={`${CLASSE_TH} w-24`}>Lot</th>
                    <th className={`${CLASSE_TH} w-24`}>N° série</th>
                    <th className={`${CLASSE_TH} w-32`}>Expiration</th>
                    <th className={`${CLASSE_TH} w-16 text-right`}>Qté NC</th>
                    <th className={`${CLASSE_TH} w-36`}>Motif NC</th>
                    <th className={`${CLASSE_TH} w-40`}>Constat</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesOuvertes.map((l) => {
                    const s = saisies[l.id]
                    if (!s) return null
                    const q = Number(s.quantite || 0)
                    const actif = q > 0
                    const nc = Number(s.quantiteNc || 0) > 0
                    return (
                      <tr key={l.id} className={nc ? 'bg-danger-soft/40' : ''}>
                        <td className={`${CLASSE_TD} px-1.5 font-mono text-text-muted truncate`}>{l.produit_reference}</td>
                        <td className={`${CLASSE_TD} px-1.5 truncate max-w-[220px]`} title={l.produit_designation}>
                          {l.produit_designation}
                        </td>
                        <td className={`${CLASSE_TD} px-1.5 text-right tabular-nums`}>{l.quantite_commandee}</td>
                        <td className={`${CLASSE_TD} px-1.5 text-right tabular-nums text-text-muted`}>{l.quantite_recue}</td>
                        <td className={`${CLASSE_TD} px-1.5 text-right tabular-nums font-semibold`}>{l.quantite_restante}</td>
                        <td className={CLASSE_TD}>
                          <input
                            type="number"
                            min="0"
                            value={s.quantite}
                            onChange={(e) => maj(l.id, { quantite: e.target.value })}
                            placeholder="0"
                            className={`${CLASSE_CELLULE} text-right font-semibold ${q > l.quantite_restante ? 'text-warn-deep' : ''}`}
                          />
                        </td>
                        <td className={CLASSE_TD}>
                          <select
                            value={s.emplacementId}
                            onChange={(e) => maj(l.id, { emplacementId: e.target.value })}
                            disabled={!actif}
                            className={CLASSE_CELLULE}
                          >
                            <option value="">—</option>
                            {emplacements
                              .filter((e) => !e.est_quarantaine)
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.code}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className={CLASSE_TD}>
                          <input value={s.lot} onChange={(e) => maj(l.id, { lot: e.target.value })} disabled={!actif} className={CLASSE_CELLULE} />
                        </td>
                        <td className={CLASSE_TD}>
                          <input
                            value={s.numeroSerie}
                            onChange={(e) => maj(l.id, { numeroSerie: e.target.value })}
                            disabled={!actif}
                            className={CLASSE_CELLULE}
                          />
                        </td>
                        <td className={CLASSE_TD}>
                          <input
                            type="date"
                            value={s.dateExpiration}
                            onChange={(e) => maj(l.id, { dateExpiration: e.target.value })}
                            disabled={!actif}
                            className={CLASSE_CELLULE}
                          />
                        </td>
                        <td className={CLASSE_TD}>
                          <input
                            type="number"
                            min="0"
                            value={s.quantiteNc}
                            onChange={(e) => maj(l.id, { quantiteNc: e.target.value })}
                            disabled={!actif}
                            placeholder="0"
                            className={`${CLASSE_CELLULE} text-right`}
                          />
                        </td>
                        <td className={CLASSE_TD}>
                          <select
                            value={s.motifNc}
                            onChange={(e) => maj(l.id, { motifNc: e.target.value as MotifNonConformite | '' })}
                            disabled={!actif}
                            className={CLASSE_CELLULE}
                          >
                            <option value="">—</option>
                            {MOTIFS_NC.map((m) => (
                              <option key={m.valeur} value={m.valeur}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={CLASSE_TD}>
                          <input
                            value={s.constatNc}
                            onChange={(e) => maj(l.id, { constatNc: e.target.value })}
                            disabled={!actif}
                            placeholder={nc ? 'Ex. 4 cartons écrasés' : ''}
                            className={CLASSE_CELLULE}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <label className="shrink-0 flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Notes (bon de livraison, transporteur...)</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2 h-8 text-xs text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </label>
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-3 text-[13px]">
            <div className="flex gap-2.5 bg-muted rounded-lg px-3 py-2.5">
              <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 mt-0.5 text-warn-deep" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Vérifie avant d'enregistrer : le stock sera mis à jour immédiatement.</p>
                <p className="text-xs text-text-muted">
                  {lignesSaisies.length} ligne(s), {total.toLocaleString('fr-FR')} unité(s) reçue(s)
                  {totalNc > 0 && <>, dont <span className="text-danger-deep font-semibold">{totalNc} en quarantaine</span></>}.
                </p>
                <p className="text-xs">
                  Après cette réception, la commande sera{' '}
                  {completera ? (
                    <span className="font-semibold text-accent-deep">complétée (plus aucune réception possible)</span>
                  ) : (
                    <span className="font-semibold text-info-deep">en cours de réception ({partielles.length} ligne(s) avec un reliquat)</span>
                  )}
                  .
                </p>
                {surplus.length > 0 && (
                  <p className="text-xs text-warn-deep font-semibold">
                    Surlivraison sur {surplus.length} ligne(s) : la quantité reçue dépasse le reste à recevoir. Vérifie le bon de livraison.
                  </p>
                )}
              </div>
            </div>
            <table className="tableau-dense">
              <thead>
                <tr className="text-left">
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th className="text-right">Reste</th>
                  <th className="text-right">Reçu</th>
                  <th className="text-right">Écart</th>
                  <th>Emplacement</th>
                  <th>Lot / Série</th>
                  <th className="text-right">Quarantaine</th>
                </tr>
              </thead>
              <tbody>
                {lignesOuvertes.map((l) => {
                  const s = saisies[l.id]
                  const q = Number(s?.quantite || 0)
                  const ecart = q - l.quantite_restante
                  const nc = Number(s?.quantiteNc || 0)
                  return (
                    <tr key={l.id} className={q === 0 ? 'text-text-muted' : ''}>
                      <td className="font-mono text-xs">{l.produit_reference}</td>
                      <td>{l.produit_designation}</td>
                      <td className="text-right tabular-nums">{l.quantite_restante}</td>
                      <td className="text-right tabular-nums font-semibold">{q}</td>
                      <td className={`text-right tabular-nums ${ecart < 0 ? 'text-info-deep' : ecart > 0 ? 'text-warn-deep font-semibold' : 'text-accent-deep'}`}>
                        {ecart === 0 ? 'OK' : ecart > 0 ? `+${ecart}` : ecart}
                      </td>
                      <td className="font-mono text-xs">{q > 0 ? codeEmplacement(s.emplacementId) : ''}</td>
                      <td className="font-mono text-xs">{q > 0 ? s.numeroSerie || s.lot || '—' : ''}</td>
                      <td className={`text-right tabular-nums ${nc > 0 ? 'text-danger-deep font-semibold' : 'text-text-muted'}`}>{nc > 0 ? nc : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {erreur && <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}
        <div className="shrink-0 flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-text-muted">
            Total saisi : <span className="font-semibold text-text tabular-nums">{total.toLocaleString('fr-FR')}</span>
          </span>
          <div className="flex gap-2">
            {etape === 'saisie' ? (
              <>
                <Bouton variante="secondaire" taille="sm" onClick={onFermer} data-annuler>
                  Annuler
                </Bouton>
                <Bouton taille="sm" onClick={verifier}>
                  Vérifier la réception
                </Bouton>
              </>
            ) : (
              <>
                <Bouton variante="secondaire" taille="sm" onClick={() => setEtape('saisie')} disabled={envoi}>
                  Modifier la saisie
                </Bouton>
                <Bouton taille="sm" onClick={enregistrer} disabled={envoi}>
                  {envoi ? 'Enregistrement...' : 'Confirmer et enregistrer'}
                </Bouton>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
