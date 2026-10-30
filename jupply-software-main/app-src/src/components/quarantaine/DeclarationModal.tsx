import { useConfirmation } from '../../context/ConfirmationContext'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { messageErreur } from '../../lib/erreurs'
import { peutSaisirReception } from '../../lib/permissions'
import { getEntrepots } from '../../lib/api/entrepots'
import { getProduitsAvecStock } from '../../lib/api/stock'
import { getFournisseurs, getLocalisationsProduits } from '../../lib/api/produits'
import { getStockLots, lotsDepuisLocalisations } from '../../lib/api/lots'
import { declarerNonConformite, MOTIFS_NC, type MotifNonConformite } from '../../lib/api/quarantaine'
import type { Entrepot, Fournisseur, ProduitAvecStock, StockLot } from '../../types/stock'
import { Modal } from '../ui/Modal'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_BOUTON_SECONDAIRE, CLASSE_CHAMP, CLASSE_LABEL } from '../ui/styles'
import { BandeauErreur } from '../ui/BandeauErreur'

interface DeclarationModalProps {
  onFermer: () => void
  onDeclare: (nonConformiteId: string) => void
}

function libelleLot(l: StockLot): string {
  const lot = l.lot && l.numero_serie ? `${l.lot} / ${l.numero_serie}` : (l.lot ?? l.numero_serie ?? 'Sans lot')
  const expiration = l.date_expiration ? ` · exp. ${new Date(l.date_expiration).toLocaleDateString('fr-FR')}` : ''
  return `${l.emplacement_code} · ${lot}${expiration} · ${l.quantite} disponible(s)`
}

/** Déclaration d'une non-conformité constatée en stock : la quantité passe en quarantaine avec un dossier. */
export function DeclarationModal({ onFermer, onDeclare }: DeclarationModalProps) {
  const { confirmer } = useConfirmation()
  const { profil, entrepotsAssignes } = useAuth()
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [lots, setLots] = useState<Map<string, StockLot[]>>(new Map())
  const [entrepotId, setEntrepotId] = useState('')
  const [reference, setReference] = useState('')
  const [cleLot, setCleLot] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [motif, setMotif] = useState<MotifNonConformite | ''>('')
  const [constat, setConstat] = useState('')
  const [fournisseurId, setFournisseurId] = useState('')
  const [numeroPo, setNumeroPo] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getEntrepots(), getProduitsAvecStock(), getFournisseurs(), getStockLots(), getLocalisationsProduits()])
      .then(([e, p, f, l, loc]) => {
        const autorises = e.filter((ent) => peutSaisirReception(profil?.role, ent.id, entrepotsAssignes))
        setEntrepots(autorises)
        setEntrepotId(autorises[0]?.id ?? '')
        setProduits(p)
        setFournisseurs(f)
        setLots(l ?? lotsDepuisLocalisations(loc))
      })
      .catch((e) => setErreur(messageErreur(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produit = useMemo(
    () => produits.find((p) => p.reference.toLowerCase() === reference.trim().toLowerCase()) ?? null,
    [produits, reference],
  )
  const lotsDisponibles = (produit ? lots.get(produit.id) ?? [] : []).filter((l) => l.entrepot_id === entrepotId)
  const cle = (l: StockLot) => l.id ?? `emplacement:${l.emplacement_id}`
  const lotChoisi = lotsDisponibles.find((l) => cle(l) === cleLot) ?? null

  useEffect(() => {
    setCleLot(lotsDisponibles[0] ? cle(lotsDisponibles[0]) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produit?.id, entrepotId])

  async function onValider() {
    const n = Number(quantite)
    if (!produit) return setErreur('Saisis une référence existante.')
    if (!lotChoisi) return setErreur('Ce produit n\'a pas de stock disponible dans ce dépôt.')
    if (!Number.isInteger(n) || n <= 0 || n > lotChoisi.quantite) return setErreur(`Quantité invalide (maximum ${lotChoisi.quantite}).`)
    if (!motif) return setErreur('Choisis le motif.')
    if (!constat.trim()) return setErreur('Décris le constat.')
    const ok = await confirmer({
      titre: 'Mettre en quarantaine ?',
      message: `${n.toLocaleString('fr-FR')} unité(s) de ${produit.reference} vont être bloquées en quarantaine (retirées du stock disponible) et un dossier de non-conformité sera ouvert.`,
      libelleConfirmer: 'Mettre en quarantaine',
    })
    if (!ok) return
    setErreur(null)
    setEnvoi(true)
    try {
      const id = await declarerNonConformite({
        entrepotId,
        produitId: produit.id,
        emplacementId: lotChoisi.emplacement_id,
        stockLotId: lotChoisi.id,
        quantite: n,
        motif,
        constat: constat.trim(),
        fournisseurId: fournisseurId || null,
        numeroPo: numeroPo.trim() || null,
      })
      onDeclare(id)
    } catch (e) {
      setErreur(messageErreur(e))
      setEnvoi(false)
    }
  }

  return (
    <Modal titre="Déclarer une non-conformité" onFermer={onFermer} large>
      <div className="flex flex-col gap-3 overflow-y-auto">
        <p className="text-xs text-text-muted">
          Pour un produit déjà en stock (dommage constaté en rayon, fuite, péremption...). La quantité déclarée passe
          en quarantaine et un dossier de non-conformité est ouvert.
        </p>
        <datalist id="references-declaration">
          {produits.map((p) => (
            <option key={p.id} value={p.reference} label={p.designation} />
          ))}
        </datalist>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Dépôt</span>
            <select value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)} className={CLASSE_CHAMP}>
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Référence</span>
            <input
              autoFocus
              list="references-declaration"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Tape la référence..."
              className={`${CLASSE_CHAMP} font-mono`}
            />
            <span className={`text-xs ${produit ? 'text-text' : 'text-text-muted'}`}>
              {produit ? produit.designation : reference.trim() ? 'Référence inconnue' : ' '}
            </span>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className={CLASSE_LABEL}>Emplacement et lot concernés</span>
            <select value={cleLot} onChange={(e) => setCleLot(e.target.value)} disabled={!produit} className={CLASSE_CHAMP}>
              {lotsDisponibles.length === 0 && <option value="">{produit ? 'Aucun stock dans ce dépôt' : '—'}</option>}
              {lotsDisponibles.map((l) => (
                <option key={cle(l)} value={cle(l)}>
                  {libelleLot(l)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Quantité non conforme</span>
            <input type="number" min="1" max={lotChoisi?.quantite} value={quantite} onChange={(e) => setQuantite(e.target.value)} className={CLASSE_CHAMP} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Motif</span>
            <select value={motif} onChange={(e) => setMotif(e.target.value as MotifNonConformite | '')} className={CLASSE_CHAMP}>
              <option value="">Choisir...</option>
              {MOTIFS_NC.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className={CLASSE_LABEL}>Constat</span>
            <textarea
              value={constat}
              onChange={(e) => setConstat(e.target.value)}
              rows={2}
              placeholder="Ce qui a été constaté (état, circonstances, nombre d'unités touchées...)"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[13px] text-text outline-none resize-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Fournisseur (facultatif)</span>
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={CLASSE_CHAMP}>
              <option value="">Aucun</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>N° de commande (facultatif)</span>
            <input value={numeroPo} onChange={(e) => setNumeroPo(e.target.value)} className={CLASSE_CHAMP} />
          </label>
        </div>

        <BandeauErreur message={erreur} className="text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFermer} data-annuler className={CLASSE_BOUTON_SECONDAIRE}>
            Annuler
          </button>
          <button type="button" onClick={onValider} disabled={envoi} className={CLASSE_BOUTON_PRIMAIRE}>
            {envoi ? 'Déclaration...' : 'Mettre en quarantaine'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
