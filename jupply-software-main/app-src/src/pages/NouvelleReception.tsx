import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { AlertTriangle, Download, Plus, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaisieEnCours, useTabs } from '../context/TabsContext'
import { messageErreur } from '../lib/erreurs'
import { peutGererCatalogue, peutSaisirReception } from '../lib/permissions'
import { dateSaisieVersISO, dateVersInput } from '../lib/dates'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getFournisseurs, getLocalisationsProduits } from '../lib/api/produits'
import { creerReception, type NouvelleLigneReception } from '../lib/api/receptions'
import { lireFichierEntrees, telechargerModeleEntrees, type LigneImportee } from '../lib/import/entrees'
import type { Emplacement, Entrepot, Fournisseur, LocalisationProduit, ProduitAvecStock } from '../types/stock'
import { NouveauFournisseurModal } from '../components/fournisseurs/NouveauFournisseurModal'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { CLASSE_BOUTON_PRIMAIRE, CLASSE_BOUTON_SECONDAIRE, CLASSE_CHAMP_COMPACT, CLASSE_LABEL } from '../components/ui/styles'

/** Une ligne du tableau de saisie, telle que tapée (valeurs brutes des cellules). */
interface LigneSaisie {
  cle: string
  reference: string
  produitId: string
  /** Dépôt de la ligne : le stock entre dans ce dépôt, à la localisation choisie. */
  entrepotId: string
  emplacementId: string
  quantite: string
  prixUnitaire: string
  lot: string
  numeroSerie: string
  dateExpiration: string
  /** Problème relevé à l'import (dépôt ou localisation inconnus...), effacé dès que la ligne est corrigée. */
  noteImport: string
}

type ColonneSaisie = 'reference' | 'quantite' | 'prixUnitaire' | 'entrepotId' | 'emplacementId' | 'lot' | 'numeroSerie' | 'dateExpiration'

const CLASSE_CELLULE =
  'w-full h-8 px-2 bg-card text-xs text-text outline-none placeholder:text-text-muted ' +
  'focus:ring-2 focus:ring-inset focus:ring-accent/40 disabled:bg-muted disabled:cursor-not-allowed'
const CLASSE_TD = 'border border-border p-0'
const CLASSE_TD_ERREUR = 'border border-border p-0 bg-danger-soft/60'
const CLASSE_TH = 'border border-border bg-muted font-semibold h-8 px-2 text-left'

function ligneVide(entrepotId = ''): LigneSaisie {
  return {
    cle: Math.random().toString(36).slice(2),
    reference: '',
    produitId: '',
    entrepotId,
    emplacementId: '',
    quantite: '',
    prixUnitaire: '',
    lot: '',
    numeroSerie: '',
    dateExpiration: '',
    noteImport: '',
  }
}

function estVide(l: LigneSaisie): boolean {
  return !l.reference.trim() && !l.quantite && !l.prixUnitaire && !l.lot && !l.numeroSerie && !l.dateExpiration
}

/** Doublon : même produit, même dépôt, même localisation et même lot. */
function cleDoublon(l: LigneSaisie): string | null {
  if (!l.produitId || !l.entrepotId || !l.emplacementId) return null
  return [l.produitId, l.entrepotId, l.emplacementId, l.lot.trim().toLowerCase()].join('|')
}

/** Comparaison sans accents ni majuscules (noms de dépôts et codes saisis dans un fichier). */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Feuille de saisie d'une entrée, ouverte dans son propre onglet : la saisie
 * en cours est conservée quand on passe sur un autre onglet. Chaque ligne a
 * son dépôt : une même entrée (un seul numéro) peut alimenter plusieurs dépôts.
 */
export function NouvelleReception() {
  const { profil, entrepotsAssignes } = useAuth()
  const { ouvrirOnglet, fermerOnglet } = useTabs()
  const [produits, setProduits] = useState<ProduitAvecStock[]>([])
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [localisations, setLocalisations] = useState<Map<string, LocalisationProduit[]>>(new Map())
  const [fournisseurId, setFournisseurId] = useState('')
  const [ficheFournisseurOuverte, setFicheFournisseurOuverte] = useState(false)
  const [dateMouvement, setDateMouvement] = useState(() => dateVersInput(new Date()))
  const [avecNote, setAvecNote] = useState(false)
  const [notes, setNotes] = useState('')
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide()])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resumeImport, setResumeImport] = useState<string | null>(null)
  const [abandonAConfirmer, setAbandonAConfirmer] = useState(false)
  const tableauRef = useRef<HTMLDivElement>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getEntrepots(), getFournisseurs(), getLocalisationsProduits(), getProduitsAvecStock()])
      .then(async ([e, f, l, p]) => {
        setProduits(p)
        const entrepotsAutorises = e.filter((ent) => peutSaisirReception(profil?.role, ent.id, entrepotsAssignes))
        setEntrepots(entrepotsAutorises)
        setFournisseurs(f)
        setLocalisations(l)
        // Localisations de tous les dépôts autorisés, la Quarantaine exclue (une mise en quarantaine se déclare à part).
        const parDepot = await Promise.all(entrepotsAutorises.map((ent) => getEmplacements(ent.id)))
        setEmplacements(parDepot.flat().filter((em) => !em.est_quarantaine))
        const premier = entrepotsAutorises[0]?.id ?? ''
        setLignes((prev) => prev.map((ligne) => (ligne.entrepotId ? ligne : { ...ligne, entrepotId: premier })))
      })
      .catch((e) => setErreur(messageErreur(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const produitParReference = useMemo(() => new Map(produits.map((p) => [p.reference.trim().toLowerCase(), p])), [produits])
  const produitParId = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits])
  const emplacementsDe = (entrepotId: string) => emplacements.filter((e) => e.entrepot_id === entrepotId)

  /** Localisation proposée : là où le produit est déjà rangé dans ce dépôt, sinon le premier emplacement du dépôt. */
  function emplacementParDefaut(produitId: string, entrepotId: string): string {
    const liste = emplacementsDe(entrepotId)
    const existant = (localisations.get(produitId) ?? []).find(
      (loc) => loc.entrepot_id === entrepotId && liste.some((e) => e.id === loc.emplacement_id),
    )
    return existant?.emplacement_id ?? liste[0]?.id ?? ''
  }

  /** Garde toujours une ligne vide en bas, avec le dépôt de la ligne précédente (saisie plus rapide). */
  function avecLigneVideFinale(liste: LigneSaisie[]): LigneSaisie[] {
    const derniere = liste[liste.length - 1]
    if (derniere && estVide(derniere)) return liste
    return [...liste, ligneVide(derniere?.entrepotId || entrepots[0]?.id || '')]
  }

  function majLigne(cle: string, champs: Partial<LigneSaisie>) {
    setLignes((prev) => avecLigneVideFinale(prev.map((l) => (l.cle === cle ? { ...l, ...champs, noteImport: '' } : l))))
  }

  function focusCellule(index: number, colonne: ColonneSaisie) {
    requestAnimationFrame(() =>
      tableauRef.current?.querySelector<HTMLElement>(`[data-ligne="${index}"][data-colonne="${colonne}"]`)?.focus(),
    )
  }

  function onChangerReference(ligne: LigneSaisie, texte: string) {
    const produit = produitParReference.get(texte.trim().toLowerCase())
    if (!produit || produit.id === ligne.produitId) {
      majLigne(ligne.cle, { reference: texte, produitId: produit?.id ?? '' })
      return
    }
    const modifiee: LigneSaisie = {
      ...ligne,
      reference: texte,
      produitId: produit.id,
      emplacementId: emplacementParDefaut(produit.id, ligne.entrepotId),
      prixUnitaire: ligne.prixUnitaire || (produit.prix_moyen_pondere > 0 ? String(produit.prix_moyen_pondere) : ''),
    }
    // Doublon refusé : la ligne existante reçoit le curseur, on y ajuste la quantité.
    const cle = cleDoublon(modifiee)
    const index = cle ? lignes.findIndex((l) => l.cle !== ligne.cle && cleDoublon(l) === cle) : -1
    if (index >= 0) {
      setErreur(
        `${produit.reference} est déjà saisi ligne ${index + 1} (même dépôt, localisation et lot). Modifie la quantité de cette ligne, ou change le lot ou la localisation.`,
      )
      majLigne(ligne.cle, { reference: '', produitId: '' })
      focusCellule(index, 'quantite')
      return
    }
    setErreur(null)
    majLigne(ligne.cle, modifiee)
  }

  function onChangerDepot(ligne: LigneSaisie, entrepotId: string) {
    majLigne(ligne.cle, {
      entrepotId,
      emplacementId: ligne.produitId ? emplacementParDefaut(ligne.produitId, entrepotId) : '',
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
    const colonne = cible.dataset.colonne as ColonneSaisie | undefined
    if (index == null || !colonne) return
    e.preventDefault()
    focusCellule(Number(index) + 1, colonne)
  }

  function attributsCellule(index: number, colonne: ColonneSaisie) {
    return { 'data-ligne': index, 'data-colonne': colonne }
  }

  function avertissementEmplacement(ligne: LigneSaisie): string | null {
    if (!ligne.produitId || !ligne.emplacementId) return null
    const existant = (localisations.get(ligne.produitId) ?? []).find(
      (loc) => loc.entrepot_id === ligne.entrepotId && loc.emplacement_id !== ligne.emplacementId,
    )
    if (!existant) return null
    return `Ce produit est déjà stocké à l'emplacement ${existant.emplacement_code} dans ce dépôt.`
  }

  function onFournisseurCree(f: Fournisseur) {
    setFournisseurs((prev) => [...prev, f].sort((a, b) => a.nom.localeCompare(b.nom)))
    setFournisseurId(f.id)
    setFicheFournisseurOuverte(false)
  }

  const lignesRemplies = lignes.filter((l) => !estVide(l))
  const saisieEnCours = lignesRemplies.length > 0 || notes.trim() !== ''
  useSaisieEnCours('nouvelle-reception', saisieEnCours)

  const quantiteTotale = lignesRemplies.reduce((total, l) => total + Number(l.quantite || 0), 0)
  const valeurTotale = lignesRemplies.reduce((total, l) => total + Number(l.quantite || 0) * Number(l.prixUnitaire || 0), 0)

  // Première ligne identique pour chaque doublon (même produit, dépôt, localisation, lot).
  const doublonDe = useMemo(() => {
    const vues = new Map<string, number>()
    const resultat = new Map<string, number>()
    lignes.forEach((l, i) => {
      const cle = cleDoublon(l)
      if (!cle) return
      const premiere = vues.get(cle)
      if (premiere == null) vues.set(cle, i)
      else resultat.set(l.cle, premiere)
    })
    return resultat
  }, [lignes])

  /** Retour à la liste des entrées, en fermant cet onglet. */
  function revenirALaListe() {
    ouvrirOnglet('entrees', 'Entrées')
    fermerOnglet('nouvelle-reception')
  }

  function annuler() {
    if (saisieEnCours) setAbandonAConfirmer(true)
    else revenirALaListe()
  }

  function erreurDeSaisie(): string | null {
    if (lignesRemplies.length === 0) return 'Saisis au moins une ligne.'
    for (const l of lignesRemplies) {
      const numero = lignes.indexOf(l) + 1
      if (!l.produitId) return `Ligne ${numero} : référence inconnue.`
      const quantite = Number(l.quantite)
      if (!Number.isInteger(quantite) || quantite <= 0) return `Ligne ${numero} : saisis la quantité reçue (nombre entier).`
      if (!l.entrepotId) return `Ligne ${numero} : choisis le dépôt.`
      if (!l.emplacementId) return `Ligne ${numero} : choisis la localisation.`
      const premiere = doublonDe.get(l.cle)
      if (premiere != null) return `Ligne ${numero} : déjà saisi ligne ${premiere + 1} (même dépôt, localisation et lot).`
      if (l.dateExpiration && !/^\d{4}-\d{2}-\d{2}$/.test(l.dateExpiration)) return `Ligne ${numero} : date d'expiration illisible.`
      // Sans lot ni date, la sortie "premier périmé, premier sorti" est impossible (même contrôle côté base).
      if (produitParId.get(l.produitId)?.gere_expiration && !l.dateExpiration) {
        return `Ligne ${numero} : la date d'expiration est obligatoire pour ce produit.`
      }
      if (l.dateExpiration && !l.lot.trim() && !l.numeroSerie.trim()) {
        return `Ligne ${numero} : le numéro de lot (ou de série) est obligatoire avec une date d'expiration.`
      }
    }
    if (avecNote && !notes.trim()) return 'Écris la note, ou décoche « Ajouter une note ».'
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
        // Entrée sans commande : la quantité attendue est celle reçue (pas d'écart).
        quantiteAttendue: Number(l.quantite),
        quantiteRecue: Number(l.quantite),
        lot: l.lot.trim() || null,
        numeroSerie: l.numeroSerie.trim() || null,
        dateExpiration: l.dateExpiration || null,
        prixUnitaire: Number(l.prixUnitaire || 0),
        // Une non-conformité se déclare depuis l'écran Quarantaine.
        quantiteNonConforme: 0,
        motifNonConformite: null,
        constatNonConformite: null,
      }))
      await creerReception({
        // Dépôt principal = celui de la première ligne ; chaque ligne entre dans son propre dépôt.
        entrepotId: lignesRemplies[0].entrepotId,
        fournisseurId: fournisseurId || null,
        numeroPo: null,
        notes: avecNote ? notes.trim() || null : null,
        dateMouvement: dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
        lignes: lignesReception,
      })
      revenirALaListe()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  // --- Import d'une liste ---------------------------------------------------

  function depuisImport(li: LigneImportee): LigneSaisie {
    const ligne = ligneVide()
    const problemes: string[] = []
    const produit = produitParReference.get(li.reference.trim().toLowerCase())
    const depot = entrepots.find((e) => normaliser(e.nom) === normaliser(li.depot))
    if (!li.depot) problemes.push('dépôt manquant')
    else if (!depot) problemes.push(`dépôt « ${li.depot} » introuvable ou non autorisé`)
    const emplacement = depot
      ? emplacementsDe(depot.id).find((e) => normaliser(e.code) === normaliser(li.localisation))
      : undefined
    if (depot && !li.localisation) problemes.push('localisation manquante')
    else if (depot && !emplacement) problemes.push(`localisation « ${li.localisation} » introuvable dans ${depot.nom}`)
    return {
      ...ligne,
      reference: li.reference,
      produitId: produit?.id ?? '',
      entrepotId: depot?.id ?? '',
      emplacementId: emplacement?.id ?? (produit && depot ? emplacementParDefaut(produit.id, depot.id) : ''),
      quantite: li.quantite.replace(',', '.'),
      prixUnitaire: li.prixUnitaire || (produit && produit.prix_moyen_pondere > 0 ? String(produit.prix_moyen_pondere) : ''),
      lot: li.lot,
      numeroSerie: li.numeroSerie,
      dateExpiration: li.dateExpiration,
      noteImport: problemes.length > 0 ? `Ligne ${li.numeroFichier} du fichier : ${problemes.join(', ')}.` : '',
    }
  }

  async function onFichierChoisi(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    setResumeImport(null)
    try {
      const importees = (await lireFichierEntrees(fichier)).map(depuisImport)
      // Les lignes importées s'ajoutent à celles déjà saisies.
      const nouvelles = avecLigneVideFinale([...lignesRemplies, ...importees])
      setLignes(nouvelles)
      const aCorriger = importees.filter((l) => l.noteImport || !l.produitId || !l.quantite || Number(l.quantite) <= 0).length
      setResumeImport(
        `${importees.length} ligne(s) importée(s)` +
          (aCorriger > 0 ? `, ${aCorriger} à corriger (en rouge).` : '. Vérifie puis clique sur « Enregistrer ».'),
      )
    } catch (err) {
      setErreur(messageErreur(err))
    }
  }

  function telechargerModele() {
    const depots = entrepots.map((ent) => ({ nom: ent.nom, localisations: emplacementsDe(ent.id).map((em) => em.code) }))
    telechargerModeleEntrees(depots).catch((err) => setErreur(messageErreur(err)))
  }

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] min-h-0">
      {/* En-tête sur une ligne : fournisseur, date, note ; actions et import à droite */}
      <div className="shrink-0 flex items-start gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Fournisseur</span>
          <div className="flex gap-1">
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={`${CLASSE_CHAMP_COMPACT} w-[200px]`}>
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
        <label className="flex flex-col gap-1">
          <span className={CLASSE_LABEL}>Date du mouvement</span>
          <input
            type="date"
            value={dateMouvement}
            max={dateVersInput(new Date())}
            onChange={(e) => setDateMouvement(e.target.value)}
            className={`${CLASSE_CHAMP_COMPACT} w-[150px]`}
          />
        </label>
        <label className="self-end h-[30px] flex items-center gap-1.5 text-xs text-text cursor-pointer select-none">
          <input type="checkbox" checked={avecNote} onChange={(e) => setAvecNote(e.target.checked)} className="accent-[var(--accent)]" />
          Ajouter une note
        </label>

        <div className="ml-auto flex items-start gap-2">
          <button type="button" onClick={annuler} className={CLASSE_BOUTON_SECONDAIRE}>
            Annuler
          </button>
          <button type="button" onClick={onEnregistrer} disabled={envoi} className={CLASSE_BOUTON_PRIMAIRE}>
            {envoi ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => fichierRef.current?.click()}
              className={`${CLASSE_BOUTON_SECONDAIRE} inline-flex items-center gap-1.5`}
              title="Remplir le tableau à partir d'un fichier Excel ou CSV (modèle ci-dessous)"
            >
              <Upload size={14} strokeWidth={1.75} /> Import
            </button>
            <button
              type="button"
              onClick={telechargerModele}
              className="inline-flex items-center gap-1 text-[11px] text-info-deep hover:underline"
              title="Fichier Excel à remplir, avec la liste de tes dépôts et localisations"
            >
              <Download size={11} strokeWidth={1.75} /> Télécharger le modèle
            </button>
          </div>
          <input ref={fichierRef} type="file" accept=".xlsx,.csv" onChange={onFichierChoisi} className="hidden" />
        </div>
      </div>

      {avecNote && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Note sur cette entrée (ex. livraison incomplète, bon de livraison n°...)"
          className="shrink-0 w-full max-w-2xl bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none resize-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      )}

      <div className="shrink-0 flex items-baseline gap-3 flex-wrap text-xs text-text-muted">
        <span>
          <span className="font-semibold text-text">{lignesRemplies.length}</span> ligne(s) · Quantité totale{' '}
          <span className="font-semibold text-text">{quantiteTotale.toLocaleString('fr-FR')}</span> · Valeur{' '}
          <span className="font-semibold text-text">{valeurTotale.toLocaleString('fr-FR')} XOF</span>
        </span>
        {resumeImport && <span className="text-info-deep font-medium">{resumeImport}</span>}
      </div>
      {erreur && <div className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2">{erreur}</div>}

      <datalist id="references-reception">
        {produits.map((p) => (
          <option key={p.id} value={p.reference} label={p.designation} />
        ))}
      </datalist>
      <div ref={tableauRef} onKeyDown={onKeyDownTableau} className="flex-1 min-h-0 overflow-auto defilement-fin rounded-lg border border-border">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: '12%' }} />
            <col />
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: 32 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 text-[11px] text-text-muted uppercase tracking-wide">
            <tr>
              <th className={`${CLASSE_TH} text-center`}>#</th>
              <th className={CLASSE_TH}>Référence</th>
              <th className={CLASSE_TH}>Désignation</th>
              <th className={`${CLASSE_TH} text-right`}>Quantité</th>
              <th className={`${CLASSE_TH} text-right`}>Prix unit.</th>
              <th className={CLASSE_TH}>Dépôt</th>
              <th className={CLASSE_TH}>Localisation</th>
              <th className={CLASSE_TH}>Lot</th>
              <th className={CLASSE_TH}>N° série</th>
              <th className={CLASSE_TH}>Expiration</th>
              <th className={CLASSE_TH} />
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, index) => {
              const produit = ligne.produitId ? produitParId.get(ligne.produitId) : undefined
              const vide = estVide(ligne)
              const referenceInconnue = ligne.reference.trim() !== '' && !produit
              const avertissement = avertissementEmplacement(ligne)
              const premiereIdentique = doublonDe.get(ligne.cle)
              const quantiteInvalide = !vide && ligne.quantite !== '' && !(Number.isInteger(Number(ligne.quantite)) && Number(ligne.quantite) > 0)
              const quantiteManquante = !vide && produit != null && ligne.quantite === ''
              const depotManquant = !vide && !ligne.entrepotId
              const localisationManquante = !vide && produit != null && !ligne.emplacementId
              const dateIllisible = ligne.dateExpiration !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(ligne.dateExpiration)
              const enErreur = Boolean(ligne.noteImport) || premiereIdentique != null
              const messageLigne =
                premiereIdentique != null ? `Déjà saisi ligne ${premiereIdentique + 1} (même dépôt, localisation et lot).` : ligne.noteImport
              return (
                <tr key={ligne.cle} className={enErreur ? 'bg-danger-soft/40' : ''} title={messageLigne || undefined}>
                  <td className={`${CLASSE_TD} text-center bg-muted ${enErreur ? 'text-danger-deep font-bold' : 'text-text-muted'}`}>
                    {enErreur ? <AlertTriangle size={12} strokeWidth={2} className="inline" /> : index + 1}
                  </td>
                  <td className={referenceInconnue ? CLASSE_TD_ERREUR : CLASSE_TD}>
                    <input
                      {...attributsCellule(index, 'reference')}
                      list="references-reception"
                      value={ligne.reference}
                      onChange={(e) => onChangerReference(ligne, e.target.value)}
                      placeholder={vide ? 'Référence...' : ''}
                      className={`${CLASSE_CELLULE} font-mono ${referenceInconnue ? 'text-danger bg-transparent' : ''}`}
                    />
                  </td>
                  <td className={`${CLASSE_TD} px-2 truncate`} title={produit?.designation}>
                    {produit ? (
                      <span className="text-text">{produit.designation}</span>
                    ) : referenceInconnue ? (
                      <span className="text-danger">Référence inconnue</span>
                    ) : null}
                  </td>
                  <td className={quantiteInvalide || quantiteManquante ? CLASSE_TD_ERREUR : CLASSE_TD}>
                    <input
                      {...attributsCellule(index, 'quantite')}
                      type="number"
                      min="1"
                      step="1"
                      value={ligne.quantite}
                      onChange={(e) => majLigne(ligne.cle, { quantite: e.target.value })}
                      className={`${CLASSE_CELLULE} text-right ${quantiteInvalide || quantiteManquante ? 'bg-transparent' : ''}`}
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
                  <td className={depotManquant ? CLASSE_TD_ERREUR : CLASSE_TD}>
                    <select
                      {...attributsCellule(index, 'entrepotId')}
                      value={ligne.entrepotId}
                      onChange={(e) => onChangerDepot(ligne, e.target.value)}
                      className={`${CLASSE_CELLULE} ${depotManquant ? 'bg-transparent' : ''}`}
                    >
                      <option value="">—</option>
                      {entrepots.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={localisationManquante || premiereIdentique != null ? CLASSE_TD_ERREUR : CLASSE_TD}>
                    <div className="flex items-center">
                      <select
                        {...attributsCellule(index, 'emplacementId')}
                        value={ligne.emplacementId}
                        onChange={(e) => majLigne(ligne.cle, { emplacementId: e.target.value })}
                        disabled={!ligne.entrepotId}
                        className={`${CLASSE_CELLULE} ${localisationManquante || premiereIdentique != null ? 'bg-transparent' : ''}`}
                      >
                        <option value="">—</option>
                        {emplacementsDe(ligne.entrepotId).map((em) => (
                          <option key={em.id} value={em.id}>
                            {em.code}
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
                  <td className={premiereIdentique != null ? CLASSE_TD_ERREUR : CLASSE_TD}>
                    <input
                      {...attributsCellule(index, 'lot')}
                      value={ligne.lot}
                      onChange={(e) => majLigne(ligne.cle, { lot: e.target.value })}
                      className={`${CLASSE_CELLULE} ${premiereIdentique != null ? 'bg-transparent' : ''}`}
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
                  <td className={dateIllisible ? CLASSE_TD_ERREUR : CLASSE_TD}>
                    {dateIllisible ? (
                      // Date importée illisible : on la montre telle quelle pour qu'elle soit corrigée.
                      <input
                        {...attributsCellule(index, 'dateExpiration')}
                        value={ligne.dateExpiration}
                        onChange={(e) => majLigne(ligne.cle, { dateExpiration: e.target.value })}
                        onFocus={() => majLigne(ligne.cle, { dateExpiration: '' })}
                        title="Date illisible : clique pour la ressaisir"
                        className={`${CLASSE_CELLULE} text-danger bg-transparent`}
                      />
                    ) : (
                      <input
                        {...attributsCellule(index, 'dateExpiration')}
                        type="date"
                        value={ligne.dateExpiration}
                        onChange={(e) => majLigne(ligne.cle, { dateExpiration: e.target.value })}
                        className={CLASSE_CELLULE}
                      />
                    )}
                  </td>
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

      {ficheFournisseurOuverte && profil && (
        <NouveauFournisseurModal entrepriseId={profil.entreprise_id} onFermer={() => setFicheFournisseurOuverte(false)} onCree={onFournisseurCree} />
      )}
      {abandonAConfirmer && (
        <ConfirmationModal
          titre="Abandonner cette entrée ?"
          libelleConfirmer="Abandonner"
          libelleRetour="Continuer la saisie"
          danger
          focusSurRetour
          onConfirmer={revenirALaListe}
          onFermer={() => setAbandonAConfirmer(false)}
        >
          <p>Les lignes saisies ne seront pas enregistrées.</p>
        </ConfirmationModal>
      )}
    </div>
  )
}
