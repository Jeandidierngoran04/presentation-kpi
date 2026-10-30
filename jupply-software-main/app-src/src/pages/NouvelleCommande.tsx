import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaisieEnCours, useTabs } from '../context/TabsContext'
import { useToast } from '../context/ToastContext'
import { peutGererCatalogue, peutSaisirReception } from '../lib/permissions'
import { getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getFournisseurs } from '../lib/api/produits'
import { creerCommande, getCommandes } from '../lib/api/commandes'
import type { Entrepot, Fournisseur, ProduitAvecStock } from '../types/stock'
import { NouveauFournisseurModal } from '../components/fournisseurs/NouveauFournisseurModal'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import {
  CLASSE_BOUTON_PRIMAIRE,
  CLASSE_BOUTON_SECONDAIRE,
  CLASSE_CHAMP_COMPACT,
  CLASSE_CHAMP_LECTURE,
  CLASSE_LABEL,
} from '../components/ui/styles'
import { BandeauErreur } from '../components/ui/BandeauErreur'

interface LigneSaisie {
  cle: string
  reference: string
  produitId: string
  quantite: string
  prixUnitaire: string
}

type ColonneSaisie = 'reference' | 'quantite' | 'prixUnitaire'

const CLASSE_CELLULE =
  'w-full h-8 px-2 bg-card text-xs text-text outline-none placeholder:text-text-muted ' +
  'focus:ring-2 focus:ring-inset focus:ring-accent/40 disabled:bg-muted disabled:cursor-not-allowed'
const CLASSE_TD = 'border border-border p-0'
const CLASSE_TH = 'border border-border bg-muted font-semibold h-8 px-2 text-left'

function ligneVide(): LigneSaisie {
  return { cle: Math.random().toString(36).slice(2), reference: '', produitId: '', quantite: '', prixUnitaire: '' }
}

const estVide = (l: LigneSaisie) => !l.reference.trim() && !l.quantite && !l.prixUnitaire

function avecLigneVideFinale(lignes: LigneSaisie[]): LigneSaisie[] {
  const derniere = lignes[lignes.length - 1]
  return derniere && estVide(derniere) ? lignes : [...lignes, ligneVide()]
}

const montantXof = (n: number) => `${n.toLocaleString('fr-FR')} XOF`

/** Feuille de création d'un bon de commande fournisseur, dans son propre onglet. */
export function NouvelleCommande() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ouvrirOnglet, fermerOnglet } = useTabs()
  const { afficherToast } = useToast()
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [entrepotId, setEntrepotId] = useState('')
  const [fournisseurId, setFournisseurId] = useState('')
  const [dateLivraison, setDateLivraison] = useState('')
  const [notes, setNotes] = useState('')
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide()])
  const [erreur, setErreur] = useState<string | null>(null)
  const [ficheFournisseurOuverte, setFicheFournisseurOuverte] = useState(false)
  const [confirmation, setConfirmation] = useState<'creer' | 'abandonner' | null>(null)
  const tableauRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getEntrepots(), getFournisseurs(), getProduitsAvecStock()]).then(([e, f, p]) => {
      const autorises = e.filter((ent) => peutSaisirReception(profil?.role, ent.id, entrepotsAssignes))
      setEntrepots(autorises)
      if (autorises.length > 0) setEntrepotId(autorises[0].id)
      setFournisseurs(f)
      setProduits(p)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produitParReference = useMemo(() => new Map(produits.map((p) => [p.reference.trim().toLowerCase(), p])), [produits])
  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])

  function majLigne(cle: string, champs: Partial<LigneSaisie>) {
    setLignes((prev) => avecLigneVideFinale(prev.map((l) => (l.cle === cle ? { ...l, ...champs } : l))))
  }

  function onChangerReference(ligne: LigneSaisie, texte: string) {
    const produit = produitParReference.get(texte.trim().toLowerCase())
    majLigne(ligne.cle, {
      reference: texte,
      produitId: produit?.id ?? '',
      // Prix proposé : le prix moyen pondéré actuel du produit.
      prixUnitaire:
        produit && produit.id !== ligne.produitId && !ligne.prixUnitaire && produit.prix_moyen_pondere > 0
          ? String(produit.prix_moyen_pondere)
          : ligne.prixUnitaire,
    })
  }

  function retirerLigne(cle: string) {
    setLignes((prev) => avecLigneVideFinale(prev.filter((l) => l.cle !== cle)))
  }

  function onKeyDownTableau(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    const cible = e.target as HTMLElement
    const index = cible.dataset.ligne
    const colonne = cible.dataset.colonne
    if (index == null || !colonne) return
    e.preventDefault()
    tableauRef.current?.querySelector<HTMLElement>(`[data-ligne="${Number(index) + 1}"][data-colonne="${colonne}"]`)?.focus()
  }

  const attributsCellule = (index: number, colonne: ColonneSaisie) => ({ 'data-ligne': index, 'data-colonne': colonne })

  function onFournisseurCree(f: Fournisseur) {
    setFournisseurs((prev) => [...prev, f].sort((a, b) => a.nom.localeCompare(b.nom)))
    setFournisseurId(f.id)
    setFicheFournisseurOuverte(false)
  }

  function revenirALaListe() {
    ouvrirOnglet('commandes-fournisseurs', 'Commandes fournisseurs')
    fermerOnglet('nouvelle-commande')
  }

  const lignesRemplies = lignes.filter((l) => !estVide(l))
  // Lignes non enregistrées : confirmation avant de fermer l'onglet.
  useSaisieEnCours('nouvelle-commande', lignesRemplies.length > 0)
  const quantiteTotale = lignesRemplies.reduce((t, l) => t + Number(l.quantite || 0), 0)
  const montantTotal = lignesRemplies.reduce((t, l) => t + Number(l.quantite || 0) * Number(l.prixUnitaire || 0), 0)
  const fournisseur = fournisseurs.find((f) => f.id === fournisseurId)
  const entrepot = entrepots.find((e) => e.id === entrepotId)

  function erreurDeSaisie(): string | null {
    if (!entrepotId) return 'Choisis le dépôt de livraison.'
    if (!fournisseurId) return 'Choisis le fournisseur.'
    if (lignesRemplies.length === 0) return 'Saisis au moins une ligne.'
    const dejaVus = new Set<string>()
    for (const l of lignesRemplies) {
      const numero = lignes.indexOf(l) + 1
      if (!l.produitId) return `Ligne ${numero} : référence inconnue.`
      if (dejaVus.has(l.produitId)) return `Ligne ${numero} : ce produit figure déjà sur une autre ligne.`
      dejaVus.add(l.produitId)
      const quantite = Number(l.quantite)
      if (!Number.isInteger(quantite) || quantite <= 0) return `Ligne ${numero} : saisis une quantité commandée entière et positive.`
      if (Number(l.prixUnitaire || 0) < 0) return `Ligne ${numero} : le prix ne peut pas être négatif.`
    }
    return null
  }

  function onEnregistrer() {
    const probleme = erreurDeSaisie()
    setErreur(probleme)
    if (!probleme) setConfirmation('creer')
  }

  async function creer() {
    const id = await creerCommande({
      entrepotId,
      fournisseurId,
      dateLivraisonPrevue: dateLivraison || null,
      notes: notes.trim() || null,
      lignes: lignesRemplies.map((l) => ({
        produitId: l.produitId,
        quantiteCommandee: Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire || 0),
      })),
    })
    const numero = (await getCommandes()).find((c) => c.id === id)?.numero
    afficherToast(`Commande créée${numero ? ` : ${numero}` : ''}`)
    revenirALaListe()
  }

  const lignesSansPrix = lignesRemplies.filter((l) => !Number(l.prixUnitaire)).length

  return (
    <div className="h-full flex flex-col gap-3 p-[var(--content-padding)] pt-2 min-h-0 overflow-y-auto">
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-x-6 gap-y-2 bg-muted/50 border border-border rounded-lg p-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Fournisseur</span>
            <div className="flex gap-1">
              <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
                <option value="">Choisir...</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
              </select>
              {peutGererCatalogue(profil?.role) && (
                <button
                  type="button"
                  onClick={() => setFicheFournisseurOuverte(true)}
                  className="shrink-0 inline-flex items-center gap-1 bg-card border border-border rounded-lg px-2 text-xs font-semibold text-text hover:bg-muted"
                  title="Créer un nouveau fournisseur"
                >
                  <Plus size={13} strokeWidth={1.75} /> Créer
                </button>
              )}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Dépôt de livraison</span>
            <select value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
              {entrepots.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Bon de commande</span>
            <div className={`${CLASSE_CHAMP_LECTURE} text-text-muted`}>Généré à l'enregistrement (PO-...)</div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Émis par</span>
            <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
          </div>
          <label className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Livraison prévue le</span>
            <input type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} className={CLASSE_CHAMP_COMPACT} />
          </label>
        </div>

        <label className="flex flex-col gap-1 min-h-[96px]">
          <span className={CLASSE_LABEL}>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none resize-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>
      </div>

      <div className="flex-1 min-h-[200px] flex flex-col gap-1.5">
        <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Lignes de commande</span>
            <span className="text-xs text-text-muted">
              <span className="font-semibold text-text">{lignesRemplies.length}</span> ligne(s) · Quantité totale{' '}
              <span className="font-semibold text-text">{quantiteTotale.toLocaleString('fr-FR')}</span> · Montant{' '}
              <span className="font-semibold text-text">{montantXof(montantTotal)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (lignesRemplies.length > 0 ? setConfirmation('abandonner') : revenirALaListe())}
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              Annuler
            </button>
            <button type="button" onClick={onEnregistrer} className={CLASSE_BOUTON_PRIMAIRE}>
              Créer la commande
            </button>
          </div>
        </div>
        <BandeauErreur message={erreur} className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2" />
        <datalist id="references-commande">
          {produits.map((p) => (
            <option key={p.id} value={p.reference} label={p.designation} />
          ))}
        </datalist>
        <div ref={tableauRef} onKeyDown={onKeyDownTableau} className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs table-fixed">
            <colgroup>
              <col className="w-9" />
              <col className="w-[16%]" />
              <col />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-9" />
            </colgroup>
            <thead className="sticky top-0 z-10 text-[11px] text-text-muted uppercase tracking-wide">
              <tr>
                <th className={`${CLASSE_TH} text-center`}>#</th>
                <th className={CLASSE_TH}>Référence</th>
                <th className={CLASSE_TH}>Désignation</th>
                <th className={CLASSE_TH}>Unité</th>
                <th className={`${CLASSE_TH} text-right`} title="Stock disponible actuel, tous dépôts">
                  Stock actuel
                </th>
                <th className={`${CLASSE_TH} text-right`}>Qté commandée</th>
                <th className={`${CLASSE_TH} text-right`}>Prix unit.</th>
                <th className={`${CLASSE_TH} text-right`}>Montant</th>
                <th className={CLASSE_TH} />
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne, index) => {
                const produit = ligne.produitId ? produitParId.get(ligne.produitId) : undefined
                const referenceInconnue = ligne.reference.trim() !== '' && !produit
                const vide = estVide(ligne)
                const montant = Number(ligne.quantite || 0) * Number(ligne.prixUnitaire || 0)
                return (
                  <tr key={ligne.cle}>
                    <td className={`${CLASSE_TD} text-center text-text-muted bg-muted`}>{index + 1}</td>
                    <td className={CLASSE_TD}>
                      <input
                        {...attributsCellule(index, 'reference')}
                        list="references-commande"
                        value={ligne.reference}
                        onChange={(e) => onChangerReference(ligne, e.target.value)}
                        placeholder={vide ? 'Référence...' : ''}
                        className={`${CLASSE_CELLULE} font-mono ${referenceInconnue ? 'text-danger' : ''}`}
                      />
                    </td>
                    <td className={`${CLASSE_TD} px-2 truncate`}>
                      {produit ? (
                        <span className="text-text">{produit.designation}</span>
                      ) : referenceInconnue ? (
                        <span className="text-danger">Référence inconnue</span>
                      ) : null}
                    </td>
                    <td className={`${CLASSE_TD} px-2 text-text-muted truncate`}>{produit?.unite_mesure ?? ''}</td>
                    <td className={`${CLASSE_TD} px-2 text-right tabular-nums text-text-muted`}>
                      {produit ? produit.stock_actuel.toLocaleString('fr-FR') : ''}
                    </td>
                    <td className={CLASSE_TD}>
                      <input
                        {...attributsCellule(index, 'quantite')}
                        type="number"
                        min="1"
                        value={ligne.quantite}
                        onChange={(e) => majLigne(ligne.cle, { quantite: e.target.value })}
                        className={`${CLASSE_CELLULE} text-right`}
                      />
                    </td>
                    <td className={CLASSE_TD}>
                      <input
                        {...attributsCellule(index, 'prixUnitaire')}
                        type="number"
                        min="0"
                        step="0.01"
                        value={ligne.prixUnitaire}
                        onChange={(e) => majLigne(ligne.cle, { prixUnitaire: e.target.value })}
                        className={`${CLASSE_CELLULE} text-right`}
                      />
                    </td>
                    <td className={`${CLASSE_TD} px-2 text-right tabular-nums`}>{montant > 0 ? montant.toLocaleString('fr-FR') : ''}</td>
                    <td className={`${CLASSE_TD} text-center`}>
                      {!vide && (
                        <button type="button" onClick={() => retirerLigne(ligne.cle)} className="text-text-muted hover:text-danger" title="Retirer cette ligne">
                          <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmation === 'creer' && (
        <ConfirmationModal
          titre="Créer la commande ?"
          libelleConfirmer="Créer la commande"
          onConfirmer={creer}
          onFermer={() => setConfirmation(null)}
        >
          <p>Vérifie le récapitulatif avant de créer le bon de commande :</p>
          <ul className="text-xs flex flex-col gap-1 bg-muted rounded-lg px-3 py-2">
            <li>
              Fournisseur : <span className="font-semibold">{fournisseur?.nom}</span>
            </li>
            <li>
              Livraison : <span className="font-semibold">{entrepot?.nom}</span>
              {dateLivraison && <> le {new Date(dateLivraison).toLocaleDateString('fr-FR')}</>}
            </li>
            <li>
              {lignesRemplies.length} ligne(s), {quantiteTotale.toLocaleString('fr-FR')} unité(s),{' '}
              <span className="font-semibold">{montantXof(montantTotal)}</span>
            </li>
          </ul>
          {lignesSansPrix > 0 && (
            <p className="text-xs text-warn-deep">Attention : {lignesSansPrix} ligne(s) sans prix unitaire.</p>
          )}
          <p className="text-xs text-text-muted">La commande sera au statut « Fait ». Passe-la en « Envoyé » une fois transmise au fournisseur.</p>
        </ConfirmationModal>
      )}
      {confirmation === 'abandonner' && (
        <ConfirmationModal
          titre="Abandonner la saisie ?"
          libelleConfirmer="Abandonner"
          danger
          onConfirmer={revenirALaListe}
          onFermer={() => setConfirmation(null)}
        >
          <p>Les {lignesRemplies.length} ligne(s) saisie(s) seront perdues.</p>
        </ConfirmationModal>
      )}
      {ficheFournisseurOuverte && profil && (
        <NouveauFournisseurModal
          entrepriseId={profil.entreprise_id}
          onFermer={() => setFicheFournisseurOuverte(false)}
          onCree={onFournisseurCree}
        />
      )}
    </div>
  )
}
