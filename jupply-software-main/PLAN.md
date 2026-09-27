# Plan en cours

> Rempli quand Jean Didier déclenche le mode plan : il décrit ce qu'il veut,
> Claude étudie le code existant en profondeur, réfléchit à l'intégration, puis
> rédige ici un plan détaillé avant toute exécution. Jean Didier le relit (ici,
> même dans une session future) pour voir ce qui est prévu, l'avancement, les
> difficultés rencontrées, avant de donner le feu vert.
>
> Une fois le chantier terminé et vérifié, il est déplacé vers `PLAN_ARCHIVE.md`
> et ce fichier redevient vide, prêt pour le prochain chantier.

---

# Transferts entre entrepôts

**Statut :** validé, exécution en cours (code complet, en attente vérif locale)
**Démarré le :** 31/08/2026

## Objectif

Nouvel onglet "Transfert", à côté de "Sorties Manuelles" dans le ruban
(catégorie Réceptions/Expéditions), pour transférer des produits d'un
entrepôt vers un autre — section 8 du cahier des charges.

Cycle de vie en plusieurs étapes (contrairement à Sortie qui est immédiate
et Réception qui n'a que deux temps) :

1. **Demande** : le Superviseur Entrepôt demande un transfert (produits,
   quantités, entrepôt source, entrepôt destination).
2. **Validation** : l'Administrateur ou le Superviseur Entrepôt concerné
   valide la demande.
3. **Expédition** : l'entrepôt source prépare et expédie — le produit
   quitte officiellement le stock disponible de la source à ce moment.
4. **En transit** : le produit n'est plus disponible dans la source et
   pas encore dans la destination (statut intermédiaire, pas d'action
   utilisateur).
5. **Réception** : le responsable de l'entrepôt destination confirme la
   réception — le produit devient disponible dans la destination à ce
   moment. Si la quantité reçue diffère de la quantité expédiée, l'écart
   est enregistré (pas de suppression/correction silencieuse).

Un numéro de suivi unique identifie chaque transfert. Si un transfert
n'est jamais réceptionné, il reste indéfiniment "En transit" (l'alerte
associée fait partie du futur module Alertes, pas de ce chantier).

## Analyse de l'existant

- `transferts`/`transferts_lignes` existent déjà en base (chantier de
  refonte du schéma) avec seulement des policies de lecture — jamais
  reliées à `stock_produits`/`mouvements_stock`, exactement comme
  `bons_sortie` avant le chantier précédent.
- `transferts.statut` a déjà le check contraint exact du cycle de vie :
  `'demande' | 'valide' | 'expedie' | 'en_transit' | 'recu'`.
- `transferts_lignes` n'a **pas** de colonne emplacement (ni source ni
  destination) — à ajouter, sur le même principe que `bons_sortie_lignes.
  emplacement_id` (source, fixé à l'expédition) et `reintegrations_lignes.
  emplacement_id` (destination, choisi à la réception).
- `mouvements_stock.type` inclut déjà `'transfert'` (utilisé par
  `STYLES_TYPE_MOUVEMENT` dans Produits.tsx et `MouvementsRecents.tsx`)
  mais aucun code n'en génère encore.
- Pattern établi et éprouvé (chantiers précédents) : fonctions
  PostgreSQL `security invoker`, verrou `for update` + policy RLS
  **UPDATE** dédiée dès qu'un verrou est posé (piège rencontré et corrigé
  sur `bons_sortie_lignes` lors du chantier Réintégration — sinon
  Postgres exclut silencieusement les lignes verrouillées).
- Le ruban (`Ruban.tsx`) a la catégorie "Réceptions/Expéditions" avec
  "Entrées manuelles", "Sorties Manuelles", "Réintégration" — "Transfert"
  s'y ajoute comme nouvelle action `ouvrirOnglet`.

## Plan détaillé

### 1. Décisions validées avec Jean Didier

- **Demande** : Superviseur Entrepôt (cahier des charges).
- **Validation** : Administrateur ou Superviseur Entrepôt (cahier des
  charges).
- **Expédition** (côté source) et **réception** (côté destination) :
  Gestionnaire d'entrepôt et Magasinier de l'entrepôt concerné, en plus
  d'Administrateur et Superviseur Entrepôt — même principe que pour les
  réceptions/sorties physiques déjà en place.
- **Écart de réception** (quantité reçue ≠ quantité expédiée) : juste
  enregistrer `quantite_expediee` et `quantite_recue` sur la ligne,
  écart visible par comparaison directe — pas de mouvement d'ajustement
  généré automatiquement.

### 2. Schéma

- `transferts_lignes` : ajout de `emplacement_source_id` (nullable,
  rempli à l'expédition) et `emplacement_destination_id` (nullable,
  rempli à la réception) ; `quantite_recue` existe déjà.
- RLS d'écriture par transition (insert sur `transferts` réservé au
  Superviseur Entrepôt ; update de statut scindé par étape et par rôle).
- Séquence de numérotation `TRF-<année>-...`.
- Fonctions RPC `security invoker`, une par transition :
  - `demander_transfert(entrepot_source, entrepot_destination, lignes)`
    → crée le transfert + ses lignes, statut `demande`, aucun mouvement
    de stock.
  - `valider_transfert(transfert_id)` → statut `valide`.
  - `expedier_transfert(transfert_id, lignes avec emplacement source)` →
    vérifie et décrémente le stock source (verrou), passe directement au
    statut `en_transit` (le statut `expedie` du check contraint reste
    disponible mais n'est pas utilisé comme étape séparée dans ce MVP —
    l'expédition et le passage en transit sont un seul geste), insère un
    mouvement `transfert` (sortie logique).
  - `receptionner_transfert(transfert_id, lignes avec emplacement
    destination + quantite_recue)` → incrémente le stock destination,
    statut `recu`, enregistre l'écart si `quantite_recue ≠
    quantite_expediee`, insère un mouvement `transfert` (entrée logique).
- Vue `v_transferts` (liste enrichie noms d'entrepôts/statuts) et
  éventuellement `v_transferts_a_receptionner` pour l'écran de réception.

### 3. Couche API

- `src/lib/api/transferts.ts` : une fonction par transition + une
  fonction de lecture liste/détail.

### 4. UI

Workflow multi-étapes avec suivi de statut, différent du panier immédiat
de Sortie/Réintégration — structure proposée proche de `Receptions.tsx`
(liste des transferts + panneau détail) plutôt qu'un panier :
- `src/pages/Transferts.tsx` (nouvel onglet) : liste des transferts
  (numéro, source → destination, statut, date), clic droit ou bouton
  contextuel pour "Nouveau transfert" (demande), puis actions selon le
  statut courant et le rôle de l'utilisateur (Valider / Expédier /
  Réceptionner), visibles uniquement quand applicables.
- `Ruban.tsx` : nouvelle action "Transfert" dans la catégorie
  Réceptions/Expéditions, à côté de "Sorties Manuelles".
- `TabsContext.tsx` : nouvel `EcranId` `'transfert'`.

## Points de vigilance

- Réutiliser systématiquement le pattern policy RLS **UPDATE** dédiée
  dès qu'une fonction pose un `for update` (piège déjà rencontré une
  fois, à ne pas refaire ici).
- Statut "En transit" indéfini si jamais réceptionné : pas d'alerte
  automatique dans ce chantier (futur module Alertes).

## Avancement

- [x] Décisions validées avec Jean Didier (rôles expédition/réception,
      gestion de l'écart de réception)
- [x] Schéma (colonnes emplacement, RLS d'écriture, séquence
      `transferts_numero_seq`, fonctions RPC `demander_transfert`/
      `valider_transfert`/`expedier_transfert`/`receptionner_transfert`,
      vues `v_transferts`/`v_transferts_lignes`) — appliqué en base et
      testé (cycle complet demande → refus expédition avant validation →
      validation → expédition avec décrément stock source → réception
      avec écart de quantité → incrément stock destination) via
      transaction annulée, aucune donnée réelle touchée
- [x] Couche API (`src/lib/api/transferts.ts`)
- [x] UI (`src/pages/Transferts.tsx` : liste + détail façon Réceptions,
      modales Nouveau transfert / Expédier / Réceptionner, actions
      visibles selon statut + rôle ; intégration Ruban/TabsContext/
      AppShell) ; `tsc -b`, `oxlint`, `vite build` passent sans erreur
- [ ] Vérification en local par Jean Didier — **à faire de préférence
      avant la refonte visuelle** (qui va retoucher `Transferts.tsx`),
      pour ne pas mélanger bug fonctionnel et souci d'affichage

---

# Refonte visuelle de l'application selon la charte graphique

**Statut :** en cours de conception (en attente du feu vert de Jean Didier)
**Démarré le :** 05/09/2026

## Objectif

Aligner toute l'application `app-src/` sur la charte graphique
(`docs/charte-graphique/CHARTE_GRAPHIQUE.md`) : identité "Clean SaaS Sage"
façon Gemini, navigation 3 niveaux, Light + Dark Mode, densité, composants.

L'app tourne aujourd'hui sur l'ancienne identité (violet `#635BFF`, `DM Sans` +
`Space Grotesk`, pas de dark mode, ruban Office à 2 sous-lignes). Voir la
section 9 de la charte pour l'écart complet.

Le site vitrine n'est pas concerné par ce chantier (réalignement plus tard).

## Décisions actées avec Jean Didier (05/09/2026)

1. **Top Bar sur une seule ligne.** Logo Jupply + pilules des modules
   (Magasin, Réceptions/Expéditions, Logistique...) + recherche + bouton
   bascule thème + notifications + avatar, tout sur la même ligne, 48px max,
   fond sombre. Référence : les onglets pilules du haut de la maquette
   Stratum AI.
2. **Déconnexion** déplacée : plus de bouton permanent, elle passe dans un
   menu déroulant ouvert au clic sur l'avatar (avec, plus tard, profil /
   préférences).
3. **Dark Mode** : bascule **manuelle** via un bouton dans la Top Bar
   (persistée). Pas de suivi automatique de l'OS pour l'instant (on lit quand
   même la préférence système au tout premier chargement).
4. **Le ruban actuel (`Ruban.tsx`) disparaît** : ses catégories deviennent les
   pilules du Level 1, ses actions deviennent le Sub-Header (Level 2).
5. **Méthode** : socle d'abord, puis écran par écran, avec revue visuelle en
   local (Light + Dark) à chaque palier (voir "Méthode de travail" plus bas).

## Analyse de l'existant

### Pile technique

- Tailwind CSS v4 (`@tailwindcss/vite`), pas de `tailwind.config.js` : la
  config est dans `app-src/src/index.css` via `@theme`.
- Tokens actuels dans `index.css` : `brand-*` (violet), `ink-*` (texte/gris),
  `surface` (#F0F2F7), `border` (#E4E7EF), `success/warning/danger` (+ `-bg`).
- Polices chargées dans `index.html` : `Space Grotesk` + `DM Sans`.
- `lucide-react` déjà utilisé partout (`strokeWidth` 1.6 à 2 selon les
  endroits).
- Recharts pour les graphiques du Dashboard (couleurs en dur à vérifier).

### Structure de la coquille

`AppShell.tsx` empile : `Topbar` (h-10) puis `Ruban` (2 sous-lignes :
catégories + boutons icônes) puis `BarreOnglets` puis `ZoneContenu` (`<main>`
qui monte tous les onglets ouverts et masque les inactifs en `display:none`).

- `Topbar.tsx` : logo dégradé violet, recherche factice, cloche, bloc profil
  avec bouton déconnexion visible.
- `Ruban.tsx` : `CATEGORIES` (Magasin / Réceptions-Expéditions / Logistique),
  chaque catégorie a des `actions` (`ecran`, `label`, `icone`). Gère aussi le
  cas "Sorties Manuelles" qui récupère le produit sélectionné via
  `useSelection().declencherSortieManuelle`.
- `BarreOnglets.tsx` : onglets ouverts, actif en `bg-white` plat, croix de
  fermeture sauf Dashboard.
- `TabsContext.tsx` : `EcranId` (10 écrans), `onglets`, `ongletActifId`,
  `ouvrirOnglet` / `fermerOnglet` / `activerOnglet`. Dashboard non fermable.
- `AuthContext.tsx` : `profil` (`nom_complet`, `role`), `deconnexion()`.

### Écrans et composants à migrer

- Pages : `Dashboard`, `Produits`, `Entrepots`, `Receptions`, `Sorties`,
  `Reintegration`, `Transferts`, `ComingSoon`, `Login`.
- Composants partagés : `KpiCard`, `SectionCard`, `StatutBadge`, `Modal`,
  `MenuContextuel` (clic droit), `MouvementsRecents`, `AlertesStock`,
  `TopArticles`, `StockParEntrepot`, `StockParCategorieChart`.
- `Produits.tsx` et `Transferts.tsx` définissent des chaînes de classes
  locales (`CLASSE_INPUT`, `CLASSE_BOUTON_PRIMAIRE`, `STYLES_TYPE_MOUVEMENT`)
  à remplacer par des primitives partagées.
- Volume : ~480 occurrences de tokens de couleur / `font-heading` sur 24
  fichiers (Produits ~105, Transferts ~64, Reintegration ~57, Receptions ~50,
  Entrepots ~32, reste réparti).

## Plan détaillé

### Palier 0 - Fondations (tokens, polices, thème)

Fichiers : `app-src/index.html`, `app-src/src/index.css`, nouveau
`app-src/src/context/ThemeContext.tsx`, `app-src/src/main.tsx`.

1. `index.html` : remplacer le `<link>` Google Fonts par
   `Plus Jakarta Sans` (400;500;600;700). Retirer `Space Grotesk`.
2. `index.css` : réécrire la feuille de thème.
   - `@custom-variant dark (&:where(.dark, .dark *));`
   - `:root { ... }` : variables brutes Light (canvas, surface, accent,
     accent-strong, accent-soft, warn, text, text-muted, border + danger
     sobre).
   - `.dark { ... }` : mêmes variables, valeurs "Deep Night B2B".
   - `@theme inline { --color-*: var(--*) ; --font-sans: 'Plus Jakarta Sans'... }`
   - **Alias de compatibilité** dans le même bloc : `--color-brand-500`,
     `--color-brand-600`, `--color-ink-950/900/500/400`, `--color-surface`,
     `--color-border`, `--font-heading`, `--color-success(-bg)` etc. pointent
     vers les nouveaux tokens. Objectif : l'app reste cohérente visuellement
     dès le palier 0 (vert au lieu de violet, fond sage, nouvelle police),
     même avant d'avoir migré chaque composant. Les alias seront retirés au
     palier 4.
   - `body` : `background: var(--color-canvas)`, `color: var(--color-text)`.
3. `ThemeContext.tsx` : `theme: 'light' | 'dark'`, `basculer()`. Init :
   `localStorage['jupply-theme']` sinon `matchMedia('(prefers-color-scheme:
   dark)')`. Effet : `documentElement.classList.toggle('dark', ...)` +
   persistance. Provider monté dans `main.tsx` (englobe `App`, donc Login
   aussi).

Revue : l'app doit se lancer, tout doit être lisible en Light et en Dark,
même si des détails ne sont pas encore "charte-parfait".

### Palier 1 - Coquille 3 niveaux

Fichiers : nouveau `app-src/src/lib/modules.ts`, refonte
`app-src/src/components/layout/` (`TopBar.tsx`, `SousEntete.tsx`,
`BarreOnglets.tsx`, `MenuCompte.tsx`), `AppShell.tsx` ; suppression de
`Ruban.tsx` ; `TabsContext.tsx` (ajout d'un module actif).

1. `modules.ts` : extraire `CATEGORIES` (id, label, actions) de `Ruban.tsx`
   vers un module partagé, typé, utilisé par TopBar + SousEntete. Ajout d'une
   correspondance `EcranId -> moduleId` (pour re-synchroniser le module actif
   quand on active un onglet ouvert depuis un autre module).
2. `TopBar.tsx` (remplace `Topbar.tsx`) : une ligne, fond sombre, 48px.
   - Gauche : logo J + "Jupply".
   - Pilules des modules (14px / 600), module actif en surbrillance.
   - Droite : champ de recherche (compact, factice pour l'instant), bouton
     bascule thème (`Sun` / `Moon`), cloche notifications (pastille), bouton
     avatar (initiales) ouvrant `MenuCompte`.
3. `MenuCompte.tsx` : popover ancré sous l'avatar. En-tête nom + rôle, item
   "Sortie" (`deconnexion()`), emplacements réservés profil / préférences
   (désactivés). Fermeture au clic extérieur / Échap.
4. `SousEntete.tsx` (Level 2) : 40-44px, fond `surface` ou canvas selon rendu,
   liste les `actions` du module actif (icône fine 1.5px + libellé 14px/600).
   Clic -> `ouvrirOnglet`. Reprend la logique "Sorties Manuelles + produit
   sélectionné" aujourd'hui dans `Ruban.onClicAction`.
5. `BarreOnglets.tsx` (Level 3) : onglet actif = couleur du contenu
   (`surface`) + **inverted border radius** à la base (technique :
   pseudo-éléments `::before/::after` avec `radial-gradient` masqué, ou SVG
   d'angle ; à tester en Light et Dark et avec l'`overflow-x`). Onglets
   inactifs sur le canvas, opacité réduite. Croix au survol / actif.
6. `AppShell.tsx` : `TopBar` + `SousEntete` + `BarreOnglets` + `ZoneContenu`.
   Le module actif : état dans `TabsContext` (ou petit `ModuleContext`), posé
   par les pilules et re-synchronisé sur `activerOnglet`.
7. Supprimer `Ruban.tsx`.

Revue : navigation complète (changer de module, ouvrir/fermer des onglets,
menu avatar, bascule thème) OK en Light et Dark, chrome <= 3 lignes.

### Palier 2 - Primitives et composants partagés

Fichiers : nouveaux `app-src/src/components/ui/` (`Bouton.tsx`, `Champ.tsx`,
`Badge.tsx`, `Carte.tsx`) ; migration de `KpiCard`, `SectionCard`,
`StatutBadge`, `Modal`, `MenuContextuel`, `ComingSoon`.

- `Bouton` : variantes `primaire` (accent vert + texte sombre, `rounded-lg`),
  `secondaire` (bordure `border`), `discret`. État désactivé = opacité.
- `Champ` : `rounded-lg` (8px), focus `ring-2 ring-accent/30 border-accent`,
  pas de halo bleu/noir.
- `Badge` : capsule `rounded-full`, 11px / 600 / `uppercase`, jeux de
  couleurs pastel (vert / ambre / rouge / neutre).
- `Carte` : `rounded-xl` (12px), fond `surface`, `border`, padding 16px.
- `KpiCard` : passer de `rounded-2xl` / `p-5` à `rounded-xl` / `p-4`, puce
  d'icône en pastel d'accent, valeur en `font-sans` 20px/700.
- `Modal` / `MenuContextuel` / `StatutBadge` / `ComingSoon` : tokens + dark +
  rayons charte (`StatutBadge` -> capsule).

### Palier 3 - Écrans, un par un

Pour chaque écran : remplacer les anciens tokens par les classes sémantiques,
appliquer la densité de la charte (hauteur de ligne 36-42px, header de
tableau `uppercase` 11-12px, padding carte 16px), utiliser les primitives du
palier 2, vérifier survol / focus / menu contextuel / modales / états vides,
en **Light et Dark**. Ordre :

1. `Dashboard` (+ ses composants `dashboard/`, dont les couleurs Recharts).
2. `Produits` (le plus gros ; supprimer `CLASSE_INPUT` / `CLASSE_BOUTON_*`).
3. `Entrepots`.
4. `Receptions`.
5. `Sorties`.
6. `Reintegration`.
7. `Transferts` (voir point de vigilance sur la vérif fonctionnelle en cours).
8. `Login`.

Revue après chaque écran (screenshots Light + Dark).

### Palier 4 - Passe finale et nettoyage

1. `grep` des anciens tokens (`brand-`, `ink-`, `font-heading`, `-bg`
   sémantiques, `purple-`) -> 0, ou justifié.
2. Retirer les alias de compatibilité de `index.css`.
3. Balayage Dark Mode complet écran par écran (contrastes, bordures,
   overlays, tooltips Recharts, scrollbars).
4. `favicon.svg` : logo violet en dégradé. Recolorer = décision de marque
   (toute l'identité Jupply passe au vert ?) à trancher avec Jean Didier,
   pas un simple ajustement d'UI. Laissé tel quel pour l'instant.
5. `tsc -b` + `oxlint` + `vite build` sans erreur.
6. Checklist QA finale (voir plus bas) cochée intégralement.
7. Mettre à jour `app-src/README.md` (mention charte + dark mode) et la
   mémoire `ui-dense-tables` (le style n'est plus "Jupply violet actuel"
   mais la charte).

## Méthode de travail (réponse au point 3 de Jean Didier)

**Socle d'abord, puis écran par écran, avec une revue en local à chaque
palier.** 5 paliers (0 à 4). À la fin de chaque palier : `npm run dev`,
captures d'écran en Light **et** Dark, je te les montre, tu valides, on passe
au suivant. Rien n'est archivé tant que la checklist QA n'est pas cochée en
entier.

Pourquoi ce découpage :

- Le palier 0 (tokens + alias de compat) fait basculer toute l'app sur la
  bonne palette d'un coup, sans écran cassé : on juge tôt la direction.
- La coquille (palier 1) est la partie la plus visible et la plus risquée
  (inverted radius) : on la traite isolément, à froid.
- Les primitives (palier 2) évitent de répéter puis re-corriger les mêmes
  chaînes de classes sur 8 écrans.
- Les écrans (palier 3) sont indépendants : un par un, chacun vérifié dans les
  2 thèmes, aucun oublié.
- Le palier 4 est le filet : grep exhaustif + checklist, pour la garantie
  "rien n'a été manqué".

## Checklist QA finale

- [ ] Aucune occurrence des anciens tokens (`brand-`, `ink-`, `font-heading`,
      `success-bg`/`warning-bg`/`danger-bg`, `purple-`) hors intention.
- [ ] Alias de compatibilité retirés de `index.css`.
- [ ] Les 9 écrans + `ComingSoon` rendus corrects en Light.
- [ ] Les 9 écrans + `ComingSoon` rendus corrects en Dark.
- [ ] Top Bar : une seule ligne, 48px max, fond sombre dans les 2 thèmes.
- [ ] Menu avatar : ouverture, "Sortie" fonctionne, fermeture clic extérieur.
- [ ] Bascule thème : persiste au rechargement, pas de flash.
- [ ] Sub-Header : reflète le module actif, ouvre les onglets, cas "Sorties
      Manuelles + produit sélectionné" conservé.
- [ ] Onglets : inverted radius net en Light et Dark, fermeture + report sur
      onglet adjacent OK, scroll horizontal OK.
- [ ] Focus des champs : halo vert, jamais de contour bleu/noir.
- [ ] Badges de statut : capsule complète.
- [ ] Boutons primaires : fond vert, texte sombre.
- [ ] Menus contextuels (clic droit) : lisibles dans les 2 thèmes.
- [ ] Modales : overlay + carte OK dans les 2 thèmes.
- [ ] Graphiques Recharts : couleurs, grille, tooltip adaptés au thème.
- [ ] Hauteurs : lignes de tableau 36-42px, sub-header 40-44px.
- [ ] `tsc -b`, `oxlint`, `vite build` OK.
- [ ] Vérification finale en local par Jean Didier, Light et Dark.

## Points de vigilance

- **Inverted border radius** : effet fragile. Le tester tôt (palier 1) dans
  les 2 thèmes, avec la barre d'onglets qui déborde horizontalement. Prévoir
  un repli propre (léger arrondi standard) si le rendu n'est pas net.
- **Recharts** : couleurs en dur dans les composants `dashboard/`. Les rendre
  dépendantes du thème (via `useTheme` ou variables CSS lues en JS). À ne pas
  oublier dans la checklist.
- **Alias de compatibilité** : utiles pour ne pas casser l'app pendant la
  migration, mais **doivent** être retirés au palier 4, sinon dette cachée.
- **`Transferts.tsx`** : le chantier "Transferts entre entrepôts" attend
  encore ta vérification fonctionnelle en local. La refonte visuelle va
  retoucher ce fichier. Reco : tu fais d'abord (ou en parallèle) le test
  fonctionnel de Transferts sur l'état actuel, pour ne pas mélanger un bug
  fonctionnel avec un souci visuel. Sinon on l'accepte et on vérifie les deux
  à la fin.
- **Top Bar sombre en Light Mode** : soigner le contraste du champ de
  recherche et des pilules (fond sombre dans une page claire).
- **Fonts** : `Space Grotesk` référencé dans `font-heading` et plusieurs
  `className` (`font-heading`). L'alias `--font-heading` = `--font-sans` évite
  la casse ; le nettoyage des `font-heading` se fait au fil des écrans.
- **`prefers-color-scheme`** au premier chargement : lu une seule fois si
  aucune préférence stockée, ensuite c'est le choix manuel qui prime.

## Avancement

- [x] Charte graphique rédigée et rangée (`docs/charte-graphique/`), règle
      ajoutée dans `CLAUDE.md`, mémoire créée.
- [x] Décisions de navigation / thème actées avec Jean Didier.
- [x] Feu vert de Jean Didier ("lance-toi", vérif visuelle repoussée à la fin).
- [x] **Palier 0 - Fondations.** `index.css` réécrit (tokens Light/Dark +
      `@custom-variant dark` + alias de compat + `.onglet-actif`),
      `index.html` (Plus Jakarta Sans + script anti-flash), nouveau
      `context/ThemeContext.tsx`, `main.tsx` enveloppé par `ThemeProvider`.
      `tsc -b` + `oxlint` + `vite build` OK.
- [x] **Palier 1 - Coquille 3 niveaux.** Nouveau `lib/modules.ts` (données
      modules + actions, `MODULE_PAR_ECRAN`). `TabsContext` : ajout
      `moduleActifId` / `definirModuleActif`, re-synchro sur ouvrir/activer/
      fermer. Nouveaux `TopBar.tsx` (une ligne sombre 48px : logo + pilules
      modules + recherche + bouton thème Soleil/Lune + cloche + `MenuCompte`),
      `MenuCompte.tsx` (dropdown avatar : nom/rôle, profil + préférences
      désactivés, "Sortie"), `SousEntete.tsx` (Level 2, actions du module
      actif, item actif en accent). `BarreOnglets.tsx` réécrit avec inverted
      radius (`.onglet-actif::before/::after`, `radial-gradient`). `AppShell`
      recomposé (`bg-canvas` + `<main>` `bg-card`). `Ruban.tsx` et
      `Topbar.tsx` supprimés (casse corrigée en `TopBar.tsx` via `git mv`).
      `tsc -b` + `oxlint` + `vite build` OK ; tous les modules transformés
      par Vite sans erreur (serveur de dev). Rendu visuel non vérifié (mur
      d'authentification, vérif locale par Jean Didier à la fin).
- [x] **Palier 2 - Primitives et composants partagés.** Nouveau
      `components/ui/` : `styles.ts` (chaines de classes charte),
      `Bouton.tsx`, `Champ.tsx`, `Badge.tsx` (capsule), `Carte.tsx`. Tokens
      "profonds" `accent-deep` / `warn-deep` / `danger-deep` ajoutes
      (texte lisible sur fonds `-soft`, alias `success`/`warning` reciblés).
      `KpiCard`, `SectionCard`, `StatutBadge` (-> `Badge`), `Modal`,
      `MenuContextuel`, `ComingSoon` migrés tokens + dark + rayons charte.
      `tsc -b` + `oxlint` + `vite build` OK.
- [x] **Palier 3 - Écrans.** Dashboard (+ 5 composants `dashboard/`, dont
      `chartTheme.ts` pour des couleurs Recharts theme-aware) migré tokens +
      densité (`p-4`, `text-xl`, `bg-canvas` derrière les cartes blanches).
      Migration mécanique (perl) des 7 pages restantes (Produits, Entrepots,
      Receptions, Sorties, Reintegration, Transferts, Login) : ~360
      occurrences de tokens remplacées, focus vert ajouté aux champs, badges
      de statut passés en capsule, boutons primaires vert + texte sombre,
      Entrepots repassé en `bg-canvas` + rayons/densité charte, favicon
      laissé tel quel (question de marque, voir plus bas).
- [x] **Palier 4 - Passe finale.** `grep` des anciens tokens = 0 dans le
      code, aucune construction dynamique de classe, **alias de
      compatibilité retirés** de `index.css`. `tsc -b` + `oxlint` +
      `vite build` OK. Reste : checklist QA visuelle + retrait éventuel du
      favicon violet.
- [ ] Vérification en local par Jean Didier (Light + Dark) — checklist QA
      ci-dessous.

## Format utilisé pour chaque plan

```
# [Nom du chantier]

**Statut :** en cours de conception / validé, exécution en cours / terminé
**Démarré le :** JJ/MM/AAAA

## Objectif
Ce que le chantier doit accomplir, et pourquoi.

## Analyse de l'existant
Ce que Claude a trouvé en étudiant le code avant de proposer quoi que ce soit.

## Plan détaillé
Étapes précises, dans l'ordre, avec les fichiers concernés.

## Points de vigilance
Difficultés anticipées ou rencontrées, décisions techniques à trancher.

## Avancement
- [x] Étape faite
- [ ] Étape à venir
```
