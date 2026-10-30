// Import d'une liste d'entrées : modèle Excel à remplir, puis lecture du
// fichier rempli (Excel ou CSV). Les bibliothèques ne sont chargées qu'au
// moment de l'utilisation, pour ne pas alourdir l'application.

/** Une ligne lue dans le fichier, valeurs brutes (la feuille de saisie les reconnaît ensuite). */
export interface LigneImportee {
  /** Numéro de la ligne dans le fichier (pour les messages). */
  numeroFichier: number
  reference: string
  /** Nom du produit : permet de le retrouver quand on n'a pas son code (et inversement). */
  designation: string
  quantite: string
  prixUnitaire: string
  depot: string
  localisation: string
  lot: string
  numeroSerie: string
  /** Date d'expiration au format AAAA-MM-JJ, ou texte brut si elle n'a pas pu être lue. */
  dateExpiration: string
}

type Champ = Exclude<keyof LigneImportee, 'numeroFichier'>

// Titres du modèle, dans l'ordre. L'astérisque signale une colonne obligatoire ;
// pour le produit, la Référence ou la Désignation suffit.
const COLONNES: { champ: Champ; titre: string; largeur: number }[] = [
  { champ: 'reference', titre: 'Référence', largeur: 16 },
  { champ: 'designation', titre: 'Désignation', largeur: 32 },
  { champ: 'quantite', titre: 'Quantité*', largeur: 11 },
  { champ: 'prixUnitaire', titre: 'Prix unitaire', largeur: 13 },
  { champ: 'depot', titre: 'Dépôt*', largeur: 22 },
  { champ: 'localisation', titre: 'Localisation*', largeur: 14 },
  { champ: 'lot', titre: 'Lot', largeur: 14 },
  { champ: 'numeroSerie', titre: 'N° série', largeur: 14 },
  { champ: 'dateExpiration', titre: "Date d'expiration", largeur: 16 },
]

/** Titre sans accents, majuscules, astérisque ni ponctuation : « N° série » et « no serie » se valent. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

// Quelques variantes acceptées en plus des titres du modèle.
const SYNONYMES: Record<string, Champ> = {
  reference: 'reference',
  ref: 'reference',
  code: 'reference',
  designation: 'designation',
  nom: 'designation',
  nomproduit: 'designation',
  produit: 'designation',
  libelle: 'designation',
  description: 'designation',
  quantite: 'quantite',
  qte: 'quantite',
  prixunitaire: 'prixUnitaire',
  prix: 'prixUnitaire',
  depot: 'depot',
  entrepot: 'depot',
  localisation: 'localisation',
  emplacement: 'localisation',
  lot: 'lot',
  nlot: 'lot',
  noserie: 'numeroSerie',
  nserie: 'numeroSerie',
  serie: 'numeroSerie',
  dateexpiration: 'dateExpiration',
  // « Date d'expiration » : l'apostrophe laisse un « d ».
  datedexpiration: 'dateExpiration',
  expiration: 'dateExpiration',
  datedeperemption: 'dateExpiration',
  peremption: 'dateExpiration',
}

/** Télécharge le modèle Excel : une seule feuille « Entrées », avec les titres des colonnes à remplir. */
export async function telechargerModeleEntrees() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const entete = COLONNES.map((c) => ({ value: c.titre, fontWeight: 'bold' as const, backgroundColor: '#E8F5E9' }))
  await writeXlsxFile([entete], {
    sheet: 'Entrées',
    columns: COLONNES.map((c) => ({ width: c.largeur })),
    stickyRowsCount: 1,
  }).toFile('Modele_import_entrees.xlsx')
}

/** Cellules d'un fichier Excel (première feuille) ou CSV, ligne par ligne. Partagé avec l'import des sorties. */
export async function lireTableau(fichier: File): Promise<unknown[][]> {
  if (/\.csv$/i.test(fichier.name) || fichier.type === 'text/csv') return lireCsv(await fichier.text())
  const { readSheet } = await import('read-excel-file/browser')
  return readSheet(fichier, 1)
}

export function texteCellule(valeur: unknown): string {
  if (valeur == null) return ''
  if (valeur instanceof Date) return dateISO(valeur)
  return String(valeur).trim()
}

function dateISO(d: Date): string {
  // Les dates Excel sont lues en UTC : on garde le jour tel qu'il est écrit.
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** JJ/MM/AAAA (ou JJ-MM-AAAA, AAAA-MM-JJ) vers AAAA-MM-JJ ; sinon le texte tel quel (signalé à la saisie). */
function lireDate(texte: string): string {
  if (!texte) return ''
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texte)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return texte
}

/** Découpe un CSV (séparateur ; ou , détecté sur l'en-tête), guillemets gérés. */
function lireCsv(contenu: string): string[][] {
  const texte = contenu.replace(/^﻿/, '')
  const premiereLigne = texte.split(/\r?\n/, 1)[0] ?? ''
  const separateur = (premiereLigne.match(/;/g)?.length ?? 0) >= (premiereLigne.match(/,/g)?.length ?? 0) ? ';' : ','
  const lignes: string[][] = []
  let ligne: string[] = []
  let cellule = ''
  let entreGuillemets = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"'
        i++
      } else if (c === '"') entreGuillemets = false
      else cellule += c
    } else if (c === '"') entreGuillemets = true
    else if (c === separateur) {
      ligne.push(cellule)
      cellule = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++
      ligne.push(cellule)
      lignes.push(ligne)
      ligne = []
      cellule = ''
    } else cellule += c
  }
  if (cellule || ligne.length > 0) {
    ligne.push(cellule)
    lignes.push(ligne)
  }
  return lignes
}

/**
 * Lit un fichier Excel (première feuille) ou CSV. Les colonnes sont
 * reconnues par leur titre, dans n'importe quel ordre ; les lignes vides
 * sont ignorées. Lève une erreur claire si l'en-tête n'est pas reconnu.
 */
export async function lireFichierEntrees(fichier: File): Promise<LigneImportee[]> {
  const tableau = await lireTableau(fichier)

  // En-tête = première ligne qui contient une colonne Référence ou Désignation.
  const indexEntete = tableau.findIndex((ligne) =>
    ligne.some((c) => ['reference', 'designation'].includes(SYNONYMES[normaliser(texteCellule(c))])),
  )
  if (indexEntete < 0) {
    throw new Error("Colonne « Référence » ou « Désignation » introuvable. Utilise le modèle (lien « Télécharger le modèle » sous le bouton Import).")
  }
  const colonnes = new Map<Champ, number>()
  tableau[indexEntete].forEach((c, i) => {
    const champ = SYNONYMES[normaliser(texteCellule(c))]
    if (champ && !colonnes.has(champ)) colonnes.set(champ, i)
  })
  for (const obligatoire of ['quantite', 'depot', 'localisation'] as Champ[]) {
    if (!colonnes.has(obligatoire)) {
      const titre = COLONNES.find((c) => c.champ === obligatoire)!.titre.replace('*', '')
      throw new Error(`Colonne « ${titre} » introuvable. Utilise le modèle (lien « Télécharger le modèle » sous le bouton Import).`)
    }
  }

  const lire = (ligne: unknown[], champ: Champ) => {
    const i = colonnes.get(champ)
    return i == null ? '' : texteCellule(ligne[i])
  }
  const resultat: LigneImportee[] = []
  tableau.slice(indexEntete + 1).forEach((ligne, i) => {
    const valeurs = {
      reference: lire(ligne, 'reference'),
      designation: lire(ligne, 'designation'),
      quantite: lire(ligne, 'quantite'),
      prixUnitaire: lire(ligne, 'prixUnitaire').replace(',', '.').replace(/\s/g, ''),
      depot: lire(ligne, 'depot'),
      localisation: lire(ligne, 'localisation'),
      lot: lire(ligne, 'lot'),
      numeroSerie: lire(ligne, 'numeroSerie'),
      dateExpiration: lireDate(lire(ligne, 'dateExpiration')),
    }
    if (Object.values(valeurs).every((v) => v === '')) return
    resultat.push({ numeroFichier: indexEntete + i + 2, ...valeurs })
  })
  if (resultat.length === 0) throw new Error('Le fichier ne contient aucune ligne à importer.')
  return resultat
}
