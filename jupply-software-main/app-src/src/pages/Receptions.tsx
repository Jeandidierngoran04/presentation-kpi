import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { peutSaisirReception, peutValiderReception } from '../lib/permissions'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { creerFournisseur, getFournisseurs, getLocalisationsProduits } from '../lib/api/produits'
import {
  creerReception,
  getLignesReception,
  getReceptions,
  validerReception,
  type NouvelleLigneReception,
  type ReceptionAffichee,
} from '../lib/api/receptions'
import type {
  Entrepot,
  Fournisseur,
  LocalisationProduit,
  ProduitAvecStock,
  ReceptionLigne,
  StatutReception,
} from '../types/stock'
import { Modal } from '../components/ui/Modal'
import { useMenuContextuel } from '../components/ui/MenuContextuel'

const CLASSE_INPUT = 'border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
const CLASSE_BOUTON_PRIMAIRE =
  'bg-accent hover:bg-accent-strong text-accent-contrast text-sm font-semibold rounded-lg py-2.5 transition-colors disabled:opacity-60'

const STYLES_STATUT: Record<StatutReception, { label: string; classe: string }> = {
  en_attente: { label: 'En attente', classe: 'bg-muted text-text-muted' },
  validee: { label: 'Validée', classe: 'bg-accent-soft text-accent-deep' },
  partielle: { label: 'Partielle', classe: 'bg-warn-soft text-warn-deep' },
  anomalie: { label: 'Anomalie', classe: 'bg-danger-soft text-danger-deep' },
}

export function Receptions() {
  const { profil, entrepotsAssignes } = useAuth()
  const [receptions, setReceptions] = useState<ReceptionAffichee[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [modalOuvert, setModalOuvert] = useState(false)

  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [lignes, setLignes] = useState<ReceptionLigne[]>([])
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [envoiValidation, setEnvoiValidation] = useState(false)

  const { ouvrir: ouvrirMenu, menu } = useMenuContextuel()

  function chargerListe() {
    setChargement(true)
    Promise.all([getReceptions(), getProduitsAvecStock()])
      .then(([r, p]) => {
        setReceptions(r)
        setProduits(p)
      })
      .catch((e) => setErreur(e.message ?? 'Erreur inconnue.'))
      .finally(() => setChargement(false))
  }

  useEffect(chargerListe, [])

  useEffect(() => {
    if (!selectionId) return
    getLignesReception(selectionId).then(setLignes)
  }, [selectionId])

  const selection = receptions.find((r) => r.id === selectionId) ?? null
  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])

  function onClicDroitTableau(e: MouseEvent) {
    ouvrirMenu(e, [{ label: 'Nouvelle réception', onClick: () => setModalOuvert(true) }])
  }

  async function onValider() {
    if (!selection) return
    setEnvoiValidation(true)
    try {
      await validerReception(selection.id)
      chargerListe()
      getLignesReception(selection.id).then(setLignes)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
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
      <div className="shrink-0 flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-bold text-text">Entrées de stock</h1>
        <p className="text-xs text-text-muted">
          Clic droit = nouvelle réception · le stock n'augmente qu'après validation
        </p>
      </div>

      {chargement ? (
        <div className="text-sm text-text-muted py-12 text-center">Chargement...</div>
      ) : (
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide bg-muted">
                <th className="font-medium py-1 px-2">Numéro</th>
                <th className="font-medium py-1 px-2">Entrepôt</th>
                <th className="font-medium py-1 px-2">Fournisseur</th>
                <th className="font-medium py-1 px-2">N° PO</th>
                <th className="font-medium py-1 px-2">Statut</th>
                <th className="font-medium py-1 px-2">Date</th>
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
                    <span className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STYLES_STATUT[r.statut].classe}`}>
                      {STYLES_STATUT[r.statut].label}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-text-muted">{new Date(r.cree_le).toLocaleDateString('fr-FR')}</td>
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

          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wide">
                <th className="font-medium pb-1">Produit</th>
                <th className="font-medium pb-1">Attendu</th>
                <th className="font-medium pb-1">Reçu</th>
                <th className="font-medium pb-1">Lot / N° série</th>
                <th className="font-medium pb-1">Prix</th>
                <th className="font-medium pb-1">Anomalie</th>
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
                    {l.anomalie && (
                      <span className="inline-flex items-center gap-1 text-danger text-xs font-semibold">
                        <AlertTriangle size={12} /> Oui
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOuvert && profil && (
        <NouvelleReceptionModal
          produits={produits}
          onFermer={() => setModalOuvert(false)}
          onCree={() => {
            setModalOuvert(false)
            chargerListe()
          }}
        />
      )}

      {menu}
    </div>
  )
}

interface LigneFormulaire {
  cle: string
  produitId: string
  emplacementId: string
  quantiteAttendue: string
  quantiteRecue: string
  lot: string
  numeroSerie: string
  dateExpiration: string
  prixUnitaire: string
  anomalie: boolean
}

function ligneVide(): LigneFormulaire {
  return {
    cle: Math.random().toString(36).slice(2),
    produitId: '',
    emplacementId: '',
    quantiteAttendue: '',
    quantiteRecue: '',
    lot: '',
    numeroSerie: '',
    dateExpiration: '',
    prixUnitaire: '',
    anomalie: false,
  }
}

interface NouvelleReceptionModalProps {
  produits: ProduitAvecStock[]
  onFermer: () => void
  onCree: () => void
}

function NouvelleReceptionModal({ produits, onFermer, onCree }: NouvelleReceptionModalProps) {
  const { profil, entrepotsAssignes } = useAuth()
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [emplacements, setEmplacements] = useState<{ id: string; code: string; est_quarantaine: boolean }[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [entrepotId, setEntrepotId] = useState('')
  const [fournisseurId, setFournisseurId] = useState('')
  const [nouveauFournisseur, setNouveauFournisseur] = useState('')
  const [numeroPo, setNumeroPo] = useState('')
  const [ligneFormulaires, setLigneFormulaires] = useState<LigneFormulaire[]>([ligneVide()])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getEntrepots(), getFournisseurs(), getLocalisationsProduits()]).then(([e, f, l]) => {
      const entrepotsAutorises = e.filter((ent) => peutSaisirReception(profil?.role, ent.id, entrepotsAssignes))
      setEntrepots(entrepotsAutorises)
      if (entrepotsAutorises.length > 0) setEntrepotId(entrepotsAutorises[0].id)
      setFournisseurs(f)
      setLocalisations(l)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!entrepotId) return
    getEmplacements(entrepotId).then(setEmplacements)
  }, [entrepotId])

  function majLigne(cle: string, champs: Partial<LigneFormulaire>) {
    setLigneFormulaires((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...champs } : l)))
  }

  function ajouterLigne() {
    setLigneFormulaires((prev) => [...prev, ligneVide()])
  }

  function retirerLigne(cle: string) {
    setLigneFormulaires((prev) => (prev.length > 1 ? prev.filter((l) => l.cle !== cle) : prev))
  }

  async function onAjouterFournisseur() {
    if (!nouveauFournisseur.trim() || !profil) return
    const f = await creerFournisseur(profil.entreprise_id, nouveauFournisseur.trim())
    setFournisseurs((prev) => [...prev, f].sort((a, b) => a.nom.localeCompare(b.nom)))
    setFournisseurId(f.id)
    setNouveauFournisseur('')
  }

  function avertissementEmplacement(ligne: LigneFormulaire): string | null {
    if (!ligne.produitId || !ligne.emplacementId) return null
    const existant = (localisations.get(ligne.produitId) ?? []).find(
      (loc) => loc.entrepot_id === entrepotId && loc.emplacement_id !== ligne.emplacementId,
    )
    if (!existant) return null
    return `Ce produit est déjà stocké à l'emplacement ${existant.emplacement_code} dans cet entrepôt.`
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null)

    if (!entrepotId) {
      setErreur('Choisis un entrepôt.')
      return
    }
    const lignesInvalides = ligneFormulaires.some((l) => !l.produitId || !l.emplacementId || !l.quantiteAttendue)
    if (lignesInvalides) {
      setErreur('Chaque ligne doit avoir un produit, un emplacement et une quantité attendue.')
      return
    }

    setEnvoi(true)
    try {
      const lignes: NouvelleLigneReception[] = ligneFormulaires.map((l) => ({
        produitId: l.produitId,
        emplacementId: l.emplacementId,
        quantiteAttendue: Number(l.quantiteAttendue),
        quantiteRecue: Number(l.quantiteRecue || l.quantiteAttendue),
        lot: l.lot || null,
        numeroSerie: l.numeroSerie || null,
        dateExpiration: l.dateExpiration || null,
        prixUnitaire: Number(l.prixUnitaire || 0),
        anomalie: l.anomalie,
      }))
      await creerReception({ entrepotId, fournisseurId: fournisseurId || null, numeroPo: numeroPo || null, lignes })
      onCree()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
      setEnvoi(false)
    }
  }

  return (
    <Modal titre="Nouvelle réception" onFermer={onFermer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Entrepôt</span>
            <select value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)} className={CLASSE_INPUT}>
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">N° de bon de commande (optionnel)</span>
            <input value={numeroPo} onChange={(e) => setNumeroPo(e.target.value)} className={CLASSE_INPUT} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Fournisseur (optionnel)</span>
          <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={CLASSE_INPUT}>
            <option value="">Aucun</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <input
              value={nouveauFournisseur}
              onChange={(e) => setNouveauFournisseur(e.target.value)}
              placeholder="+ Nouveau fournisseur"
              className={`${CLASSE_INPUT} flex-1 text-xs py-1.5`}
            />
            <button
              type="button"
              onClick={onAjouterFournisseur}
              className="text-xs font-semibold bg-card border border-border rounded-lg px-2.5 hover:border-text-muted"
            >
              Ajouter
            </button>
          </div>
        </label>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-text-muted">Lignes reçues</span>
          {ligneFormulaires.map((ligne, index) => {
            const produit = produits.find((p) => p.id === ligne.produitId)
            const avertissement = avertissementEmplacement(ligne)
            return (
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

                <select
                  value={ligne.produitId}
                  onChange={(e) => majLigne(ligne.cle, { produitId: e.target.value })}
                  className={CLASSE_INPUT}
                >
                  <option value="">Choisir un produit...</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.reference} — {p.designation}
                    </option>
                  ))}
                </select>

                <select
                  value={ligne.emplacementId}
                  onChange={(e) => majLigne(ligne.cle, { emplacementId: e.target.value })}
                  className={CLASSE_INPUT}
                >
                  <option value="">Emplacement...</option>
                  {emplacements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code}
                      {e.est_quarantaine ? ' (Quarantaine)' : ''}
                    </option>
                  ))}
                </select>
                {avertissement && (
                  <div className="flex items-center gap-1.5 text-xs text-warn-deep bg-warn-soft rounded-lg px-2.5 py-1.5">
                    <AlertTriangle size={13} /> {avertissement}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Attendu</span>
                    <input
                      type="number"
                      min="0"
                      value={ligne.quantiteAttendue}
                      onChange={(e) => majLigne(ligne.cle, { quantiteAttendue: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Reçu</span>
                    <input
                      type="number"
                      min="0"
                      value={ligne.quantiteRecue}
                      onChange={(e) => majLigne(ligne.cle, { quantiteRecue: e.target.value })}
                      placeholder={ligne.quantiteAttendue || '0'}
                      className={CLASSE_INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Prix unitaire</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ligne.prixUnitaire}
                      onChange={(e) => majLigne(ligne.cle, { prixUnitaire: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </label>
                </div>

                {(produit?.gere_lot || produit?.gere_numero_serie || produit?.gere_expiration) && (
                  <div className="grid grid-cols-3 gap-2">
                    {produit?.gere_lot && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-text-muted">Lot</span>
                        <input
                          value={ligne.lot}
                          onChange={(e) => majLigne(ligne.cle, { lot: e.target.value })}
                          className={CLASSE_INPUT}
                        />
                      </label>
                    )}
                    {produit?.gere_numero_serie && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-text-muted">N° série</span>
                        <input
                          value={ligne.numeroSerie}
                          onChange={(e) => majLigne(ligne.cle, { numeroSerie: e.target.value })}
                          className={CLASSE_INPUT}
                        />
                      </label>
                    )}
                    {produit?.gere_expiration && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-text-muted">Expiration</span>
                        <input
                          type="date"
                          value={ligne.dateExpiration}
                          onChange={(e) => majLigne(ligne.cle, { dateExpiration: e.target.value })}
                          className={CLASSE_INPUT}
                        />
                      </label>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-1.5 text-xs text-text">
                  <input
                    type="checkbox"
                    checked={ligne.anomalie}
                    onChange={(e) => majLigne(ligne.cle, { anomalie: e.target.checked })}
                  />
                  Produit non conforme / endommagé (part en quarantaine)
                </label>
              </div>
            )
          })}

          <button
            type="button"
            onClick={ajouterLigne}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-card border border-border rounded-lg py-2 hover:border-text-muted"
          >
            <Plus size={13} /> Ajouter une ligne
          </button>
        </div>

        {erreur && <div className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2.5">{erreur}</div>}

        <button type="submit" disabled={envoi} className={`mt-1 ${CLASSE_BOUTON_PRIMAIRE}`}>
          {envoi ? 'Enregistrement...' : 'Enregistrer la réception'}
        </button>
      </form>
    </Modal>
  )
}
