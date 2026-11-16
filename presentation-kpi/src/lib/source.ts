import { useSyncExternalStore } from 'react'
import { ARTICLES, CATALOGUE } from './catalogue'
import { GRILLES_COPIE } from './copieDonnee'
import { lireFeuilles, type Grilles } from './feuilleDonnee'
import { PAYS } from './pays'
import type { Ligne } from './types'

/* ------------------------------------------------------------------ Normalisation */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9+%]+/g, ' ')
    .replace(/\s*\+\s*/g, '+')
    .trim()

/** Libellés acceptés dans le Sheet → id de l'application */
const INDICATEURS = new Map<string, string>()
const ajouter = (id: string, ...noms: string[]) => noms.forEach((n) => INDICATEURS.set(norm(n), id))
CATALOGUE.forEach((i) => ajouter(i.id, i.libelle, i.court ?? i.libelle, i.id))
ajouter('otd', 'OTD', 'On-Time Delivery', 'On time delivery')
ajouter('stock.montures', 'Montures', 'Standard', 'Montures Lapaire', 'Montures standard')
ajouter('stock.lapaire_plus', 'Lapaire +', 'Lapaire+', 'Montures Lapaire +', 'Montures Lapaire+')
ajouter('stock.solaires', 'Solaires', 'Solaire')
ajouter('prod.non_assemblees', 'Affaire non assemblée', 'Affaires non assemblées')
ajouter('liv.moto', 'Conduite & entretien moto', 'Conduite et entretien moto', 'Entretien moto')
ajouter('liv.tournees', 'Respect des tournées', 'Respect tournées')
const SYNONYMES_ARTICLES: Record<string, string[]> = {
  etuis: ['Etuis', 'Etui'],
  etuis_plus: ['Etuis+', 'Etuis +', 'Etui+'],
  sacs: ['Sacs cabas', 'Sac cabas', 'Sacs'],
  sprays: ['Sprays', 'Spray'],
  pochettes: ['Pochettes', 'Pochette'],
}
ARTICLES.forEach((a) =>
  (SYNONYMES_ARTICLES[a.id] ?? [a.libelle]).forEach((n) => {
    ajouter(`couverture.${a.id}`, `Couverture ${n}`, `Couv ${n}`, `Couv. ${n}`)
    ajouter(`stock_conso.${a.id}`, `Stock ${n}`)
  }),
)

const ALIAS_PAYS: Record<string, string> = {
  rdc: 'CD',
  'rd congo': 'CD',
  'congo kinshasa': 'CD',
  'republique democratique du congo': 'CD',
  'congo brazzaville': 'CG',
  'cote d ivoire': 'CI',
  'cote divoire': 'CI',
  ci: 'CI',
}
const INDEX_PAYS = new Map(PAYS.map((p) => [norm(p.nom), p.code]))
const CODES = new Set(PAYS.map((p) => p.code))

export function codePays(nom: string): string | undefined {
  const n = norm(nom)
  if (!n) return undefined
  if (ALIAS_PAYS[n]) return ALIAS_PAYS[n]
  if (INDEX_PAYS.has(n)) return INDEX_PAYS.get(n)
  const up = nom.trim().toUpperCase()
  return CODES.has(up) ? up : undefined
}

export function valeurNombre(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '').trim()
  if (!s) return null
  const u = s.toUpperCase()
  if (u === 'TOP') return 100
  if (u === 'FLOP') return 0
  if (['N/A', 'NA', '-', '—'].includes(u)) return null
  const m = s.replace(/[\s  ]/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

function periodeIso(v: string, type: Ligne['type']): string | undefined {
  let y: number, m: number, d: number
  let r = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]]
  else if ((r = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) [y, m, d] = [+r[3], +r[2], +r[1]]
  else return undefined
  if (type === 'mois') d = 1
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export type LigneBrute = { ligne?: number; periode: string; type: string; pays: string; agence?: string; indicateur: string; valeur: string | number }
export type Rejet = { ligne?: number; raison: string; texte: string }

export function normaliser(brutes: LigneBrute[]) {
  const lignes: Ligne[] = []
  const rejets: Rejet[] = []
  for (const b of brutes) {
    const texte = [b.periode, b.type, b.pays, b.indicateur, b.valeur].join(' · ')
    const t = norm(b.type)
    const type: Ligne['type'] | undefined = t.startsWith('sem') || t.startsWith('hebdo') ? 'semaine' : t.startsWith('mois') || t.startsWith('mens') ? 'mois' : undefined
    if (!type) {
      rejets.push({ ligne: b.ligne, raison: 'Type à écrire « Semaine » ou « Mois »', texte })
      continue
    }
    const periode = periodeIso(String(b.periode), type)
    if (!periode) {
      rejets.push({ ligne: b.ligne, raison: 'Date non reconnue', texte })
      continue
    }
    const pays = codePays(String(b.pays))
    if (!pays) {
      rejets.push({ ligne: b.ligne, raison: `Pays inconnu : « ${b.pays} »`, texte })
      continue
    }
    const indicateur =
      INDICATEURS.get(norm(String(b.indicateur))) ?? CATALOGUE.find((i) => i.perso && norm(i.libelle) === norm(String(b.indicateur)))?.id
    if (!indicateur) {
      rejets.push({ ligne: b.ligne, raison: `Indicateur inconnu : « ${b.indicateur} »`, texte })
      continue
    }
    lignes.push({ periode, type, pays, agence: b.agence?.trim() || undefined, indicateur, valeur: valeurNombre(b.valeur) })
  }
  return { lignes, rejets }
}

/* ------------------------------------------------------------------ Configuration */

export type Config = { url: string; cle: string }
const CLE_CONFIG = 'kpi.source'
const CLE_CACHE = 'kpi.cache'

export function lireConfig(): Config | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLE_CONFIG) ?? 'null') as Config | null
    return c?.url && c?.cle ? c : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ Lecture du Sheet */

export async function lireSheet(c: Config) {
  const url = `${c.url.trim()}${c.url.includes('?') ? '&' : '?'}cle=${encodeURIComponent(c.cle.trim())}`
  let rep: Response
  try {
    rep = await fetch(url, { redirect: 'follow' })
  } catch {
    throw new Error("Impossible de joindre le Google Sheet. Vérifie l'URL et ta connexion Internet.")
  }
  const texte = await rep.text()
  let json: { ok: boolean; erreur?: string; version?: number; fichier?: string; lu?: string; lignes?: LigneBrute[]; feuilles?: Grilles }
  try {
    json = JSON.parse(texte)
  } catch {
    throw new Error("Le lien ne renvoie pas de données. Vérifie que le déploiement est en « Application Web » avec l'accès « Tout le monde ».")
  }
  if (!json.ok) throw new Error(json.erreur ?? 'Erreur inconnue côté Google Sheet.')
  // Version 3 du script : la feuille « Donnée » brute, lue ici. Anciennes versions : lignes déjà préparées.
  const brutes = json.feuilles ? lireFeuilles(json.feuilles) : (json.lignes ?? [])
  return { fichier: json.fichier ?? '', version: json.version ?? 1, ...normaliser(brutes) }
}

/* ------------------------------------------------------------------ Copie de secours */

let copie: Ligne[] | null = null
/** Chiffres de la copie de la feuille « Donnée » (tant que le Sheet n'est pas connecté) */
export const lignesCopie = () => (copie ??= normaliser(lireFeuilles(GRILLES_COPIE)).lignes)

/** À appeler quand la liste des indicateurs change : les lignes du Sheet sont relues et reconnues à nouveau */
export function relireAvecNouveauxIndicateurs() {
  copie = null
  return actualiser()
}

/* ------------------------------------------------------------------ Magasin partagé */

export type EtatDonnees = {
  mode: 'demo' | 'sheet'
  statut: 'ok' | 'chargement' | 'erreur'
  lignes: Ligne[]
  rejets: Rejet[]
  luLe?: string
  fichier?: string
  /** Version du script Google publié (1 = ancien script qui ne lit pas les feuilles) */
  version?: number
  /** Le Sheet répond, mais avec un ancien script : on affiche la copie en attendant */
  ancienScript?: boolean
  erreur?: string
}

function cache(): Partial<EtatDonnees> | null {
  try {
    return JSON.parse(localStorage.getItem(CLE_CACHE) ?? 'null')
  } catch {
    return null
  }
}

function initial(): EtatDonnees {
  if (!lireConfig()) return { mode: 'demo', statut: 'ok', lignes: lignesCopie(), rejets: [] }
  const c = cache()
  return { mode: 'sheet', statut: 'chargement', lignes: c?.lignes ?? [], rejets: c?.rejets ?? [], luLe: c?.luLe, fichier: c?.fichier }
}

let etat: EtatDonnees = initial()
const abonnes = new Set<() => void>()
const publier = (e: EtatDonnees) => {
  etat = e
  abonnes.forEach((f) => f())
}

let enCours: Promise<void> | null = null
export function actualiser(): Promise<void> {
  const c = lireConfig()
  if (!c) {
    publier({ mode: 'demo', statut: 'ok', lignes: lignesCopie(), rejets: [] })
    return Promise.resolve()
  }
  if (enCours) return enCours
  // En quittant la démo, on n'affiche jamais les chiffres de démonstration comme s'ils venaient du Sheet
  publier(etat.mode === 'demo' ? { mode: 'sheet', statut: 'chargement', lignes: [], rejets: [] } : { ...etat, statut: 'chargement' })
  enCours = lireSheet(c)
    .then((r) => {
      if (r.version < 3) {
        // Ancien script encore publié : il ne lit pas la feuille « Donnée ». On montre la copie, avec un avertissement.
        publier({ mode: 'demo', statut: 'ok', lignes: lignesCopie(), rejets: [], fichier: r.fichier, version: r.version, ancienScript: true })
        return
      }
      const e: EtatDonnees = { mode: 'sheet', statut: 'ok', lignes: r.lignes, rejets: r.rejets, fichier: r.fichier, version: r.version, luLe: new Date().toISOString() }
      try {
        localStorage.setItem(CLE_CACHE, JSON.stringify({ lignes: e.lignes, rejets: e.rejets, fichier: e.fichier, luLe: e.luLe }))
      } catch {
        /* cache plein : sans gravité */
      }
      publier(e)
    })
    .catch((err: Error) => publier({ ...etat, statut: 'erreur', erreur: err.message }))
    .finally(() => {
      enCours = null
    })
  return enCours
}

export function enregistrerConfig(c: Config | null) {
  try {
    if (c) localStorage.setItem(CLE_CONFIG, JSON.stringify({ url: c.url.trim(), cle: c.cle.trim() }))
    else {
      localStorage.removeItem(CLE_CONFIG)
      localStorage.removeItem(CLE_CACHE)
    }
  } catch {
    /* stockage indisponible */
  }
  return actualiser()
}

// Lecture au démarrage, puis toutes les 5 minutes
if (typeof window !== 'undefined') {
  if (lireConfig()) actualiser()
  window.setInterval(() => lireConfig() && actualiser(), 5 * 60 * 1000)
}

export function useDonnees() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
}
