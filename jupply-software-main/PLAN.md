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

**Statut :** validé, exécution en cours (paliers 0 à 4 codés, en attente vérif locale Light + Dark)
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

---

# Écran Alertes stock

**Statut :** validé, exécution en cours (code complet, en attente migration SQL + vérif locale)
**Démarré le :** 01/10/2026

## Objectif

Remplacer l'écran "Fonctionnalité à venir" de l'onglet "Alertes stock"
(module Magasin) par un récapitulatif de tous les produits en rupture de
stock ou dont le stock est inférieur ou égal au stock d'alerte. Première
brique de la section 12 du cahier des charges ("Référence en alerte sur la
quantité"). Les autres alertes (péremption, garantie, temps de stock,
outillage, transfert non réceptionné, réception non validée) restent hors
périmètre.

## Analyse de l'existant

- **Le calcul existe déjà en base.** La vue `v_produits_stock` renvoie pour
  chaque produit `stock_actuel` (somme de tous les entrepôts, hors
  Quarantaine) et `statut` : `rupture` si stock = 0, `faible` si stock <=
  `stock_min`, sinon `normal`. C'est exactement la règle demandée. Aucun
  changement de schéma nécessaire.
- `getProduitsAvecStock()` (`lib/api/stock.ts`) lit déjà cette vue, et
  `getCommandesProduits()` / `getLocalisationsProduits()`
  (`lib/api/produits.ts`) fournissent la quantité en commande et les
  emplacements : tout est réutilisable tel quel.
- Le Dashboard a déjà un bloc `AlertesStock` limité à 6 lignes, avec un lien
  "Voir tous les produits en alerte".
- **Défaut trouvé :** ce lien pointe vers `/stocks/alertes`, une adresse qui
  n'existe pas (l'app n'a qu'une route `/stocks`, la navigation se fait par
  onglets). Cliquer dessus renvoie sur `/stocks` et réinitialise les
  onglets ouverts. Même défaut sur "Voir tous les mouvements" et "Voir les
  entrepôts".
- L'onglet `alertes` est déjà déclaré (`TabsContext`, `modules.ts`), il
  affiche seulement `ComingSoon` dans `AppShell.tsx`.
- Les onglets restent montés en arrière-plan : un écran qui charge ses
  données une seule fois affiche des chiffres périmés après une sortie ou
  une réception faite dans un autre onglet.
- Convention visuelle des tableaux denses à reprendre de `Produits.tsx`
  (en-tête `uppercase` 11px, lignes compactes, filtre par colonne au
  clavier, `StatutBadge`).

## Plan détaillé

### 1. Décisions actées avec Jean Didier (01/10/2026)

- **"Stock d'alerte" = seuil de réapprovisionnement (point de commande)**,
  et non le stock minimum. Si le seuil n'est pas renseigné sur un produit,
  on retombe sur son stock minimum (choix technique, pour qu'aucun produit
  ne reste sans alerte). La règle est changée à la source, dans les vues
  `v_produits_stock` et `v_stock_par_entrepot`, donc elle vaut partout
  (Dashboard, Produits, Alertes stock). Libellé "Stock faible" remplacé par
  "En alerte", champ "Seuil réappro" renommé "Stock d'alerte".
- **Portée : l'entrepôt de l'utilisateur.** Hypothèse de travail : un seul
  entrepôt. Aucun code à écrire : la sécurité de la base ne laisse voir à
  un Gestionnaire/Magasinier que le stock de ses entrepôts assignés, donc
  le stock comparé au seuil est déjà celui de son entrepôt. À revoir le
  jour où un même utilisateur gère plusieurs entrepôts (le seuil est
  aujourd'hui défini par produit, pas par entrepôt).
- **Écran de consultation** : pas de création de commande depuis cet écran
  (le module Achats n'existe pas encore).

### 2. Schéma et couche API

- Vues `v_produits_stock` et `v_stock_par_entrepot` : seuil comparé =
  `coalesce(seuil_reappro, stock_min)`. `schema.sql` mis à jour +
  `supabase/migrations/2026-10-01-stock-alerte.sql` à exécuter une fois.
- Aucune nouvelle requête : réutilisation de `getProduitsAvecStock`,
  `getCommandesProduits`, `getLocalisationsProduits`. Ajout du petit
  utilitaire `stockAlerte(produit)` dans `lib/api/stock.ts`.

### 3. UI

- Nouveau `src/pages/AlertesStock.tsx` :
  - En-tête : titre, puis trois pastilles cliquables servant de filtre
    rapide avec leur compteur : Toutes / Rupture / Stock faible. Bouton
    "Actualiser".
  - Tableau dense : Référence, Désignation, Catégorie, Stock, Stock
    d'alerte, Écart (stock moins stock d'alerte), Stock min, En commande,
    Statut, Localisation.
  - Tri par défaut : ruptures d'abord, puis stocks faibles du plus gros
    écart au plus petit.
  - Filtre par colonne au clavier comme dans Produits (Référence,
    Désignation, Catégorie).
  - Clic droit sur une ligne : "Voir dans Produits" (ouvre l'onglet
    Produits avec ce produit sélectionné, via `SelectionContext`).
  - État vide : "Aucune alerte, tous les produits sont à un niveau normal."
  - Rechargement automatique des données à chaque fois que l'onglet
    redevient actif.
- `AppShell.tsx` : brancher `alertes` sur le nouvel écran.
- `Produits.tsx` : sélectionner le produit demandé quand on arrive depuis
  Alertes stock.
- `SectionCard.tsx` + `AlertesStock.tsx` / `MouvementsRecents.tsx` /
  `StockParEntrepot.tsx` (Dashboard) : remplacer les liens morts par
  l'ouverture de l'onglet correspondant.

## Points de vigilance

- Un produit dont le stock minimum est à 0 n'apparaît qu'en cas de rupture.
- Un produit jamais réceptionné (stock 0) apparaît en rupture : comportement
  voulu par la vue actuelle, à confirmer à l'usage.
- Respect de la charte graphique (tokens, Light + Dark, densité).

## Avancement

- [x] Décisions validées avec Jean Didier
- [x] Règle d'alerte : `schema.sql` + fichier de migration écrits
- [ ] **Migration à exécuter dans Supabase par Jean Didier** (pas d'accès
      direct à la base depuis ce poste : `SUPABASE_DB_URL` absent de
      `.env.local`). SQL non testé en base.
- [x] Écran `pages/AlertesStock.tsx` + branchement `AppShell`
- [x] "Voir dans Produits" (sélection transmise via `SelectionContext`)
- [x] Liens morts du Dashboard corrigés (ouvrent l'onglet correspondant)
- [x] Libellés ("En alerte", "Stock d'alerte") + cahier des charges et
      glossaire alignés
- [x] `tsc -b` + `vite build` OK. `oxlint` n'a pas pu tourner : son
      exécutable est bloqué par la stratégie de contrôle d'application de
      Windows sur ce poste.
- [ ] Vérification en local par Jean Didier (Light + Dark)

---

# Fenêtre "Nouvelle réception" en tableau

**Statut :** validé, exécution en cours (code complet, en attente migration SQL + vérif locale)
**Démarré le :** 02/10/2026

## Objectif

Remplacer la petite fenêtre actuelle (une carte empilée par produit) par une
grande fenêtre de saisie façon AIRSTOCK, ouverte par clic droit > "Nouvelle
réception" sur l'écran Entrées de stock : informations générales en haut,
lignes saisies directement dans un tableau en dessous.

## Décisions actées avec Jean Didier (01/10/2026)

1. Grande fenêtre par-dessus la liste des réceptions, fermée à
   l'enregistrement.
2. Saisie **façon Excel** (option B) : on tape directement dans les cases du
   tableau, une ligne par produit.
3. Ajout dès maintenant de la **date du mouvement** (modifiable) et des
   **notes** sur la réception (modification de la base).

## Analyse de l'existant

- `NouvelleReceptionModal` (`pages/Receptions.tsx`) : formulaire empilé dans
  le composant `Modal` (largeur fixe `max-w-sm`). Logique à conserver :
  entrepôts autorisés (`peutSaisirReception`), création rapide de
  fournisseur, avertissement "produit déjà stocké à un autre emplacement",
  lot / N° série / expiration selon le produit, case anomalie (quarantaine),
  quantité reçue = quantité attendue par défaut.
- `creer_reception(p_entrepot_id, p_fournisseur_id, p_numero_po, p_lignes)` :
  pas de notes ni de date. `receptions` n'a pas de colonne `notes`.
- Modèle à suivre pour la date : `creer_reintegration` (paramètre
  `p_date_mouvement`, qui fixe `cree_le` et l'année du numéro) et
  `dateSaisieVersISO` côté app (date choisie + heure réelle de saisie, donc
  la colonne "Enregistré par" garde la vraie heure).
- Le stock n'augmente toujours qu'à la validation (inchangé).

## Plan détaillé

### 1. Base

- `receptions.notes text`.
- `creer_reception` recréée avec `p_notes` et `p_date_mouvement` (optionnels).
- `schema.sql` mis à jour + `supabase/migrations/2026-10-02-reception-fournisseurs.sql`.

### 2. API / types

- `Reception.notes`, `creerReception({ ..., notes, dateMouvement })`.

### 3. UI

- `Modal` : option de largeur (`large`) sans changer les fenêtres existantes.
- Nouvelle fenêtre (dans `Receptions.tsx`) :
  - En-tête : Dépôt, Fournisseur (+ création rapide), N° bon de commande,
    Opérateur (lecture seule), Bon de réception ("Généré à
    l'enregistrement"), Date du mouvement, Notes.
  - Tableau éditable : Référence (saisie avec suggestions), Désignation
    (automatique), Qté commandée, Qté reçue, Prix unitaire, Localisation,
    Lot, N° série, Expiration (actives seulement si le produit les gère),
    Non conforme, suppression de ligne. Une ligne vide est toujours ajoutée
    en bas ; Entrée descend à la cellule du dessous. Localisation proposée
    par défaut : celle où le produit est déjà stocké dans ce dépôt.
  - Pied : nombre de lignes, quantité totale, valeur totale, Annuler /
    Enregistrer la réception. Confirmation avant de fermer si des lignes
    sont saisies.
- Panneau "Lignes" de l'écran : affiche les notes de la réception.

## Points de vigilance

- Tant que la migration n'est pas exécutée dans Supabase, l'enregistrement
  d'une réception échoue (la fonction attend les nouveaux paramètres).
- Les mouvements de stock gardent la date de **validation** (moment où le
  stock bouge réellement), la date du mouvement saisie s'applique à la
  réception.

## Avancement

- [x] Migration SQL + `schema.sql` (SQL non testé en base, pas d'accès
      direct depuis ce poste)
- [x] API / types
- [x] Fenêtre en tableau, notes affichées dans le panneau Lignes
- [x] Retours de Jean Didier (02/10/2026) :
      - la feuille de saisie est un **onglet** (`pages/NouvelleReception.tsx`,
        `EcranId` `'nouvelle-reception'` rattaché au module
        Réceptions/Expéditions) et non plus une fenêtre : la saisie est
        conservée quand on change d'onglet ; à l'enregistrement, l'onglet se
        ferme et la liste des Entrées (rechargée à chaque retour) s'affiche ;
      - bouton **+ Créer** du fournisseur : fiche complète
        (`components/fournisseurs/NouveauFournisseurModal.tsx` : nom,
        personne à contacter, téléphone, e-mail, adresse, ville, pays),
        colonnes ajoutées à `fournisseurs` dans la même migration ;
      - Lot, N° série et Expiration saisissables pour **tous** les produits
        (avant : seulement si la fiche produit les gérait).
- [x] Corrections suite aux tests (02/10/2026) :
      - les erreurs Supabase s'affichaient "Erreur inconnue" partout (ce ne
        sont pas des `Error` JS) : helper `lib/erreurs.ts` `messageErreur`,
        avec un message clair si la base n'a pas reçu la migration ;
      - retour sur la fenêtre = application remise à zéro : `AuthContext`
        rechargeait le profil (écran "Chargement...", démontage de
        l'application) à chaque nouvel objet session renvoyé par Supabase.
        Rechargement désormais limité à un vrai changement d'utilisateur.
- [x] `tsc -b` + `vite build` OK (`oxlint` bloqué par Windows sur ce poste)
- [ ] Migration exécutée par Jean Didier + vérification locale

---

# Refonte de l'écran Sorties Manuelles

**Statut :** validé, exécution en cours (code complet, en attente vérif locale)
**Démarré le :** 02/10/2026

## Objectif

Demande de Jean Didier : l'onglet Sortie est mal exploité (zone Notes
immense, panier écrasé), la recherche d'une référence et l'ajout au panier
ne fonctionnent pas, et une référence en rupture doit déclencher un message
d'erreur.

## Analyse de l'existant

- Cause du "on n'arrive pas à rechercher / ajouter" : défaut de mise en
  page. Le bloc du haut (6 champs empilés + grande zone Notes) prenait
  presque toute la hauteur, la zone du bas (recherche, liste, panier) était
  écrasée à quelques pixels : liste des références invisible, champ de
  recherche superposé au bouton Ajouter.
- Les produits en rupture étaient masqués de la liste (donc aucun message).
- `creer_sortie` renvoie l'identifiant du bon, et l'écran l'affichait tel
  quel (un UUID) dans "Bon de sortie".

## Plan détaillé

- En-tête sur une seule ligne : Dépôt, Opérateur, Bon de sortie, Date du
  mouvement, Notes / destinataire (champ d'une ligne, à droite).
- Colonne gauche : recherche (référence **ou** désignation, Entrée pour
  sélectionner) + liste de toutes les références avec leur stock dans le
  dépôt (rupture en rouge).
- Colonne droite : ligne en préparation (Référence, Désignation,
  Localisation, Disponible, Quantité, "Ajouter au panier"), puis le panier
  sur toute la hauteur restante, avec "Valider la sortie" dans sa barre de
  titre (toujours visible) et une corbeille par ligne.
- Référence en rupture dans le dépôt : message d'erreur, rien n'est mis en
  préparation.
- Le disponible tient compte de ce qui est déjà dans le panier.
- Rechargement du stock à chaque retour sur l'onglet.
- `creerSortie` relit le numéro `SOR-...` du bon créé.

## Avancement

- [x] `pages/Sorties.tsx` réécrit, `lib/api/sorties.ts`
- [x] Corrections suite aux tests de Jean Didier (02/10/2026) :
      - l'écran basculait tout seul sur le premier dépôt trouvé pour le
        produit sélectionné (ici "Entrepôt secondaire", 25 unités, au lieu
        de "Entrepôt principal", 235) : il reste désormais sur le dépôt en
        cours s'il a du stock, sinon prend celui qui en a le plus ; en cas
        de rupture dans le dépôt, le message indique où se trouve le stock ;
      - écrans qui ne se mettaient pas à jour (Produits, Dashboard et ses
        Top articles, Entrepôts, Transferts, Réintégration) : rechargement
        silencieux à chaque retour sur l'onglet ;
      - "Derniers mouvements" sans lot ni prix : migration
        `2026-10-02-vue-mouvements.sql` qui recrée la vue
        `v_mouvements_recents` (une vue `m.*` ne voit pas les colonnes
        ajoutées après sa création). Hypothèse la plus probable, non
        vérifiable sans accès à la base.
- [x] `tsc -b` + `vite build` OK (`oxlint` bloqué par Windows sur ce poste)
- [ ] Vérification en local par Jean Didier (Light + Dark)

---

# Suivi par lot : premier périmé, premier sorti (FEFO / FIFO)

**Statut :** validé, exécution en cours (code complet, migration testée sur une base de test, en attente exécution dans Supabase + vérif locale)
**Démarré le :** 02/10/2026

## Objectif

Demande de Jean Didier : quand un produit a une date d'expiration, la
feuille de sortie doit proposer en premier le lot qui se périme le plus tôt,
avec son numéro de lot (FEFO). Pour les produits sans date d'expiration, le
système applique le FIFO (premier entré, premier sorti).

## Analyse de l'existant

- **Le stock n'est pas suivi par lot.** `stock_produits` ne connaît qu'une
  quantité par (produit, entrepôt, emplacement). Le lot, le N° de série et
  la date d'expiration sont saisis à la réception (`receptions_lignes`) et
  recopiés dans l'historique (`mouvements_stock.lot`), mais une fois le
  stock entré, rien ne dit quelle quantité reste de quel lot.
- Sans cette information, impossible de savoir quel lot sortir en premier :
  la règle FEFO/FIFO ne peut pas être ajoutée par un simple tri à l'écran.
- 7 fonctions de la base font bouger le stock et devront toutes tenir les
  lots à jour : `valider_reception`, `creer_sortie`, `creer_reintegration`,
  `affecter_localisation`, `deplacer_stock`, `expedier_transfert`,
  `receptionner_transfert` (plus l'inventaire quand il existera).

## Plan détaillé

### 1. Base

- Nouvelle table `stock_lots` : produit, entrepôt, emplacement, lot,
  N° de série, date d'expiration, date d'entrée (pour le FIFO), prix
  d'entrée, quantité restante. `stock_produits` reste le total par
  emplacement (rien à changer dans les écrans existants).
- Reprise de l'existant : le stock actuel devient un lot "sans lot" par
  emplacement, daté de son premier mouvement d'entrée connu.
- **Conception retenue à l'exécution** (plus sûre que réécrire les 7
  fonctions) : un trigger `synchroniser_lots` sur `stock_produits` garantit
  en permanence "somme des lots = stock", quelle que soit l'opération.
  - Stock en baisse : lots consommés dans l'ordre FEFO puis FIFO (date
    d'expiration la plus proche d'abord, lots sans date après, puis date
    d'entrée la plus ancienne).
  - Stock en hausse : on repose les lots retirés dans la même transaction
    (déplacement interne : le lot garde son identité), sinon lot "sans lot".
  - Les fonctions qui connaissent le lot écrivent `stock_lots` avant
    `stock_produits` (le trigger ne fait alors rien) : `valider_reception`
    (crée les lots), `creer_sortie` (consomme le lot choisi via
    `stock_lot_id`), `creer_reintegration` (retour dans le lot d'origine).
  - `affecter_localisation`, `deplacer_stock`, `expedier_transfert`,
    `receptionner_transfert` ne sont pas modifiées : le trigger s'en charge.
- Fonction interne `ajouter_lot(...)`, table tampon `lots_en_mouvement`.
- `bons_sortie_lignes` (lot, N° série, expiration, date d'entrée du lot) et
  `mouvements_stock` enregistrent le lot sorti.
- Bons de sortie numérotés `BS-<année>-<séquence>` (demande de Jean Didier,
  à la place de `SOR-`).
- Pas de vue dédiée : l'écran lit `stock_lots` directement.

### 2. Écran Sorties

- À la sélection d'une référence : tableau des lots disponibles dans
  l'ordre de sortie (Lot / N° série, Expiration, Entré le, Localisation,
  Disponible), le premier étant présélectionné.
- Le panier affiche le lot et la date d'expiration de chaque ligne.
- Lot périmé ou proche de la péremption signalé en couleur.

### 3. Autres écrans

- Produits : le panneau "Stock par dépôt" détaille les lots.
- Alertes stock : base prête pour la future alerte de péremption.

## Décisions actées avec Jean Didier (02/10/2026)

1. **Ordre conseillé, pas imposé.** Les lots sont affichés dans l'ordre de
   sortie ; l'opérateur peut en choisir un autre, un avertissement non
   bloquant signale le lot qui aurait dû sortir en premier.
2. **Lot périmé : sortie autorisée avec une note obligatoire** saisie par
   l'opérateur (ex. rebut). Contrôle à l'écran et dans la base.
3. **Quantités saisies lot par lot.** L'opérateur saisit la quantité à
   prendre dans chaque lot ; le bon de sortie comporte une ligne par lot.
4. **Lot obligatoire** (ou N° de série) dès qu'une date d'expiration est
   saisie, et date d'expiration obligatoire pour un produit qui "gère
   l'expiration". Contrôle à l'écran et dans la base.

## Points de vigilance

- **Transferts : l'identité du lot est perdue à la réception.** Le stock
  reçu à destination devient un lot "sans lot" daté de la réception (le
  transfert ne mémorise pas encore les lots expédiés). À traiter avec la
  vérification du chantier Transferts.
- Le stock déjà présent avant la migration est repris en lots "sans lot"
  (pas de numéro ni de date d'expiration), datés de leur première entrée.
- Sans accès direct à la base Supabase, la migration a été testée sur un
  PostgreSQL en mémoire (PGlite) avec un environnement Supabase simulé
  (rôle `authenticated`, RLS active) : 4 états de départ, 33 contrôles
  (reprise de l'existant, réceptions, sorties par lot, lot périmé, FIFO
  automatique, réintégration, déplacement, affectation, transfert,
  suppressions en cascade, ré-exécution). Ce n'est pas la vraie base :
  reste à l'exécuter dans Supabase.
- Les migrations `2026-10-02-reception-fournisseurs.sql` et
  `2026-10-02-stock-lots-fefo.sql` définissent la même `creer_reception` :
  l'ordre d'exécution n'a pas d'importance. La seconde reprend tout le
  contenu de la première.

## Avancement

- [x] Décisions validées avec Jean Didier
- [x] Schéma + migration `supabase/migrations/2026-10-02-stock-lots-fefo.sql`
      (testée sur base de test), `schema.sql` et `seed.sql` alignés
- [x] API / types (`lib/api/lots.ts`, `StockLot`, `stockLotId` dans
      `creerSortie`)
- [x] Écran Sorties : lots dans l'ordre de sortie, quantité par lot, lot et
      expiration dans le panier, avertissement d'ordre, note obligatoire
      pour un lot périmé. Repli automatique sur le stock par emplacement
      tant que la migration n'est pas exécutée.
- [x] Nouvelle réception : contrôle lot / date d'expiration
- [x] `tsc -b` + `vite build` OK
- [ ] Migration exécutée dans Supabase par Jean Didier
- [ ] Vérification en local par Jean Didier
- [ ] Plus tard : détail des lots dans Produits, lots conservés dans les
      transferts, alerte de péremption

---

# Parcours de sortie, bon de sortie PDF et module Historique

**Statut :** validé, exécution en cours (phases 1 et 2 codées, migration testée sur base de test, en attente exécution Supabase + vérif locale)
**Démarré le :** 03/10/2026

## Objectif

Demandes de Jean Didier :
1. Le parcours de sortie n'est pas clair : un clic sur "Sorties Manuelles"
   envoie directement sur la saisie, et après validation on reste sur le même
   écran sans savoir ce qui s'est passé. Proposer mieux.
2. Séparer "Reçu par" (destinataire) et "Motif / affectation".
3. Pas de prix sur le bon de sortie.
4. Pouvoir réimprimer : nouveau module **Historique** dans la Top Bar, liste
   des mouvements par type (ex. Sorties, par numéro de bon), filtre par
   plage de dates, clic droit sur la colonne N° de bon pour saisir un numéro,
   double-clic pour le détail, export PDF / Excel / CSV.

Le bon de sortie PDF reprend le modèle AIRSTOCK fourni (photo du
25/05/2026) et sert de fiche de préparation au magasinier.

## Analyse de l'existant

- `Sorties.tsx` : feuille de saisie directe (onglet `sorties`), panier,
  validation via `creer_sortie`, numéro `BS-` relu après coup.
- `bons_sortie` a déjà `motif` ; il manque `recu_par`.
  `bons_sortie_lignes` porte désormais lot, N° série, expiration.
- Le parcours "liste + clic droit > nouveau document dans un onglet dédié"
  existe déjà pour les réceptions (`Receptions.tsx` +
  `NouvelleReception.tsx`) : le réutiliser donne une logique identique
  partout.
- Pas de composant de notification ("bulle") dans l'application.
- Module Logistique : "Mouvements" n'est qu'un écran "à venir".
- Aucune bibliothèque PDF / Excel installée.

## Plan détaillé

### 1. Parcours de sortie (proposition)

- **"Sorties Manuelles" ouvre la liste des sorties du jour** (et non plus la
  saisie) : N° de bon, heure, dépôt, motif, reçu par, émis par, lignes,
  quantité. Bouton **+ Nouvelle sortie** bien visible (et clic droit).
  Panneau du bas : détail du bon sélectionné, avec les localisations.
- **"Nouvelle sortie" ouvre un onglet dédié** (la feuille actuelle) : la
  saisie est conservée si on change d'onglet, comme pour les réceptions.
- **À la validation** : l'onglet de saisie se ferme, retour sur la liste où
  le nouveau bon apparaît en tête, en surbrillance ; bulle verte "Sortie
  effectuée : BS-2026-00012" ; fenêtre "Bon de sortie enregistré" avec le
  résumé (lignes, quantité, reçu par) et trois boutons : **Imprimer le bon
  (PDF)**, **Nouvelle sortie**, **Fermer**.
- Depuis Produits, "Sorties Manuelles" avec un produit sélectionné ouvre
  directement "Nouvelle sortie" avec ce produit.

### 2. Champs du bon

- `bons_sortie.recu_par` (migration). Dans la saisie : **Reçu par** et
  **Motif / affectation** séparés. `creer_sortie` reçoit `p_recu_par`.

### 3. Bon de sortie PDF

- En-tête "BON DE SORTIE / ISSUE", numéro, date, entreprise, dépôt ; bloc
  motif / affectation ; tableau Localisation, Référence, Désignation,
  N° de série, N° de lot, Expiration, Quantité, **trié par localisation**
  (ordre de tournée) ; total ; cadres "Émis par" et "Reçu par" pour les
  signatures ; "Page x sur y". Pas de prix.
- Ouvert dans un nouvel onglet du navigateur (imprimer / enregistrer).

### 4. Module Historique

- Nouvelle pilule **Historique** dans la Top Bar. Sous-sections :
  Sorties (phase 1), puis Entrées, Réintégrations, Transferts, Tous les
  mouvements (phase 2, même modèle). "Mouvements" quitte Logistique.
- Liste (ex. Sorties) : N° de bon, date, dépôt, motif, reçu par, émis par,
  lignes, quantité. Filtre **du ... au ...** ; **clic droit sur la colonne
  N° de bon** > saisir un numéro ; **double-clic** > fenêtre de détail
  (lignes avec localisation, lot, série, expiration, quantité réintégrée).
- **Export** du détail (PDF du bon, Excel, CSV) et de la liste filtrée
  (Excel, CSV).

### 5. Composants partagés

- Bulle de notification (`ToastContext`), réutilisable partout (réceptions,
  transferts...).
- Fonctions d'export : PDF (`jspdf` + `jspdf-autotable`), Excel
  (`write-excel-file`), CSV (sans bibliothèque, séparateur `;` et accents
  compatibles Excel français).

## Points de vigilance

- 3 nouvelles bibliothèques (PDF et Excel), chargées seulement au moment de
  l'export pour ne pas alourdir l'application.
- Migration SQL à exécuter dans Supabase (`recu_par`), testée sur la base
  de test.
- Les anciens bons (`SOR-`) n'ont ni "Reçu par" ni lot : ils s'affichent et
  s'exportent avec des cases vides.

## Avancement

- [x] Proposition de parcours validée par Jean Didier (03/10/2026) ; choix
      techniques et découpage laissés à Claude
- [x] Base : migration `2026-10-03-historique-recu-par.sql` (`recu_par`,
      `creer_sortie` avec `p_recu_par`, 9 vues `v_historique_*`), testée
      sur base de test (49 contrôles, 3 états de départ, ré-exécution) ;
      `schema.sql` aligné. `creer_sortie` est aussi alignée dans la
      migration des lots pour que l'ordre d'exécution n'ait pas d'importance.
- [x] Phase 1 : `pages/Sorties.tsx` (liste du jour + "Nouvelle sortie" +
      fenêtre "Bon de sortie enregistré"), `pages/NouvelleSortie.tsx`
      (ancienne feuille, onglet dédié, Reçu par / Motif), bulle
      `ToastContext`, PDF `lib/export/bonSortiePdf.ts` (vérifié sur un bon
      d'essai), Historique > Sorties.
- [x] Phase 2 (même composant `components/historique/ListeDocuments.tsx`,
      configurations dans `configs.tsx`) : Entrées, Réintégrations,
      Transferts, Tous les mouvements. "Mouvements" retiré de Logistique.
- [x] Exports : Excel (`write-excel-file`), CSV (séparateur `;`, UTF-8),
      PDF (`jspdf` + `jspdf-autotable`), chargés à la demande.
- [x] `tsc -b` + `vite build` OK
- [ ] Migration exécutée dans Supabase par Jean Didier
- [ ] Vérification en local par Jean Didier (Light + Dark)
- [ ] Plus tard : PDF des autres documents (bon de réception, bon de
      transfert) sur le même modèle

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
