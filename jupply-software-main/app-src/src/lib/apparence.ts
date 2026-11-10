import { supabase } from './supabase'

/**
 * Apparence de l'entreprise (Paramètre > Administration). Chaque champ absent
 * garde la valeur de la charte graphique Jupply (voir DEFAUTS et index.css).
 */
export interface Apparence {
  // Identité
  logoType?: 'image' | 'initiale'
  /** Image en data URL (réduite à l'envoi). */
  logoImage?: string | null
  logoHauteur?: number
  logoHauteurReduite?: number
  afficherLogo?: boolean
  afficherNom?: boolean

  // Couleurs
  couleurPrincipale?: string
  couleurSecondaire?: string
  couleurFond?: string
  couleurCartes?: string
  couleurTexte?: string

  // Barre latérale
  navFond?: string
  navSurvol?: string
  navActif?: string
  navLargeur?: number
  navTaille?: number
  navHauteurLigne?: number

  // Tableaux et formes
  tableTaille?: number
  tableHauteurLigne?: number
  tableEnteteTaille?: number
  coins?: number
  margeContenu?: number

  // Typographie
  titreTaille?: number
  titrePolice?: string
  titreGraisse?: number | null
  textePolice?: string
}

/** Valeurs de la charte (mode clair), affichées quand rien n'est personnalisé. */
export const DEFAUTS: Required<Omit<Apparence, 'logoImage' | 'titreGraisse'>> & { logoImage: null; titreGraisse: null } = {
  logoType: 'initiale',
  logoImage: null,
  logoHauteur: 28,
  logoHauteurReduite: 28,
  afficherLogo: true,
  afficherNom: false,
  couleurPrincipale: '#22C55E',
  couleurSecondaire: '#84CC16',
  couleurFond: '#ECEFE6',
  couleurCartes: '#FFFFFF',
  couleurTexte: '#18181B',
  navFond: '#FFFFFF',
  navSurvol: '#F3F4F1',
  navActif: '#ECEEE9',
  navLargeur: 240,
  navTaille: 13.5,
  navHauteurLigne: 34,
  tableTaille: 12.5,
  tableHauteurLigne: 34,
  tableEnteteTaille: 11.5,
  coins: 8,
  margeContenu: 12,
  titreTaille: 18,
  titrePolice: 'Plus Jakarta Sans',
  titreGraisse: null,
  textePolice: 'Plus Jakarta Sans',
}

export function valeur<K extends keyof Apparence>(a: Apparence, cle: K): NonNullable<Apparence[K]> {
  return (a[cle] ?? DEFAUTS[cle]) as NonNullable<Apparence[K]>
}

export const POLICES = [
  'Plus Jakarta Sans',
  'Inter',
  'Inter Tight',
  'DM Sans',
  'Manrope',
  'Poppins',
  'Montserrat',
  'Roboto',
  'Open Sans',
  'Lato',
  'Nunito',
  'Source Sans 3',
  'Work Sans',
  'IBM Plex Sans',
]

/** Palettes proposées par « Changer de palette » (principale, secondaire, fond, cartes, texte). */
export const PALETTES: { nom: string; couleurs: Pick<Apparence, 'couleurPrincipale' | 'couleurSecondaire' | 'couleurFond' | 'couleurCartes' | 'couleurTexte'> }[] = [
  { nom: 'Jupply', couleurs: { couleurPrincipale: '#22C55E', couleurSecondaire: '#84CC16', couleurFond: '#ECEFE6', couleurCartes: '#FFFFFF', couleurTexte: '#18181B' } },
  { nom: 'Prune', couleurs: { couleurPrincipale: '#714B67', couleurSecondaire: '#E9C9A8', couleurFond: '#F3F1EF', couleurCartes: '#FFFFFF', couleurTexte: '#1F1720' } },
  { nom: 'Océan', couleurs: { couleurPrincipale: '#0E7490', couleurSecondaire: '#38BDF8', couleurFond: '#EAF2F5', couleurCartes: '#FFFFFF', couleurTexte: '#0F172A' } },
  { nom: 'Indigo', couleurs: { couleurPrincipale: '#4F46E5', couleurSecondaire: '#A78BFA', couleurFond: '#EEEFF7', couleurCartes: '#FFFFFF', couleurTexte: '#111827' } },
  { nom: 'Ambre', couleurs: { couleurPrincipale: '#D97706', couleurSecondaire: '#FBBF24', couleurFond: '#F6F1E7', couleurCartes: '#FFFFFF', couleurTexte: '#1C1917' } },
  { nom: 'Corail', couleurs: { couleurPrincipale: '#E11D48', couleurSecondaire: '#FB923C', couleurFond: '#F7EFEF', couleurCartes: '#FFFFFF', couleurTexte: '#1F1315' } },
  { nom: 'Ardoise', couleurs: { couleurPrincipale: '#334155', couleurSecondaire: '#94A3B8', couleurFond: '#EEF0F3', couleurCartes: '#FFFFFF', couleurTexte: '#0F172A' } },
  { nom: 'Forêt', couleurs: { couleurPrincipale: '#166534', couleurSecondaire: '#CA8A04', couleurFond: '#EEF1EA', couleurCartes: '#FFFFFF', couleurTexte: '#14211A' } },
]

// ---------- Couleurs ----------

function versRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const plein = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  return [0, 2, 4].map((i) => parseInt(plein.slice(i, i + 2), 16) || 0) as [number, number, number]
}

function versHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

/** Mélange `couleur` avec `avec` : part = part de `avec` (0 à 1). */
export function melanger(couleur: string, avec: string, part: number): string {
  const a = versRgb(couleur)
  const b = versRgb(avec)
  return versHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * part) as [number, number, number])
}

function luminance(hex: string): number {
  const [r, g, b] = versRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Texte lisible posé sur la couleur (bouton principal). */
function contraste(hex: string): string {
  return luminance(hex) > 0.4 ? melanger(hex, '#000000', 0.78) : '#FFFFFF'
}

// ---------- CSS appliqué ----------

const px = (n: number) => `${n}px`
const pile = (police: string) => `'${police}', system-ui, -apple-system, sans-serif`

/** Feuille de style qui surcharge la charte (uniquement ce qui est personnalisé). */
export function cssApparence(a: Apparence): string {
  const commun: string[] = []
  const clair: string[] = []
  const sombre: string[] = []
  const regles: string[] = []

  if (a.couleurPrincipale) {
    const p = a.couleurPrincipale
    commun.push(`--accent:${p}`, `--accent-contrast:${contraste(p)}`)
    clair.push(`--accent-soft:${melanger(p, '#FFFFFF', 0.84)}`, `--accent-deep:${melanger(p, '#000000', 0.3)}`)
    sombre.push(`--accent-soft:${melanger(p, '#000000', 0.72)}`, `--accent-deep:${melanger(p, '#FFFFFF', 0.25)}`)
  }
  if (a.couleurSecondaire) commun.push(`--accent-strong:${a.couleurSecondaire}`)
  // Fonds et texte : mode clair seulement, le mode sombre garde ses teintes lisibles.
  if (a.couleurFond) clair.push(`--canvas:${a.couleurFond}`, `--muted:${melanger(a.couleurFond, '#FFFFFF', 0.45)}`)
  if (a.couleurCartes) clair.push(`--card:${a.couleurCartes}`)
  if (a.couleurTexte) clair.push(`--text:${a.couleurTexte}`)
  if (a.navFond) clair.push(`--nav-fond:${a.navFond}`)
  if (a.navSurvol) clair.push(`--nav-survol:${a.navSurvol}`)
  if (a.navActif) clair.push(`--nav-actif:${a.navActif}`)

  if (a.navLargeur != null) commun.push(`--sidebar-width:${px(a.navLargeur)}`)
  if (a.navTaille != null) commun.push(`--nav-font-size:${px(a.navTaille)}`, `--nav-sub-font-size:${px(a.navTaille - 0.5)}`)
  if (a.navHauteurLigne != null) commun.push(`--nav-item-height:${px(a.navHauteurLigne)}`, `--nav-sub-item-height:${px(a.navHauteurLigne - 4)}`)
  if (a.tableTaille != null) commun.push(`--table-font-size:${px(a.tableTaille)}`)
  if (a.tableHauteurLigne != null) commun.push(`--table-row-height:${px(a.tableHauteurLigne)}`)
  if (a.tableEnteteTaille != null) commun.push(`--table-head-font-size:${px(a.tableEnteteTaille)}`)
  if (a.margeContenu != null) commun.push(`--content-padding:${px(a.margeContenu)}`)
  if (a.titreTaille != null) commun.push(`--page-title-size:${px(a.titreTaille)}`)
  if (a.coins != null) {
    // Les arrondis Tailwind lisent ces variables.
    const c = a.coins
    commun.push(`--radius-sm:${px(Math.round(c * 0.5))}`, `--radius-md:${px(Math.round(c * 0.75))}`, `--radius-lg:${px(c)}`, `--radius-xl:${px(Math.round(c * 1.5))}`)
  }

  if (a.textePolice) regles.push(`body{font-family:${pile(a.textePolice)}}`)
  const titre: string[] = []
  if (a.titrePolice) titre.push(`font-family:${pile(a.titrePolice)}`)
  if (a.titreGraisse) titre.push(`font-weight:${a.titreGraisse}`)
  if (titre.length) regles.push(`h1,h2,h3{${titre.join(';')}}`)

  return [
    commun.length ? `:root{${commun.join(';')}}` : '',
    clair.length ? `:root:not(.dark){${clair.join(';')}}` : '',
    sombre.length ? `:root.dark{${sombre.join(';')}}` : '',
    ...regles,
  ].join('\n')
}

/** Charge une police Google si elle n'est pas déjà chargée. */
export function chargerPolice(police: string | undefined) {
  if (!police || police === DEFAUTS.textePolice) return
  const id = `police-${police.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(id)) return
  const lien = document.createElement('link')
  lien.id = id
  lien.rel = 'stylesheet'
  lien.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(police).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  document.head.appendChild(lien)
}

// ---------- Logo ----------

/** Réduit une image (hauteur max 160 px) et la renvoie en data URL ; les SVG sont gardés tels quels. */
export function lireLogo(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    if (!fichier.type.startsWith('image/')) {
      rejeter(new Error('Choisis une image (PNG, JPG, SVG ou WebP).'))
      return
    }
    const lecteur = new FileReader()
    lecteur.onerror = () => rejeter(new Error('Image illisible.'))
    lecteur.onload = () => {
      const source = lecteur.result as string
      if (fichier.type === 'image/svg+xml') {
        if (source.length > 400_000) rejeter(new Error('Logo SVG trop lourd.'))
        else resoudre(source)
        return
      }
      const image = new Image()
      image.onerror = () => rejeter(new Error('Image illisible.'))
      image.onload = () => {
        const echelle = Math.min(1, 160 / image.height, 640 / image.width)
        const toile = document.createElement('canvas')
        toile.width = Math.max(1, Math.round(image.width * echelle))
        toile.height = Math.max(1, Math.round(image.height * echelle))
        toile.getContext('2d')!.drawImage(image, 0, 0, toile.width, toile.height)
        resoudre(toile.toDataURL('image/png'))
      }
      image.src = source
    }
    lecteur.readAsDataURL(fichier)
  })
}

/** Poids d'une data URL, en ko. */
export function poidsKo(dataUrl: string | null | undefined): number {
  if (!dataUrl) return 0
  const virgule = dataUrl.indexOf(',')
  const base64 = dataUrl.slice(virgule + 1)
  const octets = dataUrl.startsWith('data:image/svg') ? decodeURIComponent(base64).length : Math.floor((base64.length * 3) / 4)
  return Math.round((octets / 1024) * 10) / 10
}

// ---------- Base ----------

export async function getApparence(): Promise<{ nom: string; apparence: Apparence }> {
  const { data, error } = await supabase.from('entreprises').select('nom, apparence').single()
  if (!error) return { nom: data.nom, apparence: (data.apparence ?? {}) as Apparence }
  // Migration pas encore appliquée : le nom seul, apparence de la charte.
  const repli = await supabase.from('entreprises').select('nom').single()
  if (repli.error) throw repli.error
  return { nom: repli.data.nom, apparence: {} }
}

export async function enregistrerApparence(nom: string, apparence: Apparence): Promise<void> {
  const { error } = await supabase.rpc('enregistrer_apparence', { p_nom: nom, p_apparence: apparence })
  if (error) throw error
}
