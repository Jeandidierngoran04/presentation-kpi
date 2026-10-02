// Bon de sortie au format PDF, sur le modèle AIRSTOCK : il sert de fiche de
// préparation au magasinier (lignes triées par localisation, sans prix).
import type { BonSortieHistorique, LigneBonSortie } from '../api/historique'
import { getNomEntreprise } from '../api/historique'

function texte(valeur: string | null | undefined): string {
  return valeur && valeur.trim() ? valeur : '-'
}

function dateCourte(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : '-'
}

/** Tri "tournée du magasinier" : par localisation, puis par référence. */
function ordreDeTournee(a: LigneBonSortie, b: LigneBonSortie): number {
  return (
    (a.emplacement_code ?? '').localeCompare(b.emplacement_code ?? '', 'fr', { numeric: true }) ||
    a.produit_reference.localeCompare(b.produit_reference, 'fr', { numeric: true })
  )
}

/**
 * Génère le bon et l'ouvre dans un nouvel onglet du navigateur (imprimer ou
 * enregistrer depuis la visionneuse). L'onglet est ouvert tout de suite, au
 * moment du clic, pour ne pas être bloqué comme fenêtre surgissante.
 */
export async function ouvrirBonSortiePdf(
  bon: BonSortieHistorique,
  lignes: LigneBonSortie[],
  fenetreOuverte?: Window | null,
): Promise<void> {
  // Si l'appelant a dû charger des données avant, il a ouvert l'onglet lui-même au clic.
  const fenetre = fenetreOuverte !== undefined ? fenetreOuverte : window.open('', '_blank')
  try {
    const [{ jsPDF }, { default: autoTable }, entreprise] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      getNomEntreprise(),
    ])

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const largeur = doc.internal.pageSize.getWidth()
    const hauteur = doc.internal.pageSize.getHeight()
    const marge = 12
    const gris = 90

    doc.setProperties({ title: `Bon de sortie ${bon.numero}` })
    doc.setDrawColor(40)
    doc.setLineWidth(0.4)

    // Cadre d'en-tête
    doc.rect(marge, marge, largeur - 2 * marge, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('BON DE SORTIE / ISSUE', largeur - marge - 4, marge + 9, { align: 'right' })
    doc.setLineWidth(0.6)
    doc.line(largeur / 2 - 10, marge + 12, largeur - marge - 4, marge + 12)
    doc.setLineWidth(0.4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(dateCourte(bon.cree_le), largeur - marge - 4, marge + 16, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(bon.numero, largeur / 2 + 10, marge + 20, { align: 'center' })
    doc.text(dateCourte(bon.cree_le), largeur / 2 + 10, marge + 26, { align: 'center' })
    doc.setFontSize(11)
    doc.text(texte(entreprise), marge + 4, marge + 9)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Dépôt : ${texte(bon.entrepot_nom)}`, marge + 4, marge + 15)

    // Bloc motif / affectation
    doc.setFillColor(255, 255, 255)
    doc.rect(marge, marge + 34, 110, 8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(texte(bon.motif).toUpperCase(), marge + 55, marge + 39.5, { align: 'center' })

    // Lignes
    const lignesTriees = [...lignes].sort(ordreDeTournee)
    autoTable(doc, {
      startY: marge + 46,
      margin: { left: marge, right: marge, bottom: 40 },
      head: [['Loca', 'Référence', 'Désignation', 'N° de série', 'N° de lot', 'Expiration', 'Qté']],
      body: lignesTriees.map((l) => [
        texte(l.emplacement_code),
        l.produit_reference,
        l.produit_designation,
        texte(l.numero_serie),
        texte(l.lot),
        l.date_expiration ? dateCourte(l.date_expiration) : '-',
        l.quantite.toLocaleString('fr-FR'),
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, lineColor: 200, lineWidth: 0.1, textColor: 20 },
      headStyles: { fillColor: [gris, gris, gris], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 36 },
        3: { cellWidth: 34 },
        4: { cellWidth: 34 },
        5: { cellWidth: 24 },
        6: { cellWidth: 18, halign: 'right' },
      },
    })

    // Total
    const finTableau = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Qté sortie : ${bon.quantite_totale.toLocaleString('fr-FR')}`, largeur - marge, finTableau + 6, {
      align: 'right',
    })

    // Cadres de signature, en bas de la dernière page
    let y = hauteur - 36
    if (finTableau + 12 > y) {
      doc.addPage()
      y = hauteur - 36
    }
    const largeurCadre = 120
    const cadres: [number, string, string][] = [
      [marge, 'ÉMIS PAR / ISSUED BY', texte(bon.emis_par_nom)],
      [largeur - marge - largeurCadre, 'REÇU PAR / GIVEN TO', texte(bon.recu_par)],
    ]
    for (const [x, titre, nom] of cadres) {
      doc.rect(x, y, largeurCadre, 20)
      doc.line(x, y + 7, x + largeurCadre / 2, y + 7)
      doc.line(x + largeurCadre / 2, y, x + largeurCadre / 2, y + 20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(titre, x + largeurCadre / 4, y + 4.8, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(nom, x + largeurCadre / 4, y + 14, { align: 'center' })
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text('Signature', x + (3 * largeurCadre) / 4, y + 4.8, { align: 'center' })
      doc.setTextColor(0)
    }

    // Pied de page sur chaque page
    const nbPages = doc.getNumberOfPages()
    for (let page = 1; page <= nbPages; page++) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(110)
      doc.text('Jupply', marge, hauteur - 8)
      doc.text(`Page ${page} sur ${nbPages}`, largeur / 2, hauteur - 8, { align: 'center' })
      doc.text(`BON DE SORTIE / ISSUE  ${bon.numero}`, largeur - marge, hauteur - 8, { align: 'right' })
      doc.setTextColor(0)
    }

    const url = doc.output('bloburl').toString()
    if (fenetre) fenetre.location.href = url
    else doc.save(`${bon.numero}.pdf`)
  } catch (erreur) {
    fenetre?.close()
    throw erreur
  }
}
