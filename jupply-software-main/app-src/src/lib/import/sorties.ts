// Import d'une liste de produits à sortir : modèle Excel à remplir, puis
// lecture du fichier rempli (Excel ou CSV). Même lecture que l'import des entrées.
import { lireTableau, normaliser, texteCellule } from './entrees'

/** Une ligne lue dans le fichier, valeurs brutes (la feuille de sortie les reconnaît ensuite). */
export interface LigneSortieImportee {
  /** Numéro de la ligne dans le fichier (pour les messages). */
  numeroFichier: number
  reference: string
  designation: string
  quantite: string
  /** Facultatif : sinon, le dépôt choisi en haut de la feuille (ou celui qui a le plus de stock). */
  depot: string
}

type Champ = Exclude<keyof LigneSortieImportee, 'numeroFichier'>

// Pour le produit, la Référence ou la Désignation suffit.
const COLONNES: { champ: Champ; titre: string; largeur: number }[] = [
  { champ: 'reference', titre: 'Référence', largeur: 16 },
  { champ: 'designation', titre: 'Désignation', largeur: 32 },
  { champ: 'quantite', titre: 'Quantité*', largeur: 11 },
  { champ: 'depot', titre: 'Dépôt', largeur: 22 },
]

const SYNONYMES: Record<string, Champ> = {
  reference: 'reference',
  ref: 'reference',
  code: 'reference',
  designation: 'designation',
  nom: 'designation',
  produit: 'designation',
  libelle: 'designation',
  description: 'designation',
  quantite: 'quantite',
  qte: 'quantite',
  depot: 'depot',
  entrepot: 'depot',
}

/** Télécharge le modèle Excel : une feuille « Sorties » avec les titres des colonnes. */
export async function telechargerModeleSorties() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const entete = COLONNES.map((c) => ({ value: c.titre, fontWeight: 'bold' as const, backgroundColor: '#E8F5E9' }))
  await writeXlsxFile([entete], {
    sheet: 'Sorties',
    columns: COLONNES.map((c) => ({ width: c.largeur })),
    stickyRowsCount: 1,
  }).toFile('Modele_import_sorties.xlsx')
}

/** Lit un fichier Excel (première feuille) ou CSV ; colonnes reconnues par leur titre, dans n'importe quel ordre. */
export async function lireFichierSorties(fichier: File): Promise<LigneSortieImportee[]> {
  const tableau = await lireTableau(fichier)
  const indexEntete = tableau.findIndex((ligne) =>
    ligne.some((c) => ['reference', 'designation'].includes(SYNONYMES[normaliser(texteCellule(c))])),
  )
  if (indexEntete < 0) {
    throw new Error('Colonne « Référence » ou « Désignation » introuvable. Utilise le modèle (lien sous le bouton Import).')
  }
  const colonnes = new Map<Champ, number>()
  tableau[indexEntete].forEach((c, i) => {
    const champ = SYNONYMES[normaliser(texteCellule(c))]
    if (champ && !colonnes.has(champ)) colonnes.set(champ, i)
  })
  if (!colonnes.has('quantite')) {
    throw new Error('Colonne « Quantité » introuvable. Utilise le modèle (lien sous le bouton Import).')
  }
  const lire = (ligne: unknown[], champ: Champ) => {
    const i = colonnes.get(champ)
    return i == null ? '' : texteCellule(ligne[i])
  }
  const resultat: LigneSortieImportee[] = []
  tableau.slice(indexEntete + 1).forEach((ligne, i) => {
    const valeurs = {
      reference: lire(ligne, 'reference'),
      designation: lire(ligne, 'designation'),
      quantite: lire(ligne, 'quantite').replace(',', '.'),
      depot: lire(ligne, 'depot'),
    }
    if (Object.values(valeurs).every((v) => v === '')) return
    resultat.push({ numeroFichier: indexEntete + i + 2, ...valeurs })
  })
  if (resultat.length === 0) throw new Error('Le fichier ne contient aucune ligne à importer.')
  return resultat
}
