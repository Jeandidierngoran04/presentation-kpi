import { toCanvas } from 'html-to-image'
import { HAUTEUR, LARGEUR } from '../components/CadreDiapo'

/** Photographie chaque diapo (rendue hors écran à taille réelle 1600 × 900). */
export async function capturer(noeuds: HTMLElement[], format: 'png' | 'jpeg', progression: (n: number) => void) {
  await document.fonts.ready
  const images: string[] = []
  for (let i = 0; i < noeuds.length; i++) {
    const c = await toCanvas(noeuds[i], { width: LARGEUR, height: HAUTEUR, pixelRatio: 1.5, cacheBust: true })
    images.push(format === 'png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9))
    progression(i + 1)
  }
  return images
}

const nomFichier = (titre: string) =>
  titre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'presentation'

export async function exporterPptx(images: string[], titre: string, titres: string[]) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13,33 × 7,5 pouces = 16:9
  pptx.title = titre
  images.forEach((img, i) => {
    const s = pptx.addSlide()
    s.addImage({ data: img, x: 0, y: 0, w: 13.333, h: 7.5 })
    s.addNotes(titres[i] ?? '')
  })
  await pptx.writeFile({ fileName: `${nomFichier(titre)}.pptx` })
}

export async function exporterPdf(images: string[], titre: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [LARGEUR, HAUTEUR], hotfixes: ['px_scaling'] })
  images.forEach((img, i) => {
    if (i > 0) doc.addPage([LARGEUR, HAUTEUR], 'landscape')
    doc.addImage(img, 'JPEG', 0, 0, LARGEUR, HAUTEUR, undefined, 'FAST')
  })
  doc.save(`${nomFichier(titre)}.pdf`)
}
