import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { AlertTriangle, FileSpreadsheet, Import, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSaisieEnCours, useTabs } from '../context/TabsContext'
import { useSelection } from '../context/SelectionContext'
import { useToast } from '../context/ToastContext'
import { BandeauErreur } from '../components/ui/BandeauErreur'
import { messageErreur } from '../lib/erreurs'
import { peutGererCatalogue, peutSaisirReception } from '../lib/permissions'
import { dateSaisieVersISO, dateVersInput } from '../lib/dates'
import { getEmplacements, getEntrepots } from '../lib/api/entrepots'
import { getProduitsAvecStock } from '../lib/api/stock'
import { getFournisseurs, getLocalisationsProduits } from '../lib/api/produits'
import { creerReception, getLignesReception, getReception, modifierReception, type NouvelleLigneReception } from '../lib/api/receptions'
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
  importee: boolean
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
    importee: false,
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
 * En mode « modification », la feuille est pré-remplie avec une entrée en
 * attente et l'enregistrement remplace son contenu (même numéro).
 */
export function NouvelleReception({ modification = false }: { modification?: boolean } = {}) {
  const { profil, entrepotsAssignes } = useAuth()
  const { ouvrirOnglet, fermerOnglet } = useTabs()
  const { demandeModificationEntree, afficherEntree } = useSelection()
  const ecran = modification ? 'modifier-entree' : 'nouvelle-reception'
  const [entreeModifiee, setEntreeModifiee] = useState<{ id: string; numero: string } | null>(null)
  // État de la feuille juste après le pré-remplissage : sert à savoir si l'on a modifié quelque chose.
  const [etatInitial, setEtatInitial] = useState<string | null>(null)
  const [capturerEtat, setCapturerEtat] = useState(false)
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
  // Après un essai d'enregistrement, toutes les lignes à corriger passent en rouge (pas seulement les importées).
  const [tentative, setTentative] = useState(false)
  // Incrémenté à chaque refus d'enregistrement : le bandeau d'erreur tressaute, même si le message est le même.
  const [secousse, setSecousse] = useState(0)
  const { afficherToast } = useToast()
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

  useEffect(() => {
    if (!modification || !demandeModificationEntree || produits.length === 0 || emplacements.length === 0) return
    let actif = true
    const id = demandeModificationEntree.receptionId
    Promise.all([getReception(id), getLignesReception(id)])
      .then(([reception, lignesEntree]) => {
        if (!actif || !reception) return
        setEntreeModifiee({ id: reception.id, numero: reception.numero })
        setFournisseurId(reception.fournisseur_id ?? '')
        setDateMouvement(dateVersInput(new Date(reception.cree_le)))
        setAvecNote(Boolean(reception.notes))
        setNotes(reception.notes ?? '')
        const parId = new Map(produits.map((p) => [p.id, p]))
        setLignes(
          avecLigneVideFinale(
            lignesEntree.map((l) => ({
              ...ligneVide(),
              reference: parId.get(l.produit_id)?.reference ?? '',
              produitId: l.produit_id,
              entrepotId: emplacements.find((e) => e.id === l.emplacement_id)?.entrepot_id ?? '',
              emplacementId: l.emplacement_id ?? '',
              quantite: String(l.quantite_recue),
              prixUnitaire: l.prix_unitaire ? String(l.prix_unitaire) : '',
              lot: l.lot ?? '',
              numeroSerie: l.numero_serie ?? '',
              dateExpiration: l.date_expiration ?? '',
            })),
          ),
        )
        setTentative(false)
        setErreur(null)
        setCapturerEtat(true)
      })
      .catch((e) => actif && setErreur(messageErreur(e)))
    return () => {
      actif = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modification, demandeModificationEntree, produits.length, emplacements.length])

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

  /** Ligne remise à blanc (le dépôt est gardé) : une ligne sans référence ne garde ni quantité ni prix. */
  function viderLigne(ligne: LigneSaisie) {
    setLignes((prev) =>
      avecLigneVideFinale(prev.map((l) => (l.cle === ligne.cle ? { ...ligneVide(ligne.entrepotId), cle: ligne.cle } : l))),
    )
  }

  function onChangerReference(ligne: LigneSaisie, texte: string) {
    if (!texte.trim()) {
      viderLigne(ligne)
      return
    }
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
      viderLigne(ligne)
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
  const etatSaisie = JSON.stringify([
    fournisseurId,
    dateMouvement,
    avecNote ? notes.trim() : '',
    lignesRemplies.map((l) => [l.produitId, l.reference, l.entrepotId, l.emplacementId, l.quantite, l.prixUnitaire, l.lot, l.numeroSerie, l.dateExpiration]),
  ])
  useEffect(() => {
    if (!capturerEtat) return
    setEtatInitial(etatSaisie)
    setCapturerEtat(false)
  }, [capturerEtat, etatSaisie])
  // Nouvelle entrée : dès qu'une ligne ou une note est saisie. Modification : dès qu'on change quelque chose.
  const saisieEnCours = modification
    ? etatInitial != null && etatSaisie !== etatInitial
    : lignesRemplies.length > 0 || notes.trim() !== ''
  useSaisieEnCours(ecran, saisieEnCours)

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

  /** Retour à la liste des entrées (ou à la page de l'entrée modifiée), en fermant cet onglet. */
  function revenirALaListe() {
    if (modification && entreeModifiee) {
      afficherEntree(entreeModifiee.id)
      ouvrirOnglet('entree', `Entrée ${entreeModifiee.numero}`)
    } else ouvrirOnglet('entrees', 'Entrées')
    fermerOnglet(ecran)
  }

  function annuler() {
    if (saisieEnCours) setAbandonAConfirmer(true)
    else revenirALaListe()
  }

  /** Ce qui empêche d'enregistrer une ligne remplie (vide = ligne correcte). */
  function problemesLigne(l: LigneSaisie): string[] {
    if (estVide(l)) return []
    if (l.noteImport) return [l.noteImport]
    const problemes: string[] = []
    if (!l.reference.trim()) problemes.push('la référence manque')
    else if (!l.produitId) problemes.push("cette référence n'existe pas")
    const quantite = Number(l.quantite)
    if (l.quantite.trim() === '') problemes.push('la quantité manque')
    else if (!Number.isInteger(quantite) || quantite <= 0) problemes.push('la quantité doit être un nombre entier plus grand que 0')
    if (!l.entrepotId) problemes.push('le dépôt manque')
    else if (l.produitId && !l.emplacementId) problemes.push('la localisation manque')
    const premiere = doublonDe.get(l.cle)
    if (premiere != null) problemes.push(`ce produit est déjà saisi ligne ${premiere + 1} (même dépôt, localisation et lot)`)
    if (l.dateExpiration && !/^\d{4}-\d{2}-\d{2}$/.test(l.dateExpiration)) problemes.push("la date d'expiration est illisible")
    // Sans lot ni date, la sortie "premier périmé, premier sorti" est impossible (même contrôle côté base).
    else if (l.produitId && produitParId.get(l.produitId)?.gere_expiration && !l.dateExpiration) {
      problemes.push("la date d'expiration manque (obligatoire pour ce produit)")
    }
    if (l.dateExpiration && !l.lot.trim() && !l.numeroSerie.trim()) {
      problemes.push("le lot manque (obligatoire avec une date d'expiration)")
    }
    return problemes
  }

  const problemesParLigne = new Map(lignes.map((l) => [l.cle, problemesLigne(l)]))
  const aSignaler = (l: LigneSaisie) => (l.importee || tentative) && (problemesParLigne.get(l.cle)?.length ?? 0) > 0
  const nbACorriger = lignes.filter(aSignaler).length

  function erreurDeSaisie(): string | null {
    if (lignesRemplies.length === 0) return 'Saisis au moins une ligne.'
    const index = lignes.findIndex((l) => (problemesParLigne.get(l.cle)?.length ?? 0) > 0)
    if (index >= 0) {
      setTentative(true)
      return `Ligne ${index + 1} : ${problemesParLigne.get(lignes[index].cle)![0]}. Complète les cases en rouge, puis enregistre.`
    }
    if (avecNote && !notes.trim()) return 'Écris la note, ou décoche « Ajouter une note ».'
    return null
  }

  async function onEnregistrer() {
    const probleme = erreurDeSaisie()
    if (probleme) {
      setErreur(probleme)
      setSecousse((n) => n + 1)
      afficherToast(probleme, 'erreur')
      setTimeout(() => {
        const caseRouge = tableauRef.current?.querySelector<HTMLElement>('td[aria-invalid="true"] input, td[aria-invalid="true"] select')
        caseRouge?.focus()
      }, 60)
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
      const contenu = {
        fournisseurId: fournisseurId || null,
        notes: avecNote ? notes.trim() || null : null,
        dateMouvement: dateMouvement ? dateSaisieVersISO(dateMouvement) : null,
        lignes: lignesReception,
      }
      if (modification) {
        if (!entreeModifiee) throw new Error("L'entrée à modifier n'est pas encore chargée.")
        await modifierReception(entreeModifiee.id, contenu)
      } else {
        // Dépôt principal = celui de la première ligne ; chaque ligne entre dans son propre dépôt.
        await creerReception({ ...contenu, entrepotId: lignesRemplies[0].entrepotId, numeroPo: null })
      }
      revenirALaListe()
    } catch (err) {
      setErreur(messageErreur(err))
      setEnvoi(false)
    }
  }

  // --- Import d'une liste ---------------------------------------------------

  /** Produit d'une ligne importée : par son code, sinon par son nom (s'il n'est porté que par un seul produit). */
  function produitImporte(li: LigneImportee, problemes: string[]): ProduitAvecStock | undefined {
    const parCode = li.reference ? produitParReference.get(li.reference.trim().toLowerCase()) : undefined
    const homonymes = li.designation ? produits.filter((p) => normaliser(p.designation) === normaliser(li.designation)) : []
    if (parCode) {
      if (li.designation && homonymes.length > 0 && !homonymes.includes(parCode)) {
        problemes.push(`la référence ${parCode.reference} ne correspond pas à « ${li.designation} »`)
      }
      return parCode
    }
    if (homonymes.length === 1) return homonymes[0]
    if (homonymes.length > 1) problemes.push(`plusieurs produits s'appellent « ${li.designation} », indique la référence`)
    else if (!li.reference && !li.designation) problemes.push('référence ou désignation manquante')
    else if (!li.reference) problemes.push(`aucun produit ne s'appelle « ${li.designation} »`)
    return undefined
  }

  function depuisImport(li: LigneImportee): LigneSaisie {
    const ligne = ligneVide()
    const problemes: string[] = []
    const produit = produitImporte(li, problemes)
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
      // Produit trouvé par son nom : on affiche son code. Sinon, ce que contenait le fichier (en rouge).
      reference: produit?.reference ?? (li.reference || li.designation),
      produitId: produit?.id ?? '',
      entrepotId: depot?.id ?? '',
      emplacementId: emplacement?.id ?? (produit && depot ? emplacementParDefaut(produit.id, depot.id) : ''),
      quantite: li.quantite.replace(',', '.'),
      prixUnitaire: li.prixUnitaire || (produit && produit.prix_moyen_pondere > 0 ? String(produit.prix_moyen_pondere) : ''),
      lot: li.lot,
      numeroSerie: li.numeroSerie,
      dateExpiration: li.dateExpiration,
      noteImport: problemes.length > 0 ? `Ligne ${li.numeroFichier} du fichier : ${problemes.join(', ')}.` : '',
      importee: true,
    }
  }

  async function onFichierChoisi(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    try {
      const importees = (await lireFichierEntrees(fichier)).map(depuisImport)
      // Les lignes importées s'ajoutent à celles déjà saisies.
      setLignes(avecLigneVideFinale([...lignesRemplies, ...importees]))
    } catch (err) {
      setErreur(messageErreur(err))
    }
  }

  function telechargerModele() {
    telechargerModeleEntrees().catch((err) => setErreur(messageErreur(err)))
  }

  return (
    <div className="h-full flex flex-col gap-2 p-[var(--content-padding)] pt-2 min-h-0">
      {/* En-tête sur une ligne : fournisseur, date, note ; actions et import à droite */}
      <div className="shrink-0 flex items-start gap-4 flex-wrap">
        {modification && (
          <div className="flex flex-col gap-1">
            <span className={CLASSE_LABEL}>Modification</span>
            <span className="h-[30px] flex items-center font-mono text-[13px] font-semibold text-info-deep">{entreeModifiee?.numero ?? '...'}</span>
          </div>
        )}
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
              <Import size={14} strokeWidth={1.75} /> Import
            </button>
            <button
              type="button"
              onClick={telechargerModele}
              className="inline-flex items-center gap-1 text-[11px] text-info-deep hover:underline"
              title="Fichier Excel à remplir : une ligne par produit (référence ou désignation)"
            >
              <FileSpreadsheet size={11} strokeWidth={1.75} /> Télécharger le modèle
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
          <span className="font-semibold text-text">{quantiteTotale.toLocaleString('fr-FR')}</span> · Montant{' '}
          <span className="font-semibold text-text">{valeurTotale.toLocaleString('fr-FR')} XOF</span>
        </span>
        {nbACorriger > 0 && (
          <span className="text-danger-deep font-medium">
            {nbACorriger} ligne(s) à corriger (en rouge, détail au survol)
          </span>
        )}
      </div>
      {/* Le bandeau tressaute à chaque refus (clé), et disparaît dès qu'on corrige. */}
      <BandeauErreur
        key={secousse}
        message={erreur && !(tentative && nbACorriger === 0 && erreur.startsWith('Ligne ')) ? erreur : null}
        className="shrink-0 text-xs bg-danger-soft text-danger-deep rounded-lg px-3 py-2 animate-[secousse_360ms_ease-in-out]"
      />

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
              // Pas de quantité ni de prix sans référence : les cases restent grisées.
              const sansReference = !ligne.reference.trim()
              const referenceInconnue = ligne.reference.trim() !== '' && !produit
              const avertissement = avertissementEmplacement(ligne)
              const premiereIdentique = doublonDe.get(ligne.cle)
              const dateIllisible = ligne.dateExpiration !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(ligne.dateExpiration)
              // Doublon : toujours signalé. Autres problèmes : ligne importée ou après un essai d'enregistrement.
              const signaler = aSignaler(ligne) || premiereIdentique != null
              const doublon = premiereIdentique != null ? `Déjà saisi ligne ${premiereIdentique + 1} : change la localisation ou le lot` : null
              // Seule la case en cause passe en rouge, avec ce qu'il faut faire (bulle au survol).
              const erreurs = {
                reference: referenceInconnue
                  ? 'Référence inconnue : vérifie le code ou choisis-le dans la liste'
                  : signaler && sansReference && !vide
                    ? 'Référence manquante : saisis le code du produit'
                    : null,
                quantite:
                  signaler && !sansReference && !(Number.isInteger(Number(ligne.quantite)) && Number(ligne.quantite) > 0)
                    ? ligne.quantite === ''
                      ? 'Quantité manquante : saisis la quantité reçue'
                      : 'Quantité invalide : un nombre entier plus grand que 0'
                    : null,
                depot: signaler && !ligne.entrepotId ? 'Dépôt manquant : choisis le dépôt' : null,
                localisation:
                  doublon ?? (signaler && produit && !ligne.emplacementId ? 'Localisation manquante : choisis où ranger le produit' : null),
                lot:
                  doublon ??
                  (signaler && ligne.dateExpiration && !ligne.lot.trim() && !ligne.numeroSerie.trim()
                    ? "Lot manquant : obligatoire avec une date d'expiration"
                    : null),
                expiration: dateIllisible
                  ? 'Date illisible : clique pour la ressaisir'
                  : signaler && produit?.gere_expiration && !ligne.dateExpiration
                    ? "Date d'expiration manquante : obligatoire pour ce produit"
                    : null,
              }
              const messagesLigne = [ligne.noteImport, ...Object.values(erreurs)].filter((m): m is string => Boolean(m))
              const enErreur = signaler && messagesLigne.length > 0
              return (
                <tr key={ligne.cle}>
                  <td
                    className={`${CLASSE_TD} text-center bg-muted ${enErreur ? 'text-danger-deep font-bold' : 'text-text-muted'}`}
                    title={enErreur ? [...new Set(messagesLigne)].join('\n') : undefined}
                  >
                    {enErreur ? <AlertTriangle size={12} strokeWidth={2} className="inline" /> : index + 1}
                  </td>
                  <CelluleSaisie erreur={erreurs.reference}>
                    <input
                      {...attributsCellule(index, 'reference')}
                      list="references-reception"
                      value={ligne.reference}
                      onChange={(e) => onChangerReference(ligne, e.target.value)}
                      placeholder={vide ? 'Référence...' : ''}
                      className={`${CLASSE_CELLULE} font-mono ${erreurs.reference ? 'text-danger bg-transparent placeholder:text-danger' : ''}`}
                    />
                  </CelluleSaisie>
                  <td className={`${CLASSE_TD} px-2 truncate`} title={produit?.designation}>
                    {produit ? (
                      <span className="text-text">{produit.designation}</span>
                    ) : referenceInconnue ? (
                      <span className="text-danger">Référence inconnue</span>
                    ) : null}
                  </td>
                  <CelluleSaisie erreur={erreurs.quantite}>
                    <input
                      {...attributsCellule(index, 'quantite')}
                      disabled={sansReference}
                      type="number"
                      min="1"
                      step="1"
                      value={ligne.quantite}
                      onChange={(e) => majLigne(ligne.cle, { quantite: e.target.value })}
                      className={`${CLASSE_CELLULE} text-right ${erreurs.quantite ? 'bg-transparent placeholder:text-danger' : ''}`}
                    />
                  </CelluleSaisie>
                  <td className={CLASSE_TD}>
                    <input
                      {...attributsCellule(index, 'prixUnitaire')}
                      disabled={sansReference}
                      type="number"
                      min="0"
                      step="0.01"
                      value={ligne.prixUnitaire}
                      onChange={(e) => majLigne(ligne.cle, { prixUnitaire: e.target.value })}
                      className={`${CLASSE_CELLULE} text-right`}
                    />
                  </td>
                  <CelluleSaisie erreur={erreurs.depot}>
                    <select
                      {...attributsCellule(index, 'entrepotId')}
                      value={ligne.entrepotId}
                      onChange={(e) => onChangerDepot(ligne, e.target.value)}
                      className={`${CLASSE_CELLULE} ${erreurs.depot ? 'bg-transparent text-danger' : ''}`}
                    >
                      <option value="">—</option>
                      {entrepots.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.nom}
                        </option>
                      ))}
                    </select>
                  </CelluleSaisie>
                  <CelluleSaisie erreur={erreurs.localisation}>
                    <div className="flex items-center">
                      <select
                        {...attributsCellule(index, 'emplacementId')}
                        value={ligne.emplacementId}
                        onChange={(e) => majLigne(ligne.cle, { emplacementId: e.target.value })}
                        disabled={!ligne.entrepotId || sansReference}
                        className={`${CLASSE_CELLULE} ${erreurs.localisation ? 'bg-transparent' : ''} ${erreurs.localisation && !ligne.emplacementId ? 'text-danger' : ''}`}
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
                  </CelluleSaisie>
                  <CelluleSaisie erreur={erreurs.lot}>
                    <input
                      {...attributsCellule(index, 'lot')}
                      disabled={sansReference}
                      value={ligne.lot}
                      onChange={(e) => majLigne(ligne.cle, { lot: e.target.value })}
                      className={`${CLASSE_CELLULE} ${erreurs.lot ? 'bg-transparent placeholder:text-danger' : ''}`}
                    />
                  </CelluleSaisie>
                  <td className={CLASSE_TD}>
                    <input
                      {...attributsCellule(index, 'numeroSerie')}
                      disabled={sansReference}
                      value={ligne.numeroSerie}
                      onChange={(e) => majLigne(ligne.cle, { numeroSerie: e.target.value })}
                      className={CLASSE_CELLULE}
                    />
                  </td>
                  <CelluleSaisie erreur={erreurs.expiration}>
                    {dateIllisible ? (
                      // Date importée illisible : on la montre telle quelle pour qu'elle soit corrigée.
                      <input
                        {...attributsCellule(index, 'dateExpiration')}
                        value={ligne.dateExpiration}
                        onChange={(e) => majLigne(ligne.cle, { dateExpiration: e.target.value })}
                        onFocus={() => majLigne(ligne.cle, { dateExpiration: '' })}
                        className={`${CLASSE_CELLULE} text-danger bg-transparent`}
                      />
                    ) : (
                      <input
                        {...attributsCellule(index, 'dateExpiration')}
                        type="date"
                        disabled={sansReference}
                        value={ligne.dateExpiration}
                        onChange={(e) => majLigne(ligne.cle, { dateExpiration: e.target.value })}
                        className={`${CLASSE_CELLULE} ${erreurs.expiration ? 'bg-transparent text-danger' : ''}`}
                      />
                    )}
                  </CelluleSaisie>
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
          titre={modification ? 'Abandonner les modifications ?' : 'Abandonner cette entrée ?'}
          libelleConfirmer="Abandonner"
          libelleRetour="Continuer la saisie"
          danger
          focusSurRetour
          onConfirmer={revenirALaListe}
          onFermer={() => setAbandonAConfirmer(false)}
        >
          <p>{modification ? "L'entrée reste telle qu'elle était." : 'Les lignes saisies ne seront pas enregistrées.'}</p>
        </ConfirmationModal>
      )}
    </div>
  )
}

/**
 * Case du tableau de saisie. En erreur : fond rouge, et une bulle dit ce qu'il
 * faut faire, au survol ou quand le curseur est dans la case.
 */
function CelluleSaisie({ erreur, children }: { erreur: string | null; children: ReactNode }) {
  if (!erreur) return <td className={CLASSE_TD}>{children}</td>
  return (
    <td className={`${CLASSE_TD_ERREUR} relative group/case`} aria-invalid="true">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden whitespace-nowrap rounded-md bg-danger px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover/case:block group-focus-within/case:block"
      >
        {erreur}
      </span>
    </td>
  )
}
