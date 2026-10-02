// Export de tableaux en CSV et Excel. La bibliothèque Excel n'est chargée
// qu'au moment de l'export, pour ne pas alourdir l'application.

export type ValeurExport = string | number | Date | null | undefined

export interface ColonneExport {
  titre: string
  /** Largeur indicative de la colonne dans Excel (en caractères). */
  largeur?: number
}

function telecharger(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function texteCsv(valeur: ValeurExport): string {
  if (valeur == null) return ''
  const texte =
    valeur instanceof Date ? valeur.toLocaleString('fr-FR') : typeof valeur === 'number' ? String(valeur).replace('.', ',') : valeur
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

/**
 * CSV lisible directement par Excel en français : séparateur ";", virgule
 * décimale et marque UTF-8 en tête (sinon les accents s'affichent mal).
 */
export function exporterCsv(nomFichier: string, colonnes: ColonneExport[], lignes: ValeurExport[][]) {
  const contenu = [colonnes.map((c) => texteCsv(c.titre)), ...lignes.map((l) => l.map(texteCsv))]
    .map((l) => l.join(';'))
    .join('\r\n')
  telecharger(new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8' }), `${nomFichier}.csv`)
}

export async function exporterExcel(
  nomFichier: string,
  colonnes: ColonneExport[],
  lignes: ValeurExport[][],
  nomFeuille = 'Export',
) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const entete = colonnes.map((c) => ({ value: c.titre, fontWeight: 'bold' as const }))
  const corps = lignes.map((l) =>
    l.map((valeur) => {
      if (valeur == null || valeur === '') return null
      if (valeur instanceof Date) return { value: valeur, type: Date, format: 'dd/mm/yyyy hh:mm' }
      return { value: valeur }
    }),
  )
  await writeXlsxFile([entete, ...corps], {
    columns: colonnes.map((c) => ({ width: c.largeur ?? 16 })),
    sheet: nomFeuille.slice(0, 31),
  }).toFile(`${nomFichier}.xlsx`)
}

/** Nom de fichier sans caractères gênants (ex. "Sorties_2026-10-03"). */
export function nomFichierSur(texte: string): string {
  return texte.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_')
}
