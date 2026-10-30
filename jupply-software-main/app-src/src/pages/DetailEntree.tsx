// Page d'une entrée (onglet « Entrée REC-... ») : tout son contenu, et pour
// une entrée en attente les actions Annuler, Modifier, Valider. Le stock ne
// bouge qu'à la validation ; chaque action est confirmée.
import { useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, PackageCheck, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'
import { useToast } from '../context/ToastContext'
import { useConfirmation } from '../context/ConfirmationContext'
import { messageErreur } from '../lib/erreurs'
import { peutValiderReception } from '../lib/permissions'
import { getProduitsAvecStock } from '../lib/api/stock'
import {
  annulerReception,
  getLignesReception,
  getReception,
  STATUTS_RECEPTION,
  validerReception,
  type ReceptionAffichee,
  type ReceptionLigneAffichee,
} from '../lib/api/receptions'
import type { ProduitAvecStock } from '../types/stock'
import { Badge } from '../components/ui/Badge'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { CLASSE_LABEL } from '../components/ui/styles'
import { BandeauErreur } from '../components/ui/BandeauErreur'

const nombre = (n: number) => n.toLocaleString('fr-FR')
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')
const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type Confirmation = 'valider' | 'annuler' | null

export function DetailEntree() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ongletActifId, ouvrirOnglet, activerOnglet, onglets } = useTabs()
  const { entreeAfficheeId, demanderModificationEntree, demandeModificationEntree } = useSelection()
  const { confirmer } = useConfirmation()
  const { afficherToast } = useToast()
  const [entree, setEntree] = useState<ReceptionAffichee | null>(null)
  const [lignes, setLignes] = useState<ReceptionLigneAffichee[]>([])
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [motif, setMotif] = useState('')

  function charger(id: string) {
    Promise.all([getReception(id), getLignesReception(id), getProduitsAvecStock()])
      .then(([r, l, p]) => {
        setEntree(r)
        setLignes(l)
        setProduits(p)
        setErreur(r ? null : 'Entrée introuvable.')
      })
      .catch((e) => setErreur(messageErreur(e)))
  }

  // Recharge à l'ouverture d'une entrée et à chaque retour sur l'onglet (après une modification, par exemple).
  useEffect(() => {
    if (ongletActifId === 'entree' && entreeAfficheeId) charger(entreeAfficheeId)
  }, [ongletActifId, entreeAfficheeId])

  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])
  const quantiteTotale = lignes.reduce((t, l) => t + l.quantite_recue, 0)
  const valeurTotale = lignes.reduce((t, l) => t + l.quantite_recue * l.prix_unitaire, 0)
  const avecNonConformite = lignes.some((l) => (l.quantite_non_conforme ?? 0) > 0 || l.anomalie)

  if (!entreeAfficheeId) {
    return <div className="h-full flex items-center justify-center text-sm text-text-muted">Ouvre une entrée depuis la liste des Entrées.</div>
  }
  if (!entree) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted">
        {erreur ?? 'Chargement de l’entrée...'}
      </div>
    )
  }

  const enAttente = entree.statut === 'en_attente'
  const peutValider = peutValiderReception(profil?.role, entree.entrepot_id, entrepotsAssignes)
  // Annuler / modifier : l'auteur de l'entrée, ou un rôle qui peut valider (même règle qu'en base).
  const peutGerer = peutValider || entree.cree_par === profil?.id
  const statut = STATUTS_RECEPTION[entree.statut]
  const depots = entree.depots_noms.join(', ')

  async function valider() {
    await validerReception(entree!.id)
    setConfirmation(null)
    afficherToast(`Entrée ${entree!.numero} validée : le stock est mis à jour.`)
    charger(entree!.id)
  }

  async function annuler() {
    await annulerReception(entree!.id, motif.trim())
    setConfirmation(null)
    setMotif('')
    afficherToast(`Entrée ${entree!.numero} annulée. Le stock n'a pas bougé.`)
    charger(entree!.id)
  }

  // Une seule modification à la fois : on termine (enregistre ou abandonne) avant d'en commencer une autre.
  async function modifier() {
    const ongletModification = onglets.find((o) => o.id === 'modifier-entree')
    if (ongletModification && demandeModificationEntree) {
      if (demandeModificationEntree.receptionId === entree!.id) {
        // Déjà en cours pour cette entrée : on y retourne, sans recharger (la saisie est conservée).
        activerOnglet('modifier-entree')
        return
      }
      const ok = await confirmer({
        titre: 'Une modification est déjà en cours',
        message: `Termine d'abord « ${ongletModification.titre} » (enregistre ou abandonne), puis reviens modifier ${entree!.numero}.`,
        libelleConfirmer: 'Aller à la modification en cours',
        libelleRetour: 'Rester ici',
      })
      if (ok) activerOnglet('modifier-entree')
      return
    }
    demanderModificationEntree(entree!.id)
    ouvrirOnglet('modifier-entree', `Modifier ${entree!.numero}`)
  }

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête : numéro, statut, informations ; actions à droite */}
      <div className="shrink-0 flex items-start gap-4 flex-wrap bg-muted/50 border border-border rounded-lg px-3 py-2.5">
        <div className="flex-1 min-w-[280px] flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <PackageCheck size={18} strokeWidth={1.75} className="text-accent-deep" />
            <h1 className="font-mono text-[17px] font-semibold text-text">{entree.numero}</h1>
            <Badge ton={statut.ton}>{statut.label}</Badge>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <Info label="Fournisseur" valeur={entree.fournisseur_nom ?? '—'} />
            <Info label="Date du mouvement" valeur={dateCourte(entree.cree_le)} />
            <Info label={entree.depots_noms.length > 1 ? 'Dépôts' : 'Dépôt'} valeur={depots || '—'} />
            <Info label="Enregistrée par" valeur={entree.cree_par_nom} />
            {entree.numero_po && <Info label="N° de commande" valeur={entree.numero_po} />}
            {entree.valide_le && <Info label="Validée" valeur={`${dateHeure(entree.valide_le)} · ${entree.valide_par_nom ?? '—'}`} />}
            {entree.annulee_le && <Info label="Annulée" valeur={`${dateHeure(entree.annulee_le)} · ${entree.annulee_par_nom ?? '—'}`} />}
          </dl>
          {entree.motif_annulation && (
            <p className="text-xs text-text">
              <span className="font-semibold">Motif d'annulation :</span> {entree.motif_annulation}
            </p>
          )}
          {entree.notes && (
            <p className="text-xs text-text">
              <span className="font-semibold">Note :</span> {entree.notes}
            </p>
          )}
        </div>

        {enAttente && peutGerer && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmation('annuler')}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-danger hover:bg-danger-soft"
            >
              <Ban size={14} strokeWidth={1.75} /> Annuler
            </button>
            <button
              type="button"
              onClick={modifier}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-text hover:bg-muted"
            >
              <Pencil size={14} strokeWidth={1.75} /> Modifier
            </button>
            {peutValider && (
              <button
                type="button"
                onClick={() => setConfirmation('valider')}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent hover:bg-accent-strong text-accent-contrast text-xs font-semibold"
              >
                <CheckCircle2 size={14} strokeWidth={1.75} /> Valider
              </button>
            )}
          </div>
        )}
      </div>

      <BandeauErreur message={erreur} className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />

      {/* Lignes de l'entrée */}
      <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-auto defilement-fin">
        <table className="tableau-dense tableau-ajuste">
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: '11%' }} />
            <col />
            <col style={{ width: '13%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} />
            {avecNonConformite && <col style={{ width: '8%' }} />}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-left">
              <th className="text-center">#</th>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Dépôt</th>
              <th>Localisation</th>
              <th>Lot</th>
              <th>N° série</th>
              <th>Expiration</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">Prix unit.</th>
              <th className="text-right">Montant</th>
              {avecNonConformite && <th className="text-right">Non conforme</th>}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const produit = produitParId.get(l.produit_id)
              return (
                <tr key={l.id}>
                  <td className="text-center text-text-muted">{i + 1}</td>
                  <td className="font-mono text-xs text-text-muted">{produit?.reference ?? '—'}</td>
                  <td className="font-medium text-text" title={produit?.designation}>
                    {produit?.designation ?? l.produit_id}
                  </td>
                  <td className="text-text-muted">{l.entrepot_nom ?? '—'}</td>
                  <td className="font-mono text-[11px] text-text-muted">{l.emplacement_code ?? '—'}</td>
                  <td className="font-mono text-[11px] text-text-muted">{l.lot ?? ''}</td>
                  <td className="font-mono text-[11px] text-text-muted">{l.numero_serie ?? ''}</td>
                  <td className="text-text-muted">{l.date_expiration ? dateCourte(l.date_expiration) : ''}</td>
                  <td className="text-right tabular-nums font-semibold text-text">{nombre(l.quantite_recue)}</td>
                  <td className="text-right tabular-nums text-text-muted">{nombre(l.prix_unitaire)}</td>
                  <td className="text-right tabular-nums text-text">{nombre(l.quantite_recue * l.prix_unitaire)}</td>
                  {avecNonConformite && (
                    <td className="text-right tabular-nums text-danger-deep">
                      {l.quantite_non_conforme || (l.anomalie ? l.quantite_recue : '') || ''}
                    </td>
                  )}
                </tr>
              )
            })}
            <tr className="bg-muted font-semibold">
              <td />
              <td colSpan={7} className="text-text">
                Total · {lignes.length} ligne(s)
              </td>
              <td className="text-right tabular-nums text-text">{nombre(quantiteTotale)}</td>
              <td />
              <td className="text-right tabular-nums text-text">{nombre(valeurTotale)} XOF</td>
              {avecNonConformite && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {confirmation === 'valider' && (
        <ConfirmationModal
          titre={`Valider l'entrée ${entree.numero} ?`}
          libelleConfirmer="Valider et mettre à jour le stock"
          onConfirmer={valider}
          onFermer={() => setConfirmation(null)}
        >
          <p>
            <span className="font-semibold">{lignes.length} ligne(s)</span>, <span className="font-semibold">{nombre(quantiteTotale)}</span>{' '}
            unité(s), montant {nombre(valeurTotale)} XOF.
          </p>
          <p>
            Le stock sera augmenté dans : <span className="font-semibold">{depots}</span>. Une entrée validée ne peut plus être
            modifiée ni annulée.
          </p>
        </ConfirmationModal>
      )}
      {confirmation === 'annuler' && (
        <ConfirmationModal
          titre={`Annuler l'entrée ${entree.numero} ?`}
          libelleConfirmer="Annuler l'entrée"
          libelleRetour="Retour"
          danger
          focusSurRetour
          confirmationImpossible={!motif.trim()}
          onConfirmer={annuler}
          onFermer={() => {
            setConfirmation(null)
            setMotif('')
          }}
        >
          <p>Le stock ne sera pas touché. L'entrée restera visible dans la liste, avec le statut « Annulée ».</p>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Motif d'annulation (obligatoire)</span>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={2}
              placeholder="Ex. saisie en double, livraison refusée..."
              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none resize-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </ConfirmationModal>
      )}
    </div>
  )
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text truncate">{valeur}</dd>
    </div>
  )
}
