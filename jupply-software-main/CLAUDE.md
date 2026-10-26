# CLAUDE.md — Jupply Software

Instructions pour Claude Code quand il travaille dans ce dépôt.

## Le projet

SaaS de gestion des stocks, ventes et approvisionnements pour PME et commerces
(alternative à coût réduit aux ERP classiques type Odoo, SAP, Microsoft
Dynamics). Porté par Jean Didier Ngoran (non-développeur, Claude est son bras
technique).

## Structure

- `index.html`, `connexion/`, `essai-gratuit/` — site vitrine, maquette visuelle
- `app/` — ancien prototype visuel, remplacé par `app-src/`
- **`app-src/`** — l'application réelle (React + Vite + TypeScript + Tailwind +
  Supabase), là où se passe le travail actif. Voir `app-src/README.md`.
- `docs/` — spécifications fonctionnelles (`CAHIER_DES_CHARGES.md`,
  `GLOSSAIRE.md`) et **charte graphique** (`docs/charte-graphique/`).

## Charte graphique

`docs/charte-graphique/CHARTE_GRAPHIQUE.md` est la référence visuelle unique du
produit (application et, plus tard, site vitrine) : barre latérale repliable
à gauche + onglets de travail, tableaux denses,
palette Light/Dark "Clean SaaS Sage", typo Plus Jakarta Sans, iconographie
outline, densité, composants.

**Règle :** dès qu'une intervention touche au visuel (CSS, classes Tailwind,
nouveau composant, mise en page d'un écran), Claude s'y conforme strictement
(tokens, échelle typo, hauteurs, icônes outline, rendu Light **et** Dark). Si
une demande ponctuelle entre en conflit avec la charte, Claude le signale
avant d'exécuter. L'application est prioritaire ; le site vitrine sera réaligné
plus tard.

## Processus de travail : Plan / Historique

Ce dépôt suit un processus en 4 fichiers, à la racine :

- **`PLAN.md`** — quand Jean Didier déclenche un mode plan et décrit un
  chantier, Claude étudie le code existant en profondeur, réfléchit à
  l'intégration, puis rédige ici un plan détaillé (objectif, analyse de
  l'existant, étapes précises, points de vigilance) **avant** toute
  exécution. Jean Didier le relit pour valider avant que Claude exécute. Le
  format attendu est documenté dans le fichier lui-même.
- **`PLAN_ARCHIVE.md`** — une fois un chantier terminé et vérifié, Claude y
  déplace le plan complet (avec son avancement), et `PLAN.md` redevient vide.
- **`HISTORY.md`** — index toujours à jour : une trace courte par chantier
  (en cours ou terminé), le plus récent en haut. **Toujours consulté** en
  début de session sur ce projet.
- **`HISTORY_ARCHIVE.md`** — détail complet des chantiers terminés. **Jamais
  consulté automatiquement**, seulement à la demande (retrouver un détail
  précis). `HISTORY.md` garde toujours une trace courte qui y pointe.

**Règle d'archivage :** dès qu'un chantier est terminé et vérifié (ex.
fonctionnalité testée en local), Claude archive automatiquement — déplace le
plan vers `PLAN_ARCHIVE.md`, résume dans `HISTORY.md` et détaille dans
`HISTORY_ARCHIVE.md` — puis le signale dans sa réponse. Pas besoin d'une
confirmation explicite de Jean Didier pour archiver.

**Au début d'une session sur ce projet :** lire `HISTORY.md` (jamais
`HISTORY_ARCHIVE.md` sauf besoin précis) et `PLAN.md` pour se remettre à
niveau sur l'état d'avancement avant d'agir.

## Style

Réponses en français, tutoiement, direct et sans blabla. Pas de tirets longs
(em dashes).
