import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTabs } from '../context/TabsContext'
import { messageErreur } from '../lib/erreurs'
import { peutGererCatalogue, peutSaisirReception } from '../lib/permissions'
import { dateSaisieVersISO, dateVersInput } from '../lib/dates'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getFournisseurs, getLocalisationsProduits } from '../lib/api/produits'
import { creerReception, type NouvelleLigneReception } from '../lib/api/receptions'
import type { Emplacement, Entrepot, Fournisseur, LocalisationProduit, ProduitAvecStock } from '../types/stock'
import { MOTIFS_NC, type MotifNonConformite } from '../lib/api/quarantaine'
import { NouveauFournisseurModal } from '../components/fournisseurs/NouveauFournisseurModal'
import {
  CLASSE_BOUTON_PRIMAIRE,
  CLASSE_BOUTON_SECONDAIRE,
  CLASSE_CHAMP_COMPACT,
  CLASSE_CHAMP_LECTURE,
  CLASSE_LABEL,
} from '../components/ui/styles'

/** Une ligne du tableau de saisie, telle que tapée (valeurs brutes des cellules). */
interface LigneSaisie {
  cle: string
  reference: string
  produitId: string
  emplacementId: string
  quantiteAttendue: string
  quantiteRecue: string
  prixUnitaire: string
  lot: string
  numeroSerie: string
  dateExpiration: string
  /** Quantité déclarée non conforme par l'opérateur : seule elle part en quarantaine. */
  quantiteNc: string
  motifNc: MotifNonConformite | ''
  constatNc: string
}

type ColonneSaisie =
  | 'reference'
  | 'quantiteAttendue'
  | 'quantiteRecue'
  | 'prixUnitaire'
  | 'emplacementId'
  | 'lot'
  | 'numeroSerie'
  | 'dateExpiration'
  | 'quantiteNc'
  | 'motifNc'
  | 'constatNc'

const CLASSE_CELLULE =
  'w-full h-8 px-2 bg-card text-xs text-text outline-none placeholder:text-text-muted ' +
  'focus:ring-2 focus:ring-inset focus:ring-accent/40 disabled:bg-muted disabled:cursor-not-allowed'
const CLASSE_TD = 'border border-border p-0'
const CLASSE_TH = 'border border-border bg-muted font-semibold h-8 px-2 text-left'

function ligneVide(): LigneSaisie {
  return {
    cle: Math.random().toString(36).slice(2),
    reference: '',
    produitId: '',
    emplacementId: '',
    quantiteAttendue: '',
    quantiteRecue: '',
    prixUnitaire: '',
    lot: '',
    numeroSerie: '',
    dateExpiration: '',
    quantiteNc: '',
    motifNc: '',
    constatNc: '',
  }
}

function estVide(l: LigneSaisie): boolean {
  return (
    !l.reference.trim() &&
    !l.quantiteAttendue &&
    !l.quantiteRecue &&
    !l.prixUnitaire &&
    !l.lot &&
    !l.numeroSerie &&
    !l.dateExpiration &&
    !l.quantiteNc &&
    !l.motifNc &&
    !l.constatNc
  )
}

/** Garde toujours une ligne vide en bas du tableau, prête à être remplie. */
function avecLigneVideFinale(lignes: LigneSaisie[]): LigneSaisie[] {
  const derniere = lignes[lignes.length - 1]
  return derniere && estVide(derniere) ? lignes : [...lignes, ligneVide()]
}

function quantiteRecueEffective(l: LigneSaisie): number {
  return Number(l.quantiteRecue || l.quantiteAttendue || 0)
}

/**
 * Quantité commandée envoyée à la base : à défaut de saisie (entrée sans bon
 * de commande), on reprend la quantité reçue. Sinon la validation traiterait
 * toute la quantité reçue comme un surplus et l'enverrait en Quarantaine.
 */
function quantiteCommandeeEffective(l: LigneSaisie): number {
  return Number(l.quantiteAttendue) || quantiteRecueEffective(l)
}

/**
 * Feuille de saisie d'une réception, ouverte dans son propre onglet : la
 * saisie en cours est conservée quand on passe sur un autre onglet.
 */
export function NouvelleReception() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ouvrirOnglet, fermerOnglet } = useTabs()
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [entrepotId, setEntrepotId] = useState('')
  const [fournisseurId, setFournisseurId] = useState('')
  const [ficheFournisseurOuverte, setFicheFournisseurOuverte] = useState(false)
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [notes, setNotes] = useState('')
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide()])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const tableauRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getEntrepots(), getFournisseurs(), getLocalisationsProduits(), getProduitsAvecStock()]).then(([e, f, l, p]) => {
      setProduits(p)
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

  const produitParReference = useMemo(
    () => new Map(produits.map((p) => [p.reference.trim().toLowerCase(), p])),
    [produits],
  )
  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])

  /** Localisation proposée : là où le produit est déjà stocké dans ce dépôt, sinon le premier emplacement hors Quarantaine. */
  function emplacementParDefaut(produitId: string, liste: Emplacement[] = emplacements): string {
    const existant = (localisations.get(produitId) ?? []).find(
      (loc) => loc.entrepot_id === entrepotId && liste.some((e) => e.id === loc.emplacement_id),
    )
    return existant?.emplacement_id ?? liste.find((e) => !e.est_quarantaine)?.id ?? ''
  }

  // Changement de dépôt : les localisations déjà choisies ne sont plus
  // valables, on repropose celle par défaut du nouveau dépôt.
  useEffect(() => {
    setLignes((prev) =>
      prev.map((l) =>
        l.produitId && !emplacements.some((e) => e.id === l.emplacementId)
          ? { ...l, emplacementId: emplacementParDefaut(l.produitId, emplacements) }
          : l,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emplacements])

  function majLigne(cle: string, champs: Partial<LigneSaisie>) {
    setLignes((prev) => avecLigneVideFinale(prev.map((l) => (l.cle === cle ? { ...l, ...champs } : l))))
  }

  function onChangerReference(ligne: LigneSaisie, texte: string) {
    const produit = produitParReference.get(texte.trim().toLowerCase())
    if (!produit || produit.id === ligne.produitId) {
      majLigne(ligne.cle, { reference: texte, produitId: produit?.id ?? '' })
      return
    }
    majLigne(ligne.cle, {
      reference: texte,
      produitId: produit.id,
      emplacementId: emplacementParDefaut(produit.id),
      prixUnitaire: ligne.prixUnitaire || (produit.prix_moyen_pondere > 0 ? String(produit.prix_moyen_pondere) : ''),
      lot: produit.gere_lot ? ligne.lot : '',
      numeroSerie: produit.gere_numero_serie ? ligne.numeroSerie : '',
      dateExpiration: produit.gere_expiration ? ligne.dateExpiration : '',
    })
  }

  function retirerLigne(cle: string) {
    setLignes((prev) => avecLigneVideFinale(prev.filter((l) => l.cle !== cle)))
  }

  // Comme dans un tableur : Entrée descend à la cellule du dessous.
  function onKeyDownTableau(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    const cible = e.target as HTMLElement
    const index = cible.dataset.ligne
    const colonne = cible.dataset.colonne
    if (index == null || !colonne) return
    e.preventDefault()
    const suivante = tableauRef.current?.querySelector<HTMLElement>(
      `[data-ligne="${Number(index) + 1}"][data-colonne="${colonne}"]`,
    )
    suivante?.focus()
  }

  function attributsCellule(index: number, colonne: ColonneSaisie) {
    return { 'data-ligne': index, 'data-colonne': colonne }
  }

  function avertissementEmplacement(ligne: LigneSaisie): string | null {
    if (!ligne.produitId || !ligne.emplacementId) return null
    const existant = (localisations.get(ligne.produitId) ?? []).find(
      (loc) => loc.entrepot_id === entrepotId && loc.emplacement_id !== ligne.emplacementId,
    )
    if (!existant) return null
    return `Ce produit est déjà stocké à l'emplacement ${existant.emplacement_code} dans ce dépôt.`
  }

  function onFournisseurCree(f: Fournisseur) {
    setFournisseurs((prev) => [...prev, f].sort((a, b) => a.nom.localeCompare(b.nom)))
    setFournisseurId(f.id)
    setFicheFournisseurOuverte(false)
  }

  /** Retour à la liste des réceptions, en fermant cet onglet. */
  function revenirALaListe() {
    ouvrirOnglet('entrees', 'Entrées')
    fermerOnglet('nouvelle-reception')
  }

  const lignesRemplies = lignes.filter((l) => !estVide(l))
  const quantiteTotale = lignesRemplies.reduce((total, l) => total + quantiteRecueEffective(l), 0)
  const valeurTotale = lignesRemplies.reduce(
    (total, l) => total + quantiteRecueEffective(l) * Number(l.prixUnitaire || 0),
    0,
  )

  function annuler() {
    if (lignesRemplies.length > 0 && !confirm('Abandonner la saisie de cette réception ?')) return
    revenirALaListe()
  }

  function erreurDeSaisie(): string | null {
    if (!entrepotId) return 'Choisis un dépôt.'
    if (lignesRemplies.length === 0) return 'Saisis au moins une ligne.'
    for (const l of lignesRemplies) {
      const numero = lignes.indexOf(l) + 1
      if (!l.produitId) return `Ligne ${numero} : référence inconnue.`
      if (quantiteCommandeeEffective(l) <= 0) return `Ligne ${numero} : saisis la quantité reçue.`
      if (!l.emplacementId) return `Ligne ${numero} : localisation manquante.`
      // Sans lot ni date, la sortie "premier périmé, premier sorti" est impossible (même contrôle côté base).
      if (produitParId.get(l.produitId)?.gere_expiration && !l.dateExpiration) {
        return `Ligne ${numero} : la date d'expiration est obligatoire pour ce produit.`
      }
      if (l.dateExpiration && !l.lot.trim() && !l.numeroSerie.trim()) {
        return `Ligne ${numero} : le numéro de lot (ou de série) est obligatoire avec une date d'expiration.`
      }
      // La mise en quarantaine est une décision de l'opérateur : quantité et motif explicites.
      const quantiteNc = Number(l.quantiteNc || 0)
      if (!Number.isInteger(quantiteNc) || quantiteNc < 0 || quantiteNc > quantiteRecueEffective(l)) {
        return `Ligne ${numero} : la quantité non conforme doit être comprise entre 0 et la quantité reçue.`
      }
      if (quantiteNc > 0 && !l.motifNc) return `Ligne ${numero} : choisis le motif de la non-conformité.`
      if (quantiteNc === 0 && (l.motifNc || l.constatNc.trim())) {
        return `Ligne ${numero} : indique la quantité non conforme (ou retire le motif).`
      }
    }
    return null
  }

  async function onEnregistrer() {
    const probleme = erreurDeSaisie()
    if (probleme) {
      setErreur(probleme)
      return
    }
    setErreur(null)
    setEnvoi(true)
    try {
      const lignesReception: NouvelleLigneReception[] = lignesRemplies.map((l) => ({
        produitId: l.produitId,
        emplacementId: l.emplacementId,
        quantiteAttendue: quantiteCommandeeEffective(l),
        quantiteRecue: quantiteRecueEffective(l),
        lot: l.lot || null,
        numeroSerie: l.numeroSerie || null,
        dateExpiration: l.dateExpiration || null,
        prixUnitaire: Number(l.prixUnitaire || 0),
        quantiteNonConforme: Number(l.quantiteNc || 0),
        motifNonConformite: l.motifNc || null,
        constatNonConformite: l.constatNc.trim() || null,
      }))
      await creerReception({
        entrepotId,
        fournisseurId: fournisseurId || null,
        // Entrée manuelle : produits non commandés. Les commandes fournisseurs auront leur propre écran (PO).
        numeroPo: null,
        notes: notes.trim() || null,
        dateMouvement: dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
        lignes: lignesReception,
      })
      revenirALaListe()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 min-h-0 overflow-y-auto">
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-x-6 gap-y-2 bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Dépôt</span>
              <select value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)} className={CLASSE_CHAMP_COMPACT}>
                {entrepots.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Fournisseur</span>
              <div className="flex gap-1">
                <select
                  value={fournisseurId}
                  onChange={(e) => setFournisseurId(e.target.value)}
                  className={CLASSE_CHAMP_COMPACT}
                >
                  <option value="">Aucun</option>
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
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Opérateur</span>
              <div className={CLASSE_CHAMP_LECTURE}>{profil?.nom_complet ?? '—'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Bon de réception</span>
              <div className={`${CLASSE_CHAMP_LECTURE} text-text-muted`}>Généré à l'enregistrement</div>
            </div>
            <label className="flex flex-col gap-1">
              <span className={CLASSE_LABEL}>Date du mouvement</span>
              <input
                type="date"
                value={dateMouvement}
                max={dateVersInput(new Date())}
                onChange={(e) => setDateMouvement(e.target.value)}
                className={CLASSE_CHAMP_COMPACT}
              />
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
          {/* Barre d'actions juste au-dessus du tableau : toujours visible, quelle que soit la hauteur de l'écran. */}
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Lignes de réception</span>
              <span className="text-xs text-text-muted">
                <span className="font-semibold text-text">{lignesRemplies.length}</span> ligne(s) · Quantité totale{' '}
                <span className="font-semibold text-text">{quantiteTotale.toLocaleString('fr-FR')}</span> · Valeur{' '}
                <span className="font-semibold text-text">{valeurTotale.toLocaleString('fr-FR')} XOF</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={annuler} className={CLASSE_BOUTON_SECONDAIRE}>
                Annuler
              </button>
              <button type="button" onClick={onEnregistrer} disabled={envoi} className={CLASSE_BOUTON_PRIMAIRE}>
                {envoi ? 'Enregistrement...' : 'Enregistrer la réception'}
              </button>
            </div>
          </div>
          {erreur && (
            <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>
          )}
          <datalist id="references-reception">
            {produits.map((p) => (
              <option key={p.id} value={p.reference} label={p.designation} />
            ))}
          </datalist>
          <div ref={tableauRef} onKeyDown={onKeyDownTableau} className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[1360px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 text-[11px] text-text-muted uppercase tracking-wide">
                <tr>
                  <th className={`${CLASSE_TH} w-9 text-center`}>#</th>
                  <th className={`${CLASSE_TH} w-36`}>Référence</th>
                  <th className={CLASSE_TH}>Désignation</th>
                  <th className={`${CLASSE_TH} w-24 text-right`}>Quantité</th>
                  <th className={`${CLASSE_TH} w-24 text-right`}>Prix unit.</th>
                  <th className={`${CLASSE_TH} w-36`}>Localisation</th>
                  <th className={`${CLASSE_TH} w-28`}>Lot</th>
                  <th className={`${CLASSE_TH} w-28`}>N° série</th>
                  <th className={`${CLASSE_TH} w-32`}>Expiration</th>
                  <th
                    className={`${CLASSE_TH} w-20 text-right`}
                    title="Quantité non conforme (endommagée, avariée...) : seule cette quantité part en quarantaine, avec un dossier de non-conformité"
                  >
                    Qté NC
                  </th>
                  <th className={`${CLASSE_TH} w-44`}>Motif NC</th>
                  <th className={`${CLASSE_TH} w-56`}>Constat</th>
                  <th className={`${CLASSE_TH} w-9`} />
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, index) => {
                  const produit = ligne.produitId ? produitParId.get(ligne.produitId) : undefined
                  const referenceInconnue = ligne.reference.trim() !== '' && !produit
                  const avertissement = avertissementEmplacement(ligne)
                  const vide = estVide(ligne)
                  return (
                    <tr key={ligne.cle} className={Number(ligne.quantiteNc || 0) > 0 ? 'bg-danger-soft/40' : ''}>
                      <td className={`${CLASSE_TD} text-center text-text-muted bg-muted`}>{index + 1}</td>
                      <td className={CLASSE_TD}>
                        <input
                          {...attributsCellule(index, 'reference')}
                          list="references-reception"
                          value={ligne.reference}
                          onChange={(e) => onChangerReference(ligne, e.target.value)}
                          placeholder={vide ? 'Référence...' : ''}
                          className={`${CLASSE_CELLULE} font-mono ${referenceInconnue ? 'text-danger' : ''}`}
                        />
                      </td>
                      <td className={`${CLASSE_TD} px-2`}>
                        {produit ? (
                          <span className="text-text">{produit.designation}</span>
                        ) : referenceInconnue ? (
                          <span className="text-danger">Référence inconnue</span>
                        ) : null}
                      </td>
                      <td className={CLASSE_TD}>
                        <input
                          {...attributsCellule(index, 'quantiteRecue')}
                          type="number"
                          min="0"
                          value={ligne.quantiteRecue}
                          onChange={(e) => majLigne(ligne.cle, { quantiteRecue: e.target.value })}
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
                      <td className={CLASSE_TD}>
                        <div className="flex items-center">
                          <select
                            {...attributsCellule(index, 'emplacementId')}
                            value={ligne.emplacementId}
                            onChange={(e) => majLigne(ligne.cle, { emplacementId: e.target.value })}
                            disabled={!produit}
                            className={CLASSE_CELLULE}
                          >
                            <option value="">—</option>
                            {emplacements.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.code}
                                {e.est_quarantaine ? ' (Quarantaine)' : ''}
                              </option>
                            ))}
                          </select>
                          {avertissement && (
                            <span title={avertissement} className="shrink-0 px-1 text-warn-deep">
                              <AlertTriangle size={13} strokeWidth={1.75} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={CLASSE_TD}>
                        <input
                          {...attributsCellule(index, 'lot')}
                          value={ligne.lot}
                          onChange={(e) => majLigne(ligne.cle, { lot: e.target.value })}
                          className={CLASSE_CELLULE}
                        />
                      </td>
                      <td className={CLASSE_TD}>
                        <input
                          {...attributsCellule(index, 'numeroSerie')}
                          value={ligne.numeroSerie}
                          onChange={(e) => majLigne(ligne.cle, { numeroSerie: e.target.value })}
                          className={CLASSE_CELLULE}
                        />
                      </td>
                      <td className={CLASSE_TD}>
                        <input
                          {...attributsCellule(index, 'dateExpiration')}
                          type="date"
                          value={ligne.dateExpiration}
                          onChange={(e) => majLigne(ligne.cle, { dateExpiration: e.target.value })}
                          className={CLASSE_CELLULE}
                        />
                      </td>
                      <td className={CLASSE_TD}>
                        <input
                          {...attributsCellule(index, 'quantiteNc')}
                          type="number"
                          min="0"
                          value={ligne.quantiteNc}
                          onChange={(e) => majLigne(ligne.cle, { quantiteNc: e.target.value })}
                          disabled={!produit}
                          placeholder="0"
                          className={`${CLASSE_CELLULE} text-right`}
                        />
                      </td>
                      <td className={CLASSE_TD}>
                        <select
                          {...attributsCellule(index, 'motifNc')}
                          value={ligne.motifNc}
                          onChange={(e) => majLigne(ligne.cle, { motifNc: e.target.value as MotifNonConformite | '' })}
                          disabled={!produit}
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
                          {...attributsCellule(index, 'constatNc')}
                          value={ligne.constatNc}
                          onChange={(e) => majLigne(ligne.cle, { constatNc: e.target.value })}
                          disabled={!produit}
                          placeholder={Number(ligne.quantiteNc || 0) > 0 ? 'Ex. 4 cartons écrasés' : ''}
                          className={CLASSE_CELLULE}
                        />
                      </td>
                      <td className={`${CLASSE_TD} text-center`}>
                        {!vide && (
                          <button
                            type="button"
                            onClick={() => retirerLigne(ligne.cle)}
                            className="text-text-muted hover:text-danger"
                            title="Retirer cette ligne"
                          >
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
