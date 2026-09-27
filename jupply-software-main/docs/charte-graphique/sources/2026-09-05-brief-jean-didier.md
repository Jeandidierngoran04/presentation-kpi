# Brief charte graphique - reçu le 05/09/2026

> Copie fidèle du brief transmis par Jean Didier (fichier `gemini-code` +
> précisions dans le message). Sert de source ; la version de travail est
> `../CHARTE_GRAPHIQUE.md`.

---

## Contexte et objectif

Refactorisation complète de l'UI/UX de l'application SaaS B2B / ERP / SIRH
actuelle. Le rendu visuel actuel ne satisfait pas les standards d'ergonomie,
de densité d'information et de modernité requis.

L'application doit adopter une esthétique **"Clean SaaS / AI-Powered"**
inspirée de Google Gemini (clarté, typographie géométrique, légèreté, rondeur
sélective), combinée à une architecture applicative multi-tâche à haute
densité d'information.

Toutes les modifications CSS, Tailwind et de composants doivent se conformer
strictement et sans exception aux règles ci-dessous.

---

## Architecture de navigation (3 niveaux)

Abandon des sidebars classiques au profit d'une navigation horizontale
hiérarchique à 3 niveaux exploitant 100 % de la largeur.

### Level 1 : Top Bar (modules métiers globaux)

- Tout en haut, position fixe (sticky / fixed).
- Navigation entre grands domaines de l'ERP (Magasin, Réceptions/Expéditions,
  Logistique, Ressources Humaines).
- Hauteur compacte (48px maximum).
- Arrière-plan sombre ou très contrasté pour ancrer l'application.
- Typo : 14px, font-weight 600.
- Élément sélectionné : indicateur visuel clair (fond plus clair ou pilule de
  surbrillance).

### Level 2 : Sub-Header (navigation fonctionnelle)

- Directement sous le Level 1.
- Sous-sections / raccourcis du module sélectionné (Dashboard, Produits,
  Entrepôts, Alertes stock).
- Alignement horizontal fluide avec icônes fines + libellés.
- Hauteur : 40px à 44px.
- Icônes : style line-art / outline (1.5px).

### Level 3 : Multi-Tab Workspace (barre d'onglets dynamiques)

- Modèle de navigation d'un navigateur moderne ou d'un IDE (VS Code) :
  plusieurs vues en parallèle sans perte d'état.
- Chaque clic sur un élément du Level 2 ouvre un nouvel onglet s'il n'est pas
  déjà présent ; tout onglet actif passe au premier plan.
- Chaque onglet ouvert (sauf le Dashboard principal) a un bouton de fermeture
  `✕` au survol ou actif.
- Fermer un onglet réoriente vers l'onglet adjacent sans recharger la page.

**Règle UI cruciale - "Inverted Border Radius" :**

- L'onglet ACTIF utilise la même couleur de fond que le conteneur de contenu
  principal (#FFFFFF Light / #111827 Dark).
- Il se fond en continu dans la zone de contenu en dessous via des coins
  arrondis inversés à sa base gauche et droite.
- Les onglets INACTIFS reposent sur le fond du canvas global (#ECEFE6 Light /
  #090D16 Dark) avec une opacité réduite.

---

## Système de couleurs (Light & Dark)

Support natif des deux modes via variables CSS / classes Tailwind `dark:`.

### Palette Light Mode ("Clean SaaS Sage")

- Canvas / fond de page : `#ECEFE6` (vert-gris pastel très doux ; ne pas
  utiliser de blanc pur `#FFFFFF` pour le fond de page).
- Cartes, conteneurs, onglet actif : `#FFFFFF`.
- Accent principal (CTA, actions, statut positif) : `#22C55E` à `#84CC16`
  (vert néon / lime lumineux).
- Accent secondaire (avertissements, risques) : `#F59E0B` (orange ambré).
- Texte principal : `#18181B` (zinc / anthracite très sombre).
- Texte secondaire (labels, subtitles, dates) : `#6B7280` (gris neutre).
- Bordures et séparateurs : `#E5E7EB` (1px ultra-fine).

### Palette Dark Mode ("Deep Night B2B")

- Canvas / fond de page : `#090D16` (bleu-nuit profond ; pas de noir pur
  `#000000`).
- Cartes, conteneurs, onglet actif : `#111827`.
- Accent principal : `#4ADE80` (vert néon adouci).
- Accent secondaire : `#FBBF24` (orange ambré lumineux).
- Texte principal : `#F9FAFB` (blanc cassé).
- Texte secondaire : `#9CA3AF` (gris clair).
- Bordures et séparateurs : `#1F2937` (1px).

---

## Typographie et iconographie

### Typographie (inspiration Google Gemini / Google Sans)

- Famille : exclusivement **Plus Jakarta Sans** ou **Outfit** (Google Fonts).
- Hiérarchie :
  - H1 / titres de pages : 20px, weight 700, line-height 1.2
  - H2 / titres de cartes : 16px, weight 600
  - Sub-header / menus (Level 2) : 14px, weight 600
  - Onglets / corps / inputs : 13px, weight 500
  - Cellules de tableaux / métadonnées : 12px, weight 400
  - Badges / micro-labels : 11px, weight 600, uppercase

### Iconographie

- Bibliothèque : exclusivement **Lucide Icons** ou Google Material Symbols
  (Outlined).
- Uniquement des icônes en lignes (outline / line-art). Interdiction des
  icônes pleines (solid), sauf états de validation spécifiques.
- Épaisseur de trait : 1.5px à 1.75px max.

---

## Densité d'information et composants

### A. Cartes de métriques (KPI dashboards)

- Coins arrondis 12px (`rounded-xl`).
- Fond blanc `#FFFFFF` Light / anthracite `#111827` Dark.
- Paddings compacts (16px).
- Icônes d'illustration logées dans de petites puces circulaires ou carrées
  très arrondies, aux couleurs pastel de l'accent (fond vert très clair +
  icône verte).

### B. Tableaux de données (data grids)

- Hauteur de ligne compacte (36px à 42px).
- Header : fond légèrement teinté, texte majuscules 11-12px, weight 600,
  couleur secondaire.
- Lignes : séparateur fin 1px.
- Hover : légère surbrillance (`bg-black/5` Light / `bg-white/5` Dark).
- Micro-interactions : prise en charge visuelle du clic droit (menu
  contextuel) et du double-clic (fiche rapide).

### C. Formulaires et champs de saisie

- Rayon : 8px (`rounded-md` / `rounded-lg`).
- Focus : pas de bordure noire ou bleue par défaut. Halo d'accent vert
  (`ring-2 ring-emerald-500/30 border-emerald-500`).
- Boutons principaux : accent vert néon + texte sombre (contraste maximal).
- Badges de statut : capsule complète (`rounded-full` / 9999px).

---

## Instructions d'exécution (du brief)

1. Analyser la structure actuelle des composants (navigation, tableaux,
   conteneurs principaux).
2. Refactoriser le layout : structure 3 niveaux (Top Bar > Sub-Header >
   Multi-Tab Workspace avec inverted radius).
3. Appliquer le système de design : variables de couleurs (Light & Dark),
   typo Plus Jakarta Sans, règles d'arrondis dans le CSS global / `@theme`.
4. Optimiser la densité : réduire les espacements exagérés pour afficher plus
   de données tout en gardant la lisibilité épurée style Gemini.

---

## Précisions de Jean Didier (message du 05/09/2026)

- La charte s'applique à l'application ET au site vitrine, mais **on se
  concentre d'abord sur l'application**. Le site vitrine sera réaligné plus
  tard.
- Claude est libre de la structure du dossier de documentation, du moment que
  le résultat respecte les standards d'un développement professionnel.
- Après rangement et prise de connaissance, on enchaîne sur la refonte du
  visuel de l'application.
