# Charte graphique Jupply

> Référence visuelle unique du produit Jupply (application `app-src/` et, plus
> tard, site vitrine). Toute intervention sur le CSS, Tailwind ou un composant
> visuel doit s'y conformer strictement.
>
> Établie le 05/09/2026 à partir du brief de Jean Didier
> (`sources/2026-09-05-brief-jean-didier.md`).
> Périmètre prioritaire aujourd'hui : l'application. Le site vitrine sera
> réaligné quand on y reviendra.

---

## 1. Direction artistique

Esthétique **"Clean SaaS / AI-Powered"**, inspirée de Google Gemini :

- Clarté, légèreté, beaucoup de respiration maîtrisée mais **haute densité
  d'information** (c'est un ERP, on affiche beaucoup de données).
- Typographie géométrique, ronde et lisible.
- Rondeur **sélective** : les conteneurs et badges sont arrondis, pas tout.
- Palette douce (pas de blanc pur en fond, pas de noir pur en fond sombre),
  un seul accent vif (vert lime).
- Iconographie fine, uniquement en traits (outline).
- Support natif **Light Mode et Dark Mode**.

Ce qu'on évite : dégradés violets, ombres lourdes, icônes pleines, bordures
épaisses, halos bleus de focus par défaut, sidebars encombrantes.

---

## 2. Architecture de navigation (3 niveaux)

Navigation **horizontale hiérarchique**, pas de sidebar. On exploite 100 % de
la largeur.

```
+------------------------------------------------------------------+
| LEVEL 1 : TOP BAR - Modules métiers globaux           (sticky)   |
+------------------------------------------------------------------+
| LEVEL 2 : SUB-HEADER - Menu fonctionnel du module actif          |
+------------------------------------------------------------------+
| LEVEL 3 : MULTI-TAB WORKSPACE - Onglets dynamiques (inverted radius)
+--------------------------+---------------------------------------+
|                                                                  |
|   CONTENU PRINCIPAL DE LA VUE ACTIVE                              |
|   (cartes blanches / conteneur principal)                        |
|                                                                  |
+------------------------------------------------------------------+
```

Le schéma d'origine est dans `assets/` (`layout-3-niveaux.png`).

### Level 1 - Top Bar (modules métiers globaux)

Une **seule ligne** en haut de l'écran, position fixe (`sticky`), qui réunit
tout ce qui est global à l'application. De gauche à droite :

1. Logo + nom Jupply.
2. **Navigation entre grands domaines de l'ERP** (Magasin, Réceptions/
   Expéditions, Logistique, Ressources Humaines...), sous forme de pilules,
   sur la même ligne que le logo (référence : les onglets pilules du haut de
   la maquette Stratum AI).
3. Zone de recherche globale.
4. Bouton de bascule Light / Dark Mode.
5. Icône de notifications (pastille quand non lu).
6. Avatar du compte connecté, **cliquable** : ouvre un menu déroulant qui
   contient la déconnexion (« Sortie ») et, plus tard, les autres options du
   compte (profil, préférences...).

- Hauteur compacte : **48px maximum**.
- Fond sombre ou très contrasté pour ancrer l'application (même en Light Mode).
- Typo des pilules de modules : 14px, `font-weight: 600`.
- Module sélectionné : indicateur clair (pilule de surbrillance, fond plus
  clair).
- Le bouton de déconnexion n'est plus affiché en permanence : il vit dans le
  menu de l'avatar.

### Level 2 - Sub-Header (navigation fonctionnelle)

- Directement sous le Level 1.
- Sous-sections du module choisi au Level 1 : Dashboard, Produits, Entrepôts,
  Alertes stock...
- Hauteur : **40px à 44px**.
- Alignement horizontal fluide : icône fine + libellé.
- Icônes : style line-art, trait 1.5px.

### Level 3 - Multi-Tab Workspace (onglets dynamiques)

Modèle de navigation d'un navigateur moderne ou d'un IDE (VS Code) : plusieurs
vues ouvertes en parallèle, chacune garde son état.

Comportement :

- Un clic sur un élément du Level 2 ouvre un onglet au Level 3 s'il n'existe
  pas déjà, sinon il passe au premier plan.
- Chaque onglet (sauf le Dashboard principal) a un bouton de fermeture `✕`
  au survol ou à l'état actif.
- Fermer un onglet renvoie vers l'onglet adjacent, sans rechargement de page.

**Règle UI cruciale - "Inverted Border Radius" :**

- L'onglet **actif** utilise **la même couleur de fond que le conteneur de
  contenu principal** (`#FFFFFF` en Light, `#111827` en Dark).
- Il se fond en continu dans la zone de contenu en dessous, via des **coins
  arrondis inversés** à sa base gauche et droite.
- Les onglets **inactifs** reposent sur le fond du canvas global (`#ECEFE6`
  en Light, `#090D16` en Dark), avec une opacité réduite.

---

## 3. Couleurs

Toujours via variables CSS / tokens, jamais de hex en dur dans un composant.
Nom de token proposé entre parenthèses (à figer lors du chantier de refonte).

### Light Mode - "Clean SaaS Sage"

| Rôle | Hex | Token |
| --- | --- | --- |
| Canvas / fond de page (jamais `#FFFFFF`) | `#ECEFE6` | `canvas` |
| Cartes, conteneurs, onglet actif | `#FFFFFF` | `card` |
| Zone légèrement teintée (header de tableau, champ en lecture, puce) | `#F4F6F0` | `muted` |
| Accent principal (CTA, actions, statut positif) | `#22C55E` à `#84CC16` | `accent` / `accent-strong` |
| Fond pastel de l'accent (puces d'icônes, ligne sélectionnée) | `#DCFCE7` | `accent-soft` |
| Accent secondaire (avertissements, risques) | `#F59E0B` | `warn` |
| Erreur | `#DC2626` | `danger` |
| Texte principal (titres, corps, données) | `#18181B` | `text` |
| Texte secondaire (labels, sous-titres, dates) | `#6B7280` | `text-muted` |
| Bordures et séparateurs (1px) | `#E5E7EB` | `border` |

### Dark Mode - "Deep Night B2B"

| Rôle | Hex | Token |
| --- | --- | --- |
| Canvas / fond de page (jamais `#000000`) | `#090D16` | `canvas` |
| Cartes, conteneurs, onglet actif | `#111827` | `card` |
| Zone légèrement teintée | `#161F30` | `muted` |
| Accent principal (adouci, anti-éblouissement) | `#4ADE80` | `accent` |
| Fond pastel de l'accent | `#14311F` | `accent-soft` |
| Accent secondaire | `#FBBF24` | `warn` |
| Erreur | `#F87171` | `danger` |
| Texte principal | `#F9FAFB` | `text` |
| Texte secondaire | `#9CA3AF` | `text-muted` |
| Bordures et séparateurs (1px) | `#1F2937` | `border` |

### Règles couleur

- Fond de page : jamais blanc pur en Light, jamais noir pur en Dark.
- Un seul accent vif dans l'UI : le vert. L'ambre est réservé aux
  avertissements et risques.
- Boutons principaux : fond accent vert + **texte sombre** (`#18181B`) pour un
  contraste maximal, pas de texte blanc sur vert.
- Puces d'icônes dans les cartes : fond pastel de l'accent (vert très clair) +
  icône verte.
- États sémantiques dérivés de l'accent/warn : succès = vert accent,
  alerte/risque = ambre, erreur = rouge (à définir, non fourni par le brief -
  garder un rouge sobre type `#DC2626` / `#F87171`).

---

## 4. Typographie

**Famille unique : `Plus Jakarta Sans`** (alternative acceptée : `Outfit`),
importée depuis Google Fonts. Inspiration Google Sans / Gemini.

Fallback : `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`.

| Usage | Taille | Poids | Interligne |
| --- | --- | --- | --- |
| H1 / titre de page | 20px | 700 | 1.2 |
| H2 / titre de carte | 16px | 600 | - |
| Sub-header / menus (Level 2) | 14px | 600 | - |
| Onglets / corps de texte / inputs | 13px | 500 | - |
| Cellules de tableau / métadonnées | 12px | 400 | - |
| Badges / micro-labels | 11px | 600 | `uppercase`, `letter-spacing` léger |

Une seule famille pour tout. `Space Grotesk` (actuellement utilisé pour les
titres et le logo) est abandonné, sauf éventuellement le lettrage du logo si
on le décide explicitement.

---

## 5. Iconographie

- Bibliothèque : **Lucide** (`lucide-react`, déjà installé) ou Google Material
  Symbols (Outlined).
- **Uniquement des icônes en traits (outline / line-art).** Pas d'icônes
  pleines (solid), sauf états de validation très spécifiques.
- Épaisseur de trait : **1.5px à 1.75px** (`strokeWidth={1.5}` à `1.75`).
- Tailles courantes en UI dense : 14 à 16px dans les tableaux et menus, 18 à
  20px pour les entêtes.

---

## 6. Composants

### A. Cartes de métriques (KPI dashboard)

- Coins arrondis **12px** (`rounded-xl`).
- Fond `surface` (`#FFFFFF` Light / `#111827` Dark).
- Padding compact : **16px**.
- Icône d'illustration logée dans une petite puce circulaire ou carrée très
  arrondie, en couleur pastel de l'accent (fond vert très clair + icône
  verte).

### B. Tableaux de données (data grids)

- Hauteur de ligne compacte : **36px à 42px**.
- Header : fond légèrement teinté, texte `uppercase` 11-12px, `font-weight:
  600`, couleur `text-muted`.
- Séparateur de ligne : 1px `border`.
- Hover ligne : légère surbrillance (`bg-black/5` en Light, `bg-white/5` en
  Dark).
- Prise en charge visuelle du **clic droit** (menu contextuel) et du
  **double-clic** (ouverture de fiche rapide).

### C. Formulaires et champs de saisie

- Rayon : **8px** (`rounded-lg`).
- Focus : **pas de bordure noire ni bleue**. Halo d'accent vert :
  `ring-2 ring-accent/30` + `border-accent`.

### D. Boutons

- Bouton principal : fond accent vert, **texte sombre**, `rounded-lg`.
- Hover : nuance d'accent légèrement plus soutenue.
- Bouton secondaire : fond `surface` ou transparent, bordure `border`, texte
  `text`.
- Désactivé : `opacity` réduite, pas de changement de couleur.

### E. Badges de statut

- Forme **capsule complète** (`rounded-full`, radius 9999px).
- Texte 11px, `font-weight: 600`, `uppercase`.
- Couleur portée par un fond pastel + texte de la même teinte (vert / ambre /
  rouge selon le statut).

### F. Onglets (Level 3)

Voir section 2. Points clés : onglet actif = couleur du contenu + inverted
border radius ; onglets inactifs = couleur canvas + opacité réduite.

---

## 7. Rayons, ombres, densité

| Élément | Valeur |
| --- | --- |
| Cartes, KPI, conteneurs | 12px (`rounded-xl`) |
| Inputs, boutons | 8px (`rounded-lg`) |
| Badges, pilules | 9999px (`rounded-full`) |
| Onglet actif (coins inversés) | ~8 à 10px |
| Padding carte | 16px |
| Hauteur Top Bar (Level 1) | 48px max |
| Hauteur Sub-Header (Level 2) | 40 à 44px |
| Hauteur ligne de tableau | 36 à 42px |
| Bordures | 1px, couleur `border` |

Ombres : discrètes voire absentes. On sépare l'information par la couleur
(carte blanche sur canvas sage), pas par des ombres portées marquées.

Densité : réduire les espacements exagérés pour afficher plus de données, tout
en gardant la lisibilité épurée style Gemini.

---

## 8. Traduction technique (Tailwind v4)

Le projet utilise Tailwind v4 avec `@theme` dans `app-src/src/index.css` (pas
de `tailwind.config.js`). Cible pour la refonte :

Implémenté au palier 0 (voir `PLAN.md`). Structure retenue dans
`app-src/src/index.css` :

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  color-scheme: light;
  --canvas: #ECEFE6;  --card: #FFFFFF;  --muted: #F4F6F0;
  --accent: #22C55E;  --accent-strong: #84CC16;  --accent-soft: #DCFCE7;
  --accent-contrast: #14311F;  /* texte sur fond accent */
  --warn: #F59E0B;  --warn-soft: #FEF3C7;
  --danger: #DC2626;  --danger-soft: #FEE2E2;
  --text: #18181B;  --text-muted: #6B7280;  --border: #E5E7EB;
  /* Top Bar : sombre dans les deux thèmes */
  --topbar: #111827;  --topbar-text: #F9FAFB;  --topbar-muted: #9CA3AF;
  --topbar-hover: #1F2937;
}

.dark {
  color-scheme: dark;
  --canvas: #090D16;  --card: #111827;  --muted: #161F30;
  --accent: #4ADE80;  --accent-strong: #A3E635;  --accent-soft: #14311F;
  --accent-contrast: #052E16;
  --warn: #FBBF24;  --warn-soft: #3A2A08;
  --danger: #F87171;  --danger-soft: #3A1414;
  --text: #F9FAFB;  --text-muted: #9CA3AF;  --border: #1F2937;
  --topbar: #0B1120;  --topbar-text: #F9FAFB;  --topbar-muted: #9CA3AF;
  --topbar-hover: #1F2937;
}

@theme inline {
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-heading: var(--font-sans);
  --color-canvas: var(--canvas);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-strong: var(--accent-strong);
  --color-accent-soft: var(--accent-soft);
  --color-accent-contrast: var(--accent-contrast);
  --color-warn: var(--warn);
  --color-warn-soft: var(--warn-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-border: var(--border);
  --color-topbar: var(--topbar);
  --color-topbar-text: var(--topbar-text);
  --color-topbar-muted: var(--topbar-muted);
  --color-topbar-hover: var(--topbar-hover);

  /* Alias de compatibilité, retirés au palier 4 */
  --color-brand-50: var(--accent-soft);   --color-brand-100: var(--accent-soft);
  --color-brand-500: var(--accent);       --color-brand-600: var(--accent-strong);
  --color-ink-950: var(--text);           --color-ink-900: var(--text);
  --color-ink-700: var(--text);           --color-ink-500: var(--text-muted);
  --color-ink-400: var(--text-muted);
  --color-surface: var(--muted);
  --color-success: var(--accent);         --color-success-bg: var(--accent-soft);
  --color-warning: var(--warn);           --color-warning-bg: var(--warn-soft);
  --color-danger-bg: var(--danger-soft);
}
```

Anti-flash : un petit script inline dans le `<head>` de `index.html` pose la
classe `dark` avant le montage de React (lecture de `localStorage` +
`prefers-color-scheme`). Bascule runtime : `ThemeContext` /
`useTheme().basculer()`.

Google Fonts dans `app-src/index.html` :

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

---

## 9. État actuel vs cible (écart à résorber)

L'app tourne aujourd'hui sur une identité différente (violet Stripe-like).
Points à reprendre lors du chantier de refonte visuelle :

| Élément | Actuel | Cible charte |
| --- | --- | --- |
| Police corps | `DM Sans` | `Plus Jakarta Sans` |
| Police titres | `Space Grotesk` | `Plus Jakarta Sans` (une seule famille) |
| Accent | violet `#635BFF` (`brand-*`) | vert `#22C55E` (`accent-*`) |
| Fond de page | `#F0F2F7` | `#ECEFE6` (sage) |
| Tokens texte | `ink-900 #1a1d2e`, `ink-500 #64748B` | `text #18181B`, `text-muted #6B7280` |
| Bordure | `#E4E7EF` | `#E5E7EB` |
| Dark Mode | absent | bascule manuelle (bouton Top Bar), palette "Deep Night B2B" |
| Onglet actif | `bg-white` plat | inverted border radius, fusion avec le contenu |
| Level 1 (Topbar) | barre claire 40px + ruban séparé | **une seule ligne** sombre 48px : logo + pilules modules + recherche + toggle thème + notif + menu avatar |
| Déconnexion | bouton permanent dans la Topbar | dans le menu déroulant de l'avatar |
| Level 2 | 2e sous-ligne du ruban (boutons icônes) | sub-header unique 40-44px, icône fine + libellé |
| Boutons primaires | fond violet + texte blanc | fond vert + texte sombre |
| Icônes | Lucide `strokeWidth 1.6` (déjà proche) | Lucide `strokeWidth 1.5-1.75` |

Décisions actées avec Jean Didier (05/09/2026) : Top Bar sur une seule ligne
avec la nav modules intégrée ; déconnexion déplacée dans le menu avatar ;
bascule Light/Dark manuelle via un bouton de la Top Bar. Le ruban Office
actuel (`Ruban.tsx`) disparaît : ses catégories deviennent les pilules du
Level 1, ses actions deviennent le Sub-Header (Level 2).

---

## 10. Règle d'application

Dès qu'un travail touche au visuel (CSS, classes Tailwind, nouveau composant,
mise en page d'un écran) :

1. Se référer à cette charte avant d'écrire la première ligne.
2. Utiliser les tokens, jamais de couleur ni de taille en dur hors tokens.
3. Respecter l'échelle typographique et les hauteurs de la section 7.
4. Icônes outline uniquement, trait 1.5 à 1.75px.
5. Vérifier le rendu en Light **et** Dark Mode.
6. En cas de conflit entre une demande ponctuelle et la charte, le signaler à
   Jean Didier avant d'exécuter.
