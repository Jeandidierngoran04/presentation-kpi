import { useConfirmation } from '../../context/ConfirmationContext'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { messageErreur } from '../../lib/erreurs'
import { dateSaisieVersISO, dateVersInput } from '../../lib/dates'
import { getEmplacements } from '../../lib/api/entrepots'
import {
  DECISIONS_NC,
  libelleMotif,
  traiterNonConformite,
  type DecisionNc,
  type NonConformite,
} from '../../lib/api/quarantaine'
import type { Emplacement } from '../../types/stock'
import { Modal } from '../ui/Modal'
import {
  CLASSE_BOUTON_PRIMAIRE,
  CLASSE_BOUTON_SECONDAIRE,
  CLASSE_CHAMP_COMPACT,
  CLASSE_LABEL,
} from '../ui/styles'
import { BandeauErreur } from '../ui/BandeauErreur'

interface LigneDecision {
  cle: string
  decision: DecisionNc
  quantite: string
  source: 'a_traiter' | 'reparation'
  emplacementId: string
  reference: string
}

function nouvelleLigne(decision: DecisionNc = 'liberation', quantite = '', source: LigneDecision['source'] = 'a_traiter'): LigneDecision {
  return { cle: Math.random().toString(36).slice(2), decision, quantite, source, emplacementId: '', reference: '' }
}

interface TraitementModalProps {
  dossier: NonConformite
  onFermer: () => void
  /** Appelé après un traitement réussi, avec un message de confirmation. */
  onTraite: (message: string) => void
}

/**
 * Fenêtre de traitement d'un dossier de non-conformité : la quantité restante
 * est répartie entre une ou plusieurs décisions, puis le stock est mis à jour.
 */
export function TraitementModal({ dossier, onFermer, onTraite }: TraitementModalProps) {
  const { confirmer } = useConfirmation()
  const aTraiter = dossier.quantite_restante - dossier.quantite_en_reparation
  const enReparation = dossier.quantite_en_reparation
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [lignes, setLignes] = useState<LigneDecision[]>([
    nouvelleLigne('liberation', '', aTraiter > 0 ? 'a_traiter' : 'reparation'),
  ])
  const [commentaire, setCommentaire] = useState('')
  const [date, setDate] = useState(() => dateVersInput(new Date()))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    getEmplacements(dossier.entrepot_id)
      .then((liste) => setEmplacements(liste.filter((e) => !e.est_quarantaine)))
      .catch((e) => setErreur(messageErreur(e)))
  }, [dossier.entrepot_id])

  function maj(cle: string, champs: Partial<LigneDecision>) {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.cle !== cle) return l
        const suivante = { ...l, ...champs }
        // Une réparation porte toujours sur la part "à traiter".
        if (suivante.decision === 'reparation') suivante.source = 'a_traiter'
        return suivante
      }),
    )
  }

  /** Raccourci : toute la quantité à traiter sur une seule décision. */
  function toutEn(decision: DecisionNc) {
    const source = aTraiter > 0 ? 'a_traiter' : 'reparation'
    const quantite = source === 'a_traiter' ? aTraiter : enReparation
    setLignes([nouvelleLigne(decision, String(quantite), decision === 'reparation' ? 'a_traiter' : source)])
  }

  const total = (source: LigneDecision['source']) =>
    lignes.filter((l) => l.source === source).reduce((somme, l) => somme + Number(l.quantite || 0), 0)
  const resteATraiter = aTraiter - total('a_traiter')
  const resteEnReparation = enReparation - total('reparation')

  function erreurDeSaisie(): string | null {
    const remplies = lignes.filter((l) => l.quantite.trim() !== '')
    if (remplies.length === 0) return 'Indique au moins une décision avec sa quantité.'
    for (const [i, l] of remplies.entries()) {
      const n = Number(l.quantite)
      if (!Number.isInteger(n) || n <= 0) return `Décision ${i + 1} : quantité invalide.`
      if (l.decision === 'liberation' && !l.emplacementId) return `Décision ${i + 1} : choisis l'emplacement où remettre le produit.`
    }
    if (resteATraiter < 0 || resteEnReparation < 0) return 'Les quantités dépassent ce qui reste à traiter.'
    if (!commentaire.trim()) return 'Le commentaire (constat, décision prise) est obligatoire.'
    return null
  }

  async function onValider() {
    const probleme = erreurDeSaisie()
    if (probleme) {
      setErreur(probleme)
      return
    }
    const unites = lignes.reduce((t, l) => t + Number(l.quantite || 0), 0)
    const ok = await confirmer({
      titre: `Valider le traitement de ${dossier.numero} ?`,
      message: `${unites.toLocaleString('fr-FR')} unité(s) traitée(s). Le stock sera mis à jour selon les décisions saisies (libération, retour fournisseur, rebut, réparation). Un traitement validé ne peut pas être annulé.`,
      libelleConfirmer: 'Valider le traitement',
    })
    if (!ok) return
    setErreur(null)
    setEnvoi(true)
    try {
      const remplies = lignes.filter((l) => l.quantite.trim() !== '')
      await traiterNonConformite(
        dossier.id,
        remplies.map((l) => ({
          decision: l.decision,
          quantite: Number(l.quantite),
          source: l.source,
          emplacementDestinationId: l.decision === 'liberation' ? l.emplacementId : null,
          referenceDocument: l.reference.trim() || null,
        })),
        commentaire.trim(),
        date ? dateSaisieVersISO(date) : null,
      )
      const restant = resteATraiter + resteEnReparation
      onTraite(
        restant === 0
          ? `Dossier ${dossier.numero} traité et clôturé`
          : `Dossier ${dossier.numero} traité : ${restant} unité(s) encore en quarantaine`,
      )
    } catch (e) {
      setErreur(messageErreur(e))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre={`Traitement du dossier ${dossier.numero}`} onFermer={onFermer} large>
      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
        {/* Rappel du dossier */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 bg-muted/50 border border-border rounded-lg p-3">
          {[
            ['Produit', `${dossier.produit_reference} · ${dossier.produit_designation}`],
            ['Lot / N° série', dossier.lot ?? dossier.numero_serie ?? '—'],
            ['Motif', libelleMotif(dossier.motif)],
            ['Fournisseur', dossier.fournisseur_nom ?? '—'],
            ['N° de commande', dossier.numero_po ?? '—'],
            ['Réception', dossier.reception_numero ?? '—'],
            ['Dépôt', dossier.entrepot_nom],
            ['Constat', dossier.constat ?? '—'],
          ].map(([titre, valeur]) => (
            <div key={titre} className="flex flex-col gap-0.5 min-w-0">
              <dt className={CLASSE_LABEL}>{titre}</dt>
              <dd className="text-[13px] text-text truncate" title={valeur}>
                {valeur}
              </dd>
            </div>
          ))}
        </dl>

        {/* Quantités */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-lg border border-border px-3 py-2">
            <div className={CLASSE_LABEL}>À traiter</div>
            <div className="text-lg font-bold text-text">
              {aTraiter} <span className="text-xs font-normal text-text-muted">{dossier.unite_mesure}</span>
            </div>
          </div>
          {enReparation > 0 && (
            <div className="rounded-lg border border-warn bg-warn-soft px-3 py-2">
              <div className={CLASSE_LABEL}>En réparation</div>
              <div className="text-lg font-bold text-warn-deep">{enReparation}</div>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <span className="text-xs text-text-muted">Tout en :</span>
            {DECISIONS_NC.map((d) => (
              <button
                key={d.valeur}
                type="button"
                onClick={() => toutEn(d.valeur)}
                disabled={d.valeur === 'reparation' && aTraiter === 0}
                className="text-xs font-semibold bg-card border border-border hover:bg-muted rounded-full px-2.5 h-7 disabled:opacity-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Décisions */}
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs min-w-[860px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                <th className="font-semibold h-8 px-3 w-44">Décision</th>
                <th className="font-semibold h-8 px-3 w-24 text-right">Quantité</th>
                {enReparation > 0 && <th className="font-semibold h-8 px-3 w-36">Prise sur</th>}
                <th className="font-semibold h-8 px-3 w-44">Emplacement</th>
                <th className="font-semibold h-8 px-3">Référence du document</th>
                <th className="h-8 px-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const info = DECISIONS_NC.find((d) => d.valeur === l.decision)!
                return (
                  <tr key={l.cle} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <select
                        value={l.decision}
                        onChange={(e) => maj(l.cle, { decision: e.target.value as DecisionNc })}
                        className={CLASSE_CHAMP_COMPACT}
                      >
                        {DECISIONS_NC.map((d) => (
                          <option key={d.valeur} value={d.valeur} disabled={d.valeur === 'reparation' && aTraiter === 0}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-text-muted mt-1 leading-snug">{info.aide}</p>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={l.quantite}
                        onChange={(e) => maj(l.cle, { quantite: e.target.value })}
                        className={`${CLASSE_CHAMP_COMPACT} text-right`}
                      />
                    </td>
                    {enReparation > 0 && (
                      <td className="px-3 py-2">
                        <select
                          value={l.source}
                          onChange={(e) => maj(l.cle, { source: e.target.value as LigneDecision['source'] })}
                          disabled={l.decision === 'reparation'}
                          className={CLASSE_CHAMP_COMPACT}
                        >
                          <option value="a_traiter">À traiter</option>
                          <option value="reparation">Retour de réparation</option>
                        </select>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {l.decision === 'liberation' ? (
                        <select
                          value={l.emplacementId}
                          onChange={(e) => maj(l.cle, { emplacementId: e.target.value })}
                          className={CLASSE_CHAMP_COMPACT}
                        >
                          <option value="">Choisir...</option>
                          {emplacements.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.code}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-text-muted">{l.decision === 'reparation' ? 'Reste en quarantaine' : 'Sort du stock'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={l.reference}
                        onChange={(e) => maj(l.cle, { reference: e.target.value })}
                        placeholder={info.libelleReference}
                        className={CLASSE_CHAMP_COMPACT}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {lignes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLignes((prev) => prev.filter((x) => x.cle !== l.cle))}
                          className="text-text-muted hover:text-danger mt-1.5"
                          title="Retirer cette décision"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setLignes((prev) => [...prev, nouvelleLigne('retour_fournisseur', '', aTraiter - total('a_traiter') > 0 ? 'a_traiter' : 'reparation')])}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-card border border-border hover:bg-muted rounded-lg px-3 h-8"
          >
            <Plus size={14} strokeWidth={1.75} /> Ajouter une décision
          </button>
          <span className={`text-xs ${resteATraiter < 0 || resteEnReparation < 0 ? 'text-danger-deep font-semibold' : 'text-text-muted'}`}>
            Après ce traitement : <span className="font-semibold">{Math.max(resteATraiter, 0)}</span> à traiter
            {enReparation > 0 || lignes.some((l) => l.decision === 'reparation')
              ? ` · ${Math.max(resteEnReparation, 0) + lignes.filter((l) => l.decision === 'reparation').reduce((s, l) => s + Number(l.quantite || 0), 0)} en réparation`
              : ''}
          </span>
        </div>

        {/* Commentaire, date */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_170px] gap-3">
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Commentaire (obligatoire)</span>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Constat du contrôle, décision prise, accord du fournisseur..."
              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none resize-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Date du traitement</span>
            <input type="date" value={date} max={dateVersInput(new Date())} onChange={(e) => setDate(e.target.value)} className={CLASSE_CHAMP_COMPACT} />
          </label>
        </div>

        <BandeauErreur message={erreur} className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFermer} data-annuler className={CLASSE_BOUTON_SECONDAIRE}>
            Annuler
          </button>
          <button type="button" onClick={onValider} disabled={envoi} className={CLASSE_BOUTON_PRIMAIRE}>
            {envoi ? 'Validation...' : 'Valider le traitement'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
