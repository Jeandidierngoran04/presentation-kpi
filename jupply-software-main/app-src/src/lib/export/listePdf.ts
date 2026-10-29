// Export d'une liste (historique, mouvements...) en PDF : tableau paysage,
// en-tête avec l'entreprise, le titre et la période, numéros de page.
// jsPDF n'est chargé qu'au moment de l'export.
import { getNomEntreprise } from '../api/historique'
import type { ColonneExport, ValeurExport } from './fichiers'

/** La police standard du PDF ne connaît pas certains caractères : on les remplace. */
function textePdf(valeur: ValeurExport): string {
  if (valeur == null) return ''
  const texte =
    valeur instanceof Date
      ? valeur.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : typeof valeur === 'number'
        ? valeur.toLocaleString('fr-FR')
        : valeur
  return texte
    .replace(/[  ]/g, ' ')
    .replace(/→/g, '>')
    .replace(/[«»]/g, '"')
}

export async function exporterListePdf(options: {
  nomFichier: string
  titre: string
  /** Ligne sous le titre (période, filtres appliqués...). */
  sousTitre?: string
  colonnes: ColonneExport[]
  lignes: ValeurExport[][]
  /** Colonnes alignées à droite (quantités), par index. */
  colonnesADroite?: number[]
}) {
  const [{ jsPDF }, { default: autoTable }, entreprise] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    getNomEntreprise(),
  ])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const hauteur = doc.internal.pageSize.getHeight()
  const marge = 10

  doc.setProperties({ title: options.titre })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(textePdf(options.titre), marge, marge + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(textePdf(entreprise), largeur - marge, marge + 5, { align: 'right' })
  if (options.sousTitre) doc.text(textePdf(options.sousTitre), marge, marge + 11)
  doc.text(
    textePdf(`${options.lignes.length} ligne(s) · édité le ${new Date().toLocaleString('fr-FR')}`),
    largeur - marge,
    marge + 11,
    { align: 'right' },
  )
  doc.setTextColor(0)

  const droite = new Set(options.colonnesADroite ?? [])
  autoTable(doc, {
    startY: marge + 15,
    margin: { left: marge, right: marge, bottom: 12 },
    head: [options.colonnes.map((c) => textePdf(c.titre))],
    body: options.lignes.map((l) => l.map(textePdf)),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak' },
    headStyles: { fillColor: [232, 245, 233], textColor: 30, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 247] },
    columnStyles: Object.fromEntries([...droite].map((i) => [i, { halign: 'right' as const }])),
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, largeur - marge, hauteur - 5, { align: 'right' })
      doc.setTextColor(0)
    },
  })
  doc.save(`${options.nomFichier}.pdf`)
}
