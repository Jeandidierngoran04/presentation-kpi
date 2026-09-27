// Chaines de classes partagees, calees sur la charte graphique
// (docs/charte-graphique/CHARTE_GRAPHIQUE.md). A privilegier dans les
// formulaires denses ou les composants <Bouton>/<Champ> alourdiraient le JSX.

/** Champ de saisie standard (H1 de formulaire, hauteur confortable). */
export const CLASSE_CHAMP =
  'w-full bg-card border border-border rounded-lg px-3 h-9 text-[13px] text-text outline-none transition-colors ' +
  'placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

/** Champ de saisie compact (formulaires tres denses facon AIRSTOCK). */
export const CLASSE_CHAMP_COMPACT =
  'w-full bg-card border border-border rounded-lg px-2 h-[26px] text-xs text-text outline-none transition-colors ' +
  'placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 ' +
  'disabled:opacity-60 disabled:bg-muted disabled:text-text-muted'

/** Valeur affichee en lecture seule dans un formulaire dense. */
export const CLASSE_CHAMP_LECTURE =
  'bg-muted rounded-lg px-2 h-[26px] flex items-center text-xs text-text'

/** Petit label de champ, en capitales. */
export const CLASSE_LABEL =
  'text-[10px] font-semibold text-text-muted uppercase tracking-wide leading-none'

/** Bouton principal (accent vert, texte sombre). */
export const CLASSE_BOUTON_PRIMAIRE =
  'inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-strong text-accent-contrast ' +
  'text-[13px] font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-60 disabled:pointer-events-none'

/** Bouton principal compact (dans un tableau, une barre d'actions). */
export const CLASSE_BOUTON_PRIMAIRE_PETIT =
  'inline-flex items-center justify-center gap-1 bg-accent hover:bg-accent-strong text-accent-contrast ' +
  'text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60 disabled:pointer-events-none'

/** Bouton secondaire (bordure, fond carte). */
export const CLASSE_BOUTON_SECONDAIRE =
  'inline-flex items-center justify-center gap-1.5 bg-card border border-border hover:bg-muted text-text ' +
  'text-[13px] font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-60 disabled:pointer-events-none'
