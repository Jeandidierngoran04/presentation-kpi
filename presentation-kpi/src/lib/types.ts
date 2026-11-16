/** Une ligne de l'onglet « Données app » du Google Sheet (format liste). */
export type Ligne = {
  periode: string // date ISO : lundi de la semaine ou 1er jour du mois
  type: 'semaine' | 'mois'
  pays: string // code ISO 2 lettres (CI, CD, TG, BJ...)
  agence?: string
  indicateur: string // id du catalogue
  valeur: number | null
}

/** Rubriques du Sheet, ou KPI créé dans Paramètres (« m:<id> ») */
export type Famille = 'otd' | 'stock' | 'consommables' | 'production' | 'livreurs' | 'autres' | 'reclamations' | `m:${string}`

export type Sens = 'haut' | 'bas'

export type Unite = '%' | 'nb' | '‰' | 'mois' | 'modeles' | 'note'

export type Indicateur = {
  id: string
  libelle: string
  court?: string
  famille: Famille
  unite: Unite
  sens: Sens
  cible: number
  /** Seuil d'alerte : au-delà (sens bas) ou en dessous ou égal (sens haut), c'est rouge. */
  alerte: number
  /** Indicateur ajouté par l'utilisateur dans l'application */
  perso?: boolean
  /** D'où vient l'indicateur ajouté : « saisie » ou « manuel » (KPI de Paramètres) */
  origine?: string
}

export type Statut = 'bon' | 'vigilance' | 'alerte' | 'vide'

export type Seuils = { cible: number; alerte: number }
/** Cible par défaut de chaque indicateur, et éventuellement une cible propre à certains pays */
export type Cibles = Record<string, Seuils & { parPays?: Record<string, Seuils> }>

export type Presentation = {
  id: string
  type: 'hebdo' | 'mensuel'
  /** Source des chiffres : la feuille « Donnée » (Data KPI) ou les KPI saisis dans Paramètres */
  source?: 'sheet' | 'manuel'
  titre: string
  periodes: string[] // dates ISO triées (mode « choisies »)
  /** Mode automatique : les N dernières périodes disponibles dans les données */
  glissant?: number
  /** Diapos facultatives ajoutées à la main (Faits marquants, Divers…), affichées même vides */
  diaposAjoutees?: string[]
  /** Nom affiché sur la diapo de fin */
  auteur?: string
  /** Affichage de l'OTD : tableau (par défaut) ou graphique */
  otdVue?: 'tableau' | 'graphique'
  pays: string[]
  familles: Famille[]
  creeLe: string
  clotureeLe?: string
  /** Photo figée des données et des cibles au moment de la clôture */
  photo?: { lignes: Ligne[]; cibles: Cibles }
  notes?: Notes
}

export type Axe = { id: string; texte: string; pays?: string; responsable?: string; echeance?: string }
export type Probleme = { id: string; texte: string; pays?: string; occurrences?: string; action?: string }

/** Contenu rédigé à la main par l'animateur de la réunion */
export type Notes = {
  divers: { id: string; texte: string }[]
  axes: Axe[]
  problemes: Probleme[]
  /** Faits marquants par pays (une ligne = un point) */
  commentaires?: Record<string, string>
}
