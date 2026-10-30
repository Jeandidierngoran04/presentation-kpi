import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTabs } from '../context/TabsContext'
import { useConfirmation } from '../context/ConfirmationContext'
import {
  peutDemanderTransfert,
  peutExpedierTransfert,
  peutReceptionnerTransfert,
  peutValiderTransfert,
} from '../lib/permissions'
import { messageErreur } from '../lib/erreurs'
import { texteFiltre } from '../lib/filtreTexte'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getLocalisationsProduits } from '../lib/api/produits'
import {
  demanderTransfert,
  expedierTransfert,
  getLignesTransfert,
  getTransferts,
  receptionnerTransfert,
  validerTransfert,
  type LigneDemandeTransfert,
} from '../lib/api/transferts'
import { dateVersInput, dateSaisieVersISO } from '../lib/dates'
import type {
  Emplacement,
  Entrepot,
  LocalisationProduit,
  ProduitAvecStock,
  StatutTransfert,
  TransfertAffiche,
  TransfertLigneAffichee,
} from '../types/stock'
import { Modal } from '../components/ui/Modal'
import { useMenuContextuel } from '../components/ui/MenuContextuel'
import { classeBadge, type TonBadge } from '../components/ui/Badge'
import { EnTetePage } from '../components/ui/EnTetePage'
import { ChampRecherche } from '../components/ui/ChampRecherche'
import { BandeauErreur } from '../components/ui/BandeauErreur'

const CLASSE_INPUT = 'border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
const CLASSE_BOUTON_PRIMAIRE =
  'bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 transition-colors disabled:opacity-60'

// Vert = terminé, bleu = en cours, gris = en attente.
const STYLES_STATUT: Record<StatutTransfert, { label: string; ton: TonBadge }> = {
  demande: { label: 'Demandé', ton: 'neutre' },
  valide: { label: 'Validé', ton: 'info' },
  expedie: { label: 'Expédié', ton: 'info' },
  en_transit: { label: 'En transit', ton: 'info' },
  recu: { label: 'Reçu', ton: 'succes' },
}

export function Transferts() {
  const { profil, entrepotsAssignes } = useAuth()
  const { confirmer } = useConfirmation()
  const { ongletActifId } = useTabs()
  const [transferts, setTransferts] = useState<TransfertAffiche[]>([])
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [modalOuvert, setModalOuvert] = useState(false)
  const [modalExpeditionOuvert, setModalExpeditionOuvert] = useState(false)
  const [modalReceptionOuvert, setModalReceptionOuvert] = useState(false)

  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [lignes, setLignes] = useState<TransfertLigneAffichee[]>([])
  const [envoiValidation, setEnvoiValidation] = useState(false)

  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()

  function chargerListe() {
    Promise.all([getTransferts(), getProduitsAvecStock()])
      .then(([t, p]) => {
        setTransferts(t)
        setProduits(p)
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  // Rechargé à chaque retour sur l'onglet.
  useEffect(() => {
    if (ongletActifId === 'transferts') chargerListe()
  }, [ongletActifId])

  useEffect(() => {
    if (!selectionId) return
    getLignesTransfert(selectionId).then(setLignes)
  }, [selectionId])

  const selection = transferts.find((t) => t.id === selectionId) ?? null
  const transfertsFiltres = useMemo(() => {
    if (!recherche.trim()) return transferts
    return transferts.filter((t) =>
      [t.numero_suivi, t.entrepot_source_nom, t.entrepot_destination_nom].some((v) => texteFiltre(v ?? '', recherche)),
    )
  }, [transferts, recherche])

  function onClicDroitTableau(e: MouseEvent) {
    if (!peutDemanderTransfert(profil?.role)) return
    ouvrirMenu(e, [{ label: 'Nouveau transfert', onClick: () => setModalOuvert(true) }])
  }

  function apresAction() {
    chargerListe()
    if (selectionId) getLignesTransfert(selectionId).then(setLignes)
  }

  async function onValider() {
    if (!selection) return
    const ok = await confirmer({
      titre: `Valider le transfert ${selection.numero_suivi} ?`,
      message: `De ${selection.entrepot_source_nom ?? '—'} vers ${selection.entrepot_destination_nom ?? '—'}. Une fois validé, le dépôt de départ pourra l'expédier.`,
      libelleConfirmer: 'Valider le transfert',
    })
    if (!ok) return
    setEnvoiValidation(true)
    try {
      await validerTransfert(selection.id)
      apresAction()
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setEnvoiValidation(false)
    }
  }

  if (erreur) {
    return <div className="max-w-lg mx-auto mt-12 bg-danger-soft text-danger-deep text-sm rounded-xl p-5">{erreur}</div>
  }

  const peutValiderCelui = selection != null && peutValiderTransfert(profil?.role)
  const peutExpedierCelui =
    selection != null && peutExpedierTransfert(profil?.role, selection.entrepot_source_id, entrepotsAssignes)
  const peutReceptionnerCelui =
    selection != null && peutReceptionnerTransfert(profil?.role, selection.entrepot_destination_id, entrepotsAssignes)

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2" onContextMenu={onClicDroitTableau}>
      <EnTetePage titre="Transferts entre entrepôts" compteur={transfertsFiltres.length} />
      <div className="shrink-0">
        <ChampRecherche valeur={recherche} onChange={setRecherche} aide="N° de suivi, dépôt de départ ou d'arrivée (* en tête = contient)" />
      </div>

      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : (
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="tableau-dense">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                  <th className="font-medium py-1 px-2">Numéro</th>
                  <th className="font-medium py-1 px-2">Source</th>
                  <th className="font-medium py-1 px-2">Destination</th>
                  <th className="font-medium py-1 px-2">Statut</th>
                  <th className="font-medium py-1 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {transfertsFiltres.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectionId(t.id)}
                    className={`border-t border-border cursor-pointer ${
                      selectionId === t.id ? 'bg-accent-soft' : 'hover:bg-muted'
                    }`}
                  >
                    <td className="py-1 px-2 font-mono text-xs text-text-muted">{t.numero_suivi}</td>
                    <td className="py-1 px-2 font-medium text-text">{t.entrepot_source_nom}</td>
                    <td className="py-1 px-2 font-medium text-text">{t.entrepot_destination_nom}</td>
                    <td className="py-1 px-2">
                      <span className={classeBadge(STYLES_STATUT[t.statut].ton)}>
                        {STYLES_STATUT[t.statut].label}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-text-muted">{new Date(t.cree_le).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transfertsFiltres.length === 0 && (
            <p className="text-sm text-text-muted py-8 text-center">
              {transferts.length === 0 ? 'Aucun transfert. Clic droit pour en créer un.' : 'Aucun transfert ne correspond à la recherche.'}
            </p>
          )}
        </div>
      )}

      {selection && (
        <div className="shrink-0 max-h-[26vh] overflow-y-auto bg-card rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-semibold text-text uppercase tracking-wide">
              Lignes — {selection.numero_suivi}
            </h2>
            <div className="flex gap-1.5">
              {selection.statut === 'demande' && peutValiderCelui && (
                <button
                  onClick={onValider}
                  disabled={envoiValidation}
                  className="text-xs font-semibold bg-accent hover:bg-accent-strong text-accent-contrast rounded-lg px-3 py-1.5 disabled:opacity-60"
                >
                  {envoiValidation ? 'Validation...' : 'Valider'}
                </button>
              )}
              {selection.statut === 'valide' && peutExpedierCelui && (
                <button
                  onClick={() => setModalExpeditionOuvert(true)}
                  className="text-xs font-semibold bg-accent hover:bg-accent-strong text-accent-contrast rounded-lg px-3 py-1.5"
                >
                  Expédier
                </button>
              )}
              {selection.statut === 'en_transit' && peutReceptionnerCelui && (
                <button
                  onClick={() => setModalReceptionOuvert(true)}
                  className="text-xs font-semibold bg-accent hover:bg-accent-strong text-accent-contrast rounded-lg px-3 py-1.5"
                >
                  Réceptionner
                </button>
              )}
            </div>
          </div>

          <table className="tableau-dense">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                <th className="font-medium pb-1">Produit</th>
                <th className="font-medium pb-1">Qté expédiée</th>
                <th className="font-medium pb-1">Emplacement source</th>
                <th className="font-medium pb-1">Qté reçue</th>
                <th className="font-medium pb-1">Emplacement destination</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-1 font-medium text-text">
                    {l.produit_reference} — {l.produit_designation}
                  </td>
                  <td className="py-1 text-text-muted">{l.quantite_expediee}</td>
                  <td className="py-1 text-text-muted font-mono text-[11px]">{l.emplacement_source_id ? '✓' : '—'}</td>
                  <td className="py-1 text-text-muted">{l.quantite_recue ?? '—'}</td>
                  <td className="py-1 text-text-muted font-mono text-[11px]">{l.emplacement_destination_id ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOuvert && (
        <NouveauTransfertModal
          produits={produits}
          onFermer={() => setModalOuvert(false)}
          onCree={() => {
            setModalOuvert(false)
            chargerListe()
          }}
        />
      )}

      {modalExpeditionOuvert && selection && (
        <ExpedierTransfertModal
          transfert={selection}
          lignes={lignes}
          onFermer={() => setModalExpeditionOuvert(false)}
          onExpedie={() => {
            setModalExpeditionOuvert(false)
            apresAction()
          }}
        />
      )}

      {modalReceptionOuvert && selection && (
        <ReceptionnerTransfertModal
          transfert={selection}
          lignes={lignes}
          onFermer={() => setModalReceptionOuvert(false)}
          onReceptionne={() => {
            setModalReceptionOuvert(false)
            apresAction()
          }}
        />
      )}

      {menu}
    </div>
  )
}

interface LigneFormulaireTransfert {
  cle: string
  produitId: string
  quantite: string
  recherche: string
}

function ligneVide(): LigneFormulaireTransfert {
  return { cle: Math.random().toString(36).slice(2), produitId: '', quantite: '', recherche: '' }
}

interface NouveauTransfertModalProps {
  produits: ProduitAvecStock[]
  onFermer: () => void
  onCree: () => void
}

function NouveauTransfertModal({ produits, onFermer, onCree }: NouveauTransfertModalProps) {
  const { profil } = useAuth()
  const { confirmer } = useConfirmation()
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [entrepotSourceId, setEntrepotSourceId] = useState('')
  const [entrepotDestinationId, setEntrepotDestinationId] = useState('')
  const [ligneFormulaires, setLigneFormulaires] = useState<LigneFormulaireTransfert[]>([ligneVide()])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    getEntrepots().then((liste) => {
      setEntrepots(liste)
      if (liste.length > 0) setEntrepotSourceId(liste[0].id)
      if (liste.length > 1) setEntrepotDestinationId(liste[1].id)
    })
  }, [])

  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])

  function majLigne(cle: string, champs: Partial<LigneFormulaireTransfert>) {
    setLigneFormulaires((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...champs } : l)))
  }

  function resultatsRecherche(recherche: string) {
    if (!recherche.trim()) return []
    return produits.filter((p) => texteFiltre(p.reference, recherche)).slice(0, 15)
  }

  function ajouterLigne() {
    setLigneFormulaires((prev) => [...prev, ligneVide()])
  }

  function retirerLigne(cle: string) {
    setLigneFormulaires((prev) => (prev.length > 1 ? prev.filter((l) => l.cle !== cle) : prev))
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null)

    if (!entrepotSourceId || !entrepotDestinationId) {
      setErreur('Choisis un entrepôt source et un entrepôt destination.')
      return
    }
    if (entrepotSourceId === entrepotDestinationId) {
      setErreur("L'entrepôt source et destination doivent être différents.")
      return
    }
    if (ligneFormulaires.some((l) => !l.produitId || !l.quantite)) {
      setErreur('Chaque ligne doit avoir un produit et une quantité.')
      return
    }
    const nomDepot = (id: string) => entrepots.find((e) => e.id === id)?.nom ?? '—'
    const unites = ligneFormulaires.reduce((t, l) => t + Number(l.quantite || 0), 0)
    const ok = await confirmer({
      titre: 'Envoyer la demande de transfert ?',
      message: `${ligneFormulaires.length} ligne(s), ${unites.toLocaleString('fr-FR')} unité(s), de ${nomDepot(entrepotSourceId)} vers ${nomDepot(entrepotDestinationId)}. Le stock ne bouge qu'à l'expédition.`,
      libelleConfirmer: 'Envoyer la demande',
    })
    if (!ok) return

    setEnvoi(true)
    try {
      const lignes: LigneDemandeTransfert[] = ligneFormulaires.map((l) => ({
        produitId: l.produitId,
        quantite: Number(l.quantite),
      }))
      await demanderTransfert(entrepotSourceId, entrepotDestinationId, lignes)
      onCree()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  if (!profil) return null

  return (
    <Modal titre="Nouveau transfert" onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Entrepôt source</span>
            <select value={entrepotSourceId} onChange={(e) => setEntrepotSourceId(e.target.value)} className={CLASSE_INPUT}>
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Entrepôt destination</span>
            <select
              value={entrepotDestinationId}
              onChange={(e) => setEntrepotDestinationId(e.target.value)}
              className={CLASSE_INPUT}
            >
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium text-text-muted">Produits à transférer</span>
          {ligneFormulaires.map((ligne, index) => (
            <div key={ligne.cle} className="border border-border rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">Ligne {index + 1}</span>
                {ligneFormulaires.length > 1 && (
                  <button
                    type="button"
                    onClick={() => retirerLigne(ligne.cle)}
                    className="text-text-muted hover:text-danger"
                    title="Retirer cette ligne"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {ligne.produitId ? (
                <div className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2">
                  <span>
                    <span className="font-mono text-xs text-text-muted mr-1.5">
                      {produitParId.get(ligne.produitId)?.reference}
                    </span>
                    {produitParId.get(ligne.produitId)?.designation}
                  </span>
                  <button
                    type="button"
                    onClick={() => majLigne(ligne.cle, { produitId: '', recherche: '' })}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-2">
                    <Search size={13} className="text-text-muted shrink-0" />
                    <input
                      value={ligne.recherche}
                      onChange={(e) => majLigne(ligne.cle, { recherche: e.target.value })}
                      placeholder="Référence... (* = contient)"
                      className="text-sm outline-none w-full"
                    />
                  </div>
                  {resultatsRecherche(ligne.recherche).length > 0 && (
                    <ul className="border border-border rounded-lg max-h-36 overflow-y-auto divide-y divide-border">
                      {resultatsRecherche(ligne.recherche).map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => majLigne(ligne.cle, { produitId: p.id, recherche: '' })}
                            className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-muted flex items-center justify-between"
                          >
                            <span>
                              <span className="font-mono text-text-muted mr-1.5">{p.reference}</span>
                              {p.designation}
                            </span>
                            <span className="text-text-muted shrink-0 ml-1.5">{p.stock_actuel}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Quantité à transférer</span>
                <input
                  type="number"
                  min="1"
                  value={ligne.quantite}
                  onChange={(e) => majLigne(ligne.cle, { quantite: e.target.value })}
                  className={CLASSE_INPUT}
                />
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={ajouterLigne}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-card border border-border rounded-lg py-2 hover:border-text-muted"
          >
            <Plus size={13} /> Ajouter une ligne
          </button>
        </div>

        <BandeauErreur message={erreur} className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5" />

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Envoi...' : 'Demander le transfert'}
        </button>
      </form>
    </Modal>
  )
}

interface ExpedierTransfertModalProps {
  transfert: TransfertAffiche
  lignes: TransfertLigneAffichee[]
  onFermer: () => void
  onExpedie: () => void
}

function ExpedierTransfertModal({ transfert, lignes, onFermer, onExpedie }: ExpedierTransfertModalProps) {
  const { confirmer } = useConfirmation()
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [choix, setChoix] = useState<Map<string, string>>(new Map())
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getEmplacements(transfert.entrepot_source_id), getLocalisationsProduits()]).then(([e, l]) => {
      setEmplacements(e)
      setLocalisations(l)
      setChoix((prev) => {
        const suivant = new Map(prev)
        for (const ligne of lignes) {
          if (suivant.has(ligne.id)) continue
          const dispo = (l.get(ligne.produit_id) ?? []).find((loc) => loc.entrepot_id === transfert.entrepot_source_id)
          suivant.set(ligne.id, dispo?.emplacement_id ?? e.find((em) => !em.est_quarantaine)?.id ?? '')
        }
        return suivant
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfert.entrepot_source_id])

  function emplacementsDisponiblesPour(produitId: string) {
    return (localisations.get(produitId) ?? []).filter((l) => l.entrepot_id === transfert.entrepot_source_id)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null)
    if (lignes.some((l) => !choix.get(l.id))) {
      setErreur('Choisis un emplacement source pour chaque ligne.')
      return
    }
    const ok = await confirmer({
      titre: `Expédier ${transfert.numero_suivi} ?`,
      message: `${lignes.length} ligne(s) vont quitter le stock de ${transfert.entrepot_source_nom ?? 'départ'} et passer « En transit ». L'expédition ne peut pas être annulée.`,
      libelleConfirmer: 'Expédier',
    })
    if (!ok) return
    setEnvoi(true)
    try {
      await expedierTransfert(
        transfert.id,
        lignes.map((l) => ({ transfertLigneId: l.id, emplacementSourceId: choix.get(l.id) ?? '' })),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
      )
      onExpedie()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre={`Expédier — ${transfert.numero_suivi}`} onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto pr-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Date du mouvement</span>
          <input
            type="date"
            value={dateMouvement}
            onChange={(e) => setDateMouvement(e.target.value)}
            className={CLASSE_INPUT}
          />
        </label>

        {lignes.map((l) => {
          const emplacementsProduit = emplacementsDisponiblesPour(l.produit_id)
          return (
            <div key={l.id} className="border border-border rounded-xl p-3 flex flex-col gap-2">
              <div className="text-sm font-medium text-text">
                {l.produit_reference} — {l.produit_designation}
              </div>
              <div className="text-xs text-text-muted">Quantité à expédier : {l.quantite_expediee}</div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Emplacement source</span>
                <select
                  value={choix.get(l.id) ?? ''}
                  onChange={(e) => setChoix((prev) => new Map(prev).set(l.id, e.target.value))}
                  className={CLASSE_INPUT}
                >
                  <option value="">Choisir...</option>
                  {emplacementsProduit.map((loc) => (
                    <option key={loc.emplacement_id} value={loc.emplacement_id}>
                      {loc.emplacement_code} ({loc.quantite} disponible)
                    </option>
                  ))}
                  {emplacementsProduit.length === 0 &&
                    emplacements.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.code}
                        {e.est_quarantaine ? ' (Quarantaine)' : ''}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )
        })}

        <BandeauErreur message={erreur} className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5" />

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Expédition...' : 'Expédier'}
        </button>
      </form>
    </Modal>
  )
}

interface ReceptionnerTransfertModalProps {
  transfert: TransfertAffiche
  lignes: TransfertLigneAffichee[]
  onFermer: () => void
  onReceptionne: () => void
}

function ReceptionnerTransfertModal({ transfert, lignes, onFermer, onReceptionne }: ReceptionnerTransfertModalProps) {
  const { confirmer } = useConfirmation()
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [emplacementChoisi, setEmplacementChoisi] = useState<Map<string, string>>(new Map())
  const [quantiteChoisie, setQuantiteChoisie] = useState<Map<string, string>>(new Map())
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    getEmplacements(transfert.entrepot_destination_id).then((e) => {
      setEmplacements(e)
      setEmplacementChoisi((prev) => {
        const suivant = new Map(prev)
        for (const ligne of lignes) {
          if (!suivant.has(ligne.id)) suivant.set(ligne.id, e.find((em) => !em.est_quarantaine)?.id ?? '')
        }
        return suivant
      })
      setQuantiteChoisie((prev) => {
        const suivant = new Map(prev)
        for (const ligne of lignes) {
          if (!suivant.has(ligne.id)) suivant.set(ligne.id, String(ligne.quantite_expediee))
        }
        return suivant
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfert.entrepot_destination_id])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null)
    if (lignes.some((l) => !emplacementChoisi.get(l.id) || !quantiteChoisie.get(l.id))) {
      setErreur('Choisis un emplacement et une quantité reçue pour chaque ligne.')
      return
    }
    const unites = lignes.reduce((t, l) => t + Number(quantiteChoisie.get(l.id) ?? 0), 0)
    const ok = await confirmer({
      titre: `Réceptionner ${transfert.numero_suivi} ?`,
      message: `${unites.toLocaleString('fr-FR')} unité(s) vont entrer dans le stock de ${transfert.entrepot_destination_nom ?? 'destination'}. Un écart avec la quantité expédiée sera enregistré tel quel.`,
      libelleConfirmer: 'Réceptionner',
    })
    if (!ok) return
    setEnvoi(true)
    try {
      await receptionnerTransfert(
        transfert.id,
        lignes.map((l) => ({
          transfertLigneId: l.id,
          emplacementDestinationId: emplacementChoisi.get(l.id) ?? '',
          quantiteRecue: Number(quantiteChoisie.get(l.id) ?? 0),
        })),
        dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
      )
      onReceptionne()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre={`Réceptionner — ${transfert.numero_suivi}`} onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto pr-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Date du mouvement</span>
          <input
            type="date"
            value={dateMouvement}
            onChange={(e) => setDateMouvement(e.target.value)}
            className={CLASSE_INPUT}
          />
        </label>

        {lignes.map((l) => (
          <div key={l.id} className="border border-border rounded-xl p-3 flex flex-col gap-2">
            <div className="text-sm font-medium text-text">
              {l.produit_reference} — {l.produit_designation}
            </div>
            <div className="text-xs text-text-muted">Quantité expédiée : {l.quantite_expediee}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Quantité reçue</span>
                <input
                  type="number"
                  min="0"
                  value={quantiteChoisie.get(l.id) ?? ''}
                  onChange={(e) => setQuantiteChoisie((prev) => new Map(prev).set(l.id, e.target.value))}
                  className={CLASSE_INPUT}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">Emplacement destination</span>
                <select
                  value={emplacementChoisi.get(l.id) ?? ''}
                  onChange={(e) => setEmplacementChoisi((prev) => new Map(prev).set(l.id, e.target.value))}
                  className={CLASSE_INPUT}
                >
                  <option value="">Choisir...</option>
                  {emplacements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code}
                      {e.est_quarantaine ? ' (Quarantaine)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}

        <BandeauErreur message={erreur} className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5" />

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Réception...' : 'Réceptionner'}
        </button>
      </form>
    </Modal>
  )
}
