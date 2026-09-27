# Archive des plans

> Chaque plan de `PLAN.md`, une fois le chantier terminé et vérifié, est déplacé
> ici tel quel (avec son avancement complet), le plus récent en haut.

---

# Sorties de stock et Réintégrations

**Statut :** terminé
**Démarré le :** 30/08/2026

## Objectif

Décrit par Jean Didier sur plusieurs échanges, avec deux captures AIRSTOCK
à l'appui (ruban "Sorties Manuelles"/"Réintégration", fenêtre Réintégration
avec panier). Deux flux à construire ensemble :

1. **Sortie** : depuis Produits (sélectionner une ligne puis "Sorties de
   stock" dans le ruban) ou directement depuis le ruban, une fenêtre
   "panier" s'ouvre : rechercher/cliquer des produits, saisir une quantité
   par produit, "Ajouter" au panier, répéter pour plusieurs produits, puis
   "Valider" traite tout le panier en une fois — le stock est déduit
   **immédiatement** (pas de validation séparée comme les réceptions).
2. **Réintégration** : annuler tout ou partie d'une sortie déjà faite,
   produit par produit (on peut ne réintégrer qu'un seul produit d'une
   sortie qui en comportait plusieurs), sans jamais supprimer l'historique
   — l'opération d'origine reste tracée, une réintégration est une
   nouvelle écriture qui compense, pas une suppression.

Les deux fenêtres partagent le même principe d'interaction : une petite
recherche en haut de la liste de produits (pour ne pas avoir à défiler),
clic sur un produit pour le préparer, "Ajouter" pour l'empiler dans un
panier, "Valider" pour tout traiter d'un coup.

## Analyse de l'existant

- `bons_sortie`/`bons_sortie_lignes` existent en base (chantier de
  refonte du schéma) avec seulement des policies de lecture — jamais
  reliées à `stock_produits`/`mouvements_stock`, exactement comme
  `receptions` avant le chantier précédent.
- Aucune table pour les réintégrations n'existe encore.
- Pattern déjà établi et éprouvé (chantiers Localisation et Réceptions) :
  fonctions PostgreSQL `security invoker` pour l'atomicité + verrou
  `for update` sur les lignes de stock concernées, testées en conditions
  réelles (session simulée + transaction annulée) avant livraison.
- Écran `Produits.tsx` a déjà `selectionId` (produit sélectionné) et le
  menu contextuel — il suffit d'y ajouter une entrée "Sortir" et de
  transmettre le produit pré-sélectionné à la fenêtre de sortie.
- Le ruban (`Ruban.tsx`) a déjà "Sorties de stock" dans la catégorie
  Réceptions/Expéditions (pointant vers un `ComingSoon`) ; "Réintégration"
  n'existe pas encore comme action.

## Plan détaillé

### 1. Décisions validées avec Jean Didier

- **Sortie** (remplir + valider = déduction immédiate) : Administrateur,
  Superviseur Entrepôt, Gestionnaire d'entrepôt, Magasinier (mêmes règles
  que la saisie d'une réception).
- **Réintégration** (annuler une sortie) : Administrateur, Superviseur
  Entrepôt, Gestionnaire d'entrepôt — pas le Magasinier (mêmes règles que
  la validation d'une réception).

**Correction du 30/08/2026** (après captures AIRSTOCK détaillées) :
première version rejetée par Jean Didier ("ce n'est pas ce que je t'ai
demandé"). Deux points revus :
- **Sortie Manuelle et Réintégration sont des onglets** (`TabsContext`),
  pas des fenêtres modales — cohérent avec le reste de l'appli.
- **Suivi des réintégrations ligne de sortie par ligne de sortie**
  (comme AIRSTOCK), pas au niveau agrégé produit+entrepôt comme
  initialement simplifié — chaque réintégration cible précisément une
  `bons_sortie_lignes` et ne peut pas dépasser son solde propre.
- Écran de liste séparé pour les sorties (`Sorties.tsx` v1, liste des
  bons) retiré : "Sorties Manuelles" ouvre directement la fenêtre de
  saisie en onglet (l'historique viendra avec le futur écran "Gestion
  des mouvements", chantier séparé).

### 2. Schéma

- `mouvements_stock` : type étendu à `'reintegration'`.
- RLS d'écriture (insert) sur `bons_sortie`/`bons_sortie_lignes` : tous
  les rôles opérationnels, sur leurs entrepôts visibles.
- Nouvelles tables `reintegrations` (numéro, entrepôt, demandeur, notes)
  et `reintegrations_lignes` (**`bon_sortie_ligne_id`** vers la ligne de
  sortie précise réintégrée, emplacement destination, quantité, notes) +
  RLS (lecture par entrepôt visible, écriture réservée à
  Administrateur/Superviseur/Gestionnaire).
- Policy UPDATE supplémentaire sur `bons_sortie_lignes` (verrou
  seulement, aucune vraie mise à jour) : Postgres exige une policy RLS
  UPDATE — pas seulement SELECT — pour qu'un `for update` puisse voir la
  ligne, sinon elle disparaît silencieusement du résultat.
- Séquences de numérotation (`SOR-<année>-...`, `REINT-<année>-...`).
- Vue `v_sorties_a_reintegrer` : une ligne = une `bons_sortie_lignes`
  confirmée avec son solde restant (quantité sortie moins déjà
  réintégré **sur cette ligne précise**), ne montre que les lignes avec
  un solde positif — alimente le "Détail des sorties" de la fenêtre
  Réintégration, filtrable par dates côté client.
- Fonction `creer_sortie(entrepot, motif, lignes jsonb)` : inchangée —
  pour chaque ligne, vérifie le stock disponible à l'emplacement
  (verrou), le décrémente, insère un mouvement `sortie`, crée le bon +
  ses lignes en une transaction, statut `confirmee` directement.
- Fonction `creer_reintegration(entrepot, notes, lignes jsonb)` :
  chaque ligne cible un `bon_sortie_ligne_id` précis, verrouillé via
  `for update of bsl` le temps de la transaction (empêche une vraie
  course sur la même ligne, contrairement à l'agrégat de la v1),
  vérifie que la quantité ne dépasse pas le solde de cette ligne,
  incrémente le stock à l'emplacement choisi, insère un mouvement
  `reintegration`, crée l'en-tête + les lignes.

### 3. Couche API

- `src/lib/api/sorties.ts` : `creerSortie(...)` (plus de liste, retirée
  avec l'écran de liste).
- `src/lib/api/reintegrations.ts` : `getSortiesAReintegrer(entrepotId,
  {dateDebut, dateFin})` (lignes individuelles filtrables par dates),
  `creerReintegration(...)` (lignes avec `bonSortieLigneId`).

### 4. UI

- `src/context/SelectionContext.tsx` (nouveau) : mémorise le produit
  actuellement sélectionné (clic simple) dans Produits, pour que le
  ruban sache quoi pré-remplir quand on clique "Sorties Manuelles" —
  même si l'onglet Sortie est déjà ouvert (jeton incrémenté à chaque
  clic pour forcer la prise en compte).
- `src/pages/Sorties.tsx` (onglet, plus une liste) : en-tête façon
  AIRSTOCK (Référence/Désignation/Dépôt/Localisation/Opérateur/Bon de
  sortie/Date/Notes), recherche + liste à gauche, panier + validation à
  droite. Réagit au signal du ruban pour pré-remplir le produit choisi
  dans Produits.
- `src/pages/Reintegration.tsx` (onglet, nouveau) : même structure
  d'en-tête, liste de gauche "Références à réintégrer" (agrégée par
  produit pour la recherche), "Détail des sorties" filtrable par dates
  (Entre le/et le) montrant chaque ligne de sortie individuellement
  réintégrable, clic sur une ligne → quantité maxi + quantité à
  réintégrer + emplacement de retour → "Ajouter au panier" → "Valider".
- `Produits.tsx` : le clic simple sur une ligne alimente
  `SelectionContext` (en plus de la sélection locale déjà existante) ;
  plus d'entrée "Sortir cette référence" dans le menu contextuel (le
  flux passe par le ruban, pas le clic droit).
- `Ruban.tsx` : "Sorties Manuelles" et "Réintégration" sont des actions
  `ouvrirOnglet` normales ; "Sorties Manuelles" déclenche en plus
  `declencherSortieManuelle(produitSelectionneId)` avant d'ouvrir
  l'onglet.
- `AppShell.tsx` : ajoute `SelectionProvider` autour de `TabsProvider`,
  et `reintegration: Reintegration` dans la table des composants
  d'onglets.

### 5. Corrections d'interface après retours successifs (30-31/08/2026)

- Recherche par référence uniquement (pas désignation), convention `*` =
  "contient" (comme Produits), mutualisée dans `lib/filtreTexte.ts`
  (Produits.tsx refactoré pour réutiliser la même fonction).
- Liste de gauche toujours peuplée (tous les produits en stock pour
  Sortie, toutes les lignes réintégrables pour Réintégration), plus
  seulement au moment de la frappe — la recherche filtre une liste déjà
  visible, ne la fait pas apparaître.
- En-tête restructuré exactement façon AIRSTOCK : deux blocs côte à côte
  (colonne gauche Référence/Désignation/Dépôt/Localisation/Quantité
  maxi/Quantité à sortir-réintégrer ; colonne droite Opérateur/Bon/Date
  du mouvement + Notes en zone de texte étirée sur la hauteur du bloc).
- Boutons Ajouter/Supprimer sous la liste de gauche (position réelle sur
  la capture AIRSTOCK), pas un bouton contextuel flottant.
- Densité générale revue (champs compacts, panneaux resserrés) après un
  premier retour "tu exploites mal l'espace de l'écran".
- "Date du mouvement" rendue modifiable (pré-remplie à aujourd'hui) :
  `creer_sortie`/`creer_reintegration` acceptent un `p_date_mouvement`
  optionnel (`timestamptz default null`, sinon `now()`), utilisé pour
  `cree_le` du bon/de la réintégration et du mouvement de stock associé.
  Nécessite un `drop function` avant `create or replace` car ajouter un
  paramètre change la signature (sinon Postgres crée un second overload
  et le `grant` suivant échoue avec "function name is not unique").
  Conversion date-saisie + heure-actuelle → ISO mutualisée dans
  `lib/dates.ts` (évite les décalages de fuseau horaire).

## Points de vigilance

- **Verrou RLS sur `for update`** : toute future fonction RPC qui pose
  un `for update`/`for update of` sur une table avec RLS doit avoir une
  policy UPDATE (même verrou-only, sans vraie mise à jour prévue),
  sinon Postgres exclut silencieusement les lignes du résultat au lieu
  de renvoyer une erreur claire — piège rencontré et corrigé ici sur
  `bons_sortie_lignes`, à surveiller pour Transferts/Inventaires plus
  tard.
- **Destinataire/motif au niveau du bon de sortie entier**, pas ligne
  par ligne (un panier = une seule destination), pour rester cohérent
  avec le schéma déjà posé (`bons_sortie.motif`).
- **Pas de SN/Lot affiché** dans le "Détail des sorties" (contrairement
  à la capture AIRSTOCK) : `bons_sortie_lignes`/`stock_produits` ne
  suivent pas le lot/numéro de série au niveau de la ligne actuellement
  — fonctionnalité plus large à traiter si besoin, pas dans ce chantier.

## Avancement

- [x] Décisions validées avec Jean Didier (permissions)
- [x] Correction après captures AIRSTOCK : onglets au lieu de modales,
      suivi ligne de sortie par ligne de sortie au lieu de l'agrégat
- [x] Schéma v2 (`bon_sortie_ligne_id` sur `reintegrations_lignes`, vue
      `v_sorties_a_reintegrer`, fonction `creer_reintegration` avec
      verrou par ligne, policy UPDATE de verrouillage sur
      `bons_sortie_lignes`) — appliqué en base et testé (partiel, refus
      dépassement, complémentaire jusqu'à disparition de la vue) via
      transaction annulée, aucune donnée réelle touchée
- [x] Couche API mise à jour
- [x] UI en onglets (`Sorties.tsx`, `Reintegration.tsx`,
      `SelectionContext`, intégration Ruban/AppShell/Produits) ;
      `tsc -b`, `oxlint`, `vite build` passent sans erreur
- [x] Corrections d'interface après retours successifs (filtre par
      référence + `*`, liste toujours peuplée, en-tête façon AIRSTOCK,
      densité, date du mouvement modifiable)
- [x] Vérification en local par Jean Didier — validée itérativement au
      fil des échanges (captures, corrections, confirmations explicites
      "c'est ça", "effectivement")

---

# Coquille applicative façon AIRSTOCK (ruban + onglets)

**Statut :** terminé
**Démarré le :** 28/08/2026

## Objectif

Jean Didier revient sur une décision prise plus tôt (mémoire
`ui_dense_tables.md` : "le menu latéral actuel reste tel quel") : il veut
maintenant que **toute l'application**, Dashboard inclus, adopte la
structure d'AIRSTOCK — un ruban horizontal en haut à la place du menu
latéral, et la possibilité d'avoir plusieurs écrans ouverts en même temps
sous forme d'onglets internes (comme les onglets "Gestion du stock..." /
"Expéditions..." visibles sur sa capture), pour gagner en largeur d'écran.
Confirmé avec lui : "plusieurs fenêtres" = des onglets à l'intérieur de
l'application (pas de vraies fenêtres du bureau Windows).

Trois demandes plus ponctuelles regroupées dans le même retour :
1. Filtrage par colonne (déjà fait depuis le chantier précédent — à
   reconfirmer avec Jean Didier si ce n'est pas ce qu'il voit).
2. Volets figés (en-têtes de tableau fixes au défilement) — exemple image
   non reçu, principe général appliqué en attendant confirmation.
3. Workflow des Sorties décrit en détail (sortir un produit, saisir les
   infos, valider = déduction automatique, "Réintégration" pour annuler
   sans supprimer l'historique) — noté pour le prochain chantier dédié
   (Sorties), pas traité ici.

## Analyse de l'existant

- `AppShell.tsx` : sidebar (`Sidebar.tsx`) + zone de contenu unique
  pilotée par React Router (`<Outlet />`), une route par écran sous
  `/stocks/*` (`App.tsx`).
- Chaque écran (`Dashboard.tsx`, `Produits.tsx`, `Entrepots.tsx`,
  `Receptions.tsx`) est autonome : il charge ses propres données au
  montage, ne dépend d'aucun paramètre d'URL. Ils peuvent donc être rendus
  tels quels dans un panneau d'onglet sans modification interne.
- Aucune notion d'onglets/fenêtres multiples n'existe dans le code actuel.

## Plan détaillé

### 1. Onglets internes (état applicatif, pas d'URL par onglet)

- `src/context/TabsContext.tsx` : liste des onglets ouverts
  (`{ id, titre, ecran }`), onglet actif, actions `ouvrirOnglet`,
  `fermerOnglet`, `activerOnglet`. Un seul onglet par écran (cliquer une
  2e fois sur "Produits" dans le ruban focus l'onglet existant plutôt que
  d'en ouvrir un doublon).
- L'onglet Dashboard est ouvert par défaut et non fermable (onglet
  "accueil"), les autres sont fermables.
- Tous les onglets ouverts restent montés dans le DOM (affichage/masquage
  en CSS, pas de démontage) pour conserver leur état (sélection, filtres,
  défilement) quand on bascule de l'un à l'autre.
- Conséquence assumée : plus de route dédiée par écran (`/stocks/produits`
  disparaît) — tout vit sous une seule route `/stocks`, la navigation se
  fait par le ruban et les onglets, pas par l'URL. Voir Points de
  vigilance.

### 2. Ruban (remplace `Sidebar.tsx`)

- `src/components/layout/Ruban.tsx` : deux niveaux, comme AIRSTOCK.
  Ligne du haut = catégories ; ligne du bas = boutons icône+libellé de la
  catégorie active, chacun appelant `ouvrirOnglet`.
- Catégories initiales, calées sur les écrans existants (les catégories
  vides ne sont pas créées à l'avance, elles apparaîtront quand les
  écrans correspondants seront construits) :
  - **Magasin** : Dashboard, Produits, Entrepôts, Alertes stock
  - **Réceptions/Expéditions** : Entrées de stock, Sorties de stock
  - **Logistique** : Mouvements de stock, Inventaires

### 3. Barre d'onglets

- `src/components/layout/BarreOnglets.tsx` : un onglet par écran ouvert
  (titre + croix pour fermer, sauf Dashboard), sous le ruban.

### 4. Refonte de `AppShell.tsx` et `App.tsx`

- `AppShell` : Topbar (inchangée) → Ruban → Barre d'onglets → zone de
  contenu qui rend tous les onglets ouverts (masqués sauf l'actif).
- `App.tsx` : simplifié, une seule route `/stocks` sous `RequireAuth`
  (plus de sous-routes par écran).
- `Sidebar.tsx` et `navigation.ts` retirés (remplacés par le Ruban).

### 5. Volets figés

- En-tête de tableau (`<thead>`) en `sticky top-0` sur les écrans Produits/
  Entrepôts/Réceptions, pour rester visible pendant le défilement d'une
  longue liste.

## Points de vigilance

- **Plus de lien direct par URL vers un écran précis** (ex.
  `/stocks/produits` ne fonctionnera plus, tout passe par `/stocks` puis
  navigation au ruban). C'est cohérent avec le fonctionnement d'AIRSTOCK
  (un logiciel de bureau, sans notion d'URL), mais c'est un vrai
  changement pour une application web — à confirmer que ça ne pose pas
  de problème (ex. impossible de mettre un écran précis en favori).
- **Catégories du ruban** : celles proposées ici sont une adaptation
  raisonnable d'AIRSTOCK à ce qu'on a déjà construit, pas une copie
  exacte (AIRSTOCK a aussi Contrôle, Impressions, Ressources Humaines,
  Options — elles arriveront quand les écrans correspondants
  existeront : Rapports, Utilisateurs, Paramètres...).
- **Onglets = un seul par écran** pour l'instant (pas plusieurs instances
  du même écran ouvertes simultanément, contrairement à ce qu'AIRSTOCK
  permet parfois) — plus simple, à revoir si besoin réel démontré.
- **Volets figés** : juste l'en-tête pour l'instant (pas de colonnes
  figées horizontalement) faute d'avoir reçu l'image d'exemple ; à
  ajuster dès que Jean Didier confirme/renvoie l'exemple.
- **Sorties** : le workflow décrit (sortir → saisir → valider → déduction
  automatique ; "Réintégration" pour annuler sans supprimer, garder
  l'historique) est noté et sera le sujet du prochain chantier, pas
  construit ici.
- Mémoire `ui_dense_tables.md` mise à jour pour refléter ce changement de
  direction (le menu latéral ne reste plus "tel quel").

## Avancement

- [x] Décisions validées avec Jean Didier (onglets internes, ruban partout
      y compris Dashboard)
- [x] `TabsContext` (un onglet par écran, Dashboard non fermable, tous les
      onglets ouverts restent montés pour conserver leur état)
- [x] `Ruban.tsx` (3 catégories : Magasin, Réceptions/Expéditions,
      Logistique), `BarreOnglets.tsx`
- [x] Refonte `AppShell.tsx` (Topbar → Ruban → Barre d'onglets → contenu)
      et `App.tsx` (une seule route `/stocks`) ; `Sidebar.tsx` et
      `navigation.ts` supprimés ; logo Jupply déplacé dans la Topbar
- [x] Volets figés — précisé par Jean Didier avec captures à l'appui :
      l'en-tête ET le panneau du bas doivent rester fixes, seule la liste
      au milieu défile. Écrans Produits et Entrées de stock restructurés
      en 3 zones sur la hauteur pleine de l'onglet (plus de défilement de
      toute la page) : titre (fixe) → tableau (défile dans sa zone
      propre, en-tête collé en haut) → panneau de détail bas d'écran
      (fixe, avec son propre défilement interne si son contenu est trop
      grand). `AppShell.tsx`/`Dashboard.tsx`/`Entrepots.tsx`/
      `ComingSoon.tsx` adaptés en conséquence (le défilement de page se
      fait maintenant écran par écran, pas au niveau de la coquille).
- [x] `tsc -b`, `oxlint` et `vite build` passent sans erreur
- [x] Jean Didier a testé et signalé un vrai problème (voir section
      ci-dessous) — traité avant de redemander une vérification

## Retour de Jean Didier : densité de l'écran très en dessous d'AIRSTOCK

Capture à l'appui : chez lui, le tableau occupe la quasi-totalité de
l'écran (15-20 lignes visibles) ; chez nous, une seule ligne était visible
avant de devoir défiler, le reste étant mangé par des marges généreuses et
un bloc que Jean Didier n'avait pas demandé (ligne Catégorie/Type/PMP/
Seuils + bloc Fournisseurs/Produits équivalents, affiché en permanence
sous le tableau). Correction expliquée puis validée avant exécution :

1. **Retrait** de ce bloc de la zone permanente de l'écran Produits.
   Contenu déplacé dans une **fiche produit** séparée (nouvelle modale
   `FicheProduitModal`), ouverte par double-clic sur une ligne ou via
   "Voir la fiche référence" dans le menu clic droit — reprend le libellé
   exact vu sur la capture AIRSTOCK d'origine.
2. **Rééquilibrage de l'espace** : le tableau redevient la zone
   dominante (`flex-1`), le panneau du bas (Stock par dépôt + Derniers
   mouvements) est plafonné à `26vh` au lieu de `42vh`, et son contenu
   n'inclut plus que ces deux tableaux.
3. **Densification générale** : marges de la page (`p-7` → `p-4`),
   espacement entre blocs (`gap-4` → `gap-2`), coins arrondis réduits
   (`rounded-2xl` → `rounded-lg`), cellules de tableau resserrées
   (`py-2` → `py-1`), texte du panneau du bas réduit (`text-sm` →
   `text-xs`). Appliqué à Produits et Entrées de stock.
4. **Coquille applicative** aussi allégée : Topbar `h-14` → `h-10`,
   ruban et barre d'onglets avec paddings/icônes réduits — chaque pixel
   de chrome fixe est un pixel en moins pour le tableau.

Mémoire `ui_dense_tables.md` mise à jour avec la leçon retenue (vérifier
concrètement "combien de lignes visibles sans défiler" avant de considérer
un écran dense comme terminé).

## Avancement (correction densité)

- [x] Bloc info + Fournisseurs/Équivalents déplacé dans `FicheProduitModal`
      (double-clic ou "Voir la fiche référence")
- [x] Rééquilibrage tableau/panneau du bas + densification (Produits,
      Entrées de stock, Topbar, Ruban, Barre d'onglets)
- [x] `tsc -b`, `oxlint` et `vite build` passent sans erreur
- [x] Jean Didier a demandé un ajustement du filtrage (voir section
      ci-dessous), traité avant nouvelle vérification

## Filtrage façon AIRSTOCK : clic sur la colonne + saisie au clavier

Précisé par Jean Didier sur plusieurs échanges, capture à l'appui : la
ligne de filtres séparée sous les en-têtes ne correspond pas à ce qu'il
veut. Comportement demandé : cliquer n'importe où dans une colonne (peu
importe la ligne) l'active ; taper ensuite au clavier, sans avoir besoin
de cliquer dans une case de saisie précise, remplit un filtre qui
s'affiche dans une petite case au-dessus de l'en-tête (l'en-tête lui-même
ne change pas) ; le tableau se filtre au fur et à mesure. Confirmé
applicable à Référence, Désignation, Catégorie, Type, Statut et
Localisation ; exclu pour Stock et Commande (colonnes numériques).

Implémenté : `colonneActive` (état), capture clavier globale via
`window.addEventListener('keydown', ...)` dans un `useEffect` (pas de
`<input>` à focus), gardée par deux conditions importantes — l'onglet
Produits doit être l'onglet actif (`useTabs()`) sinon un autre onglet en
arrière-plan capterait aussi les touches, et aucune modale ne doit être
ouverte (sinon la saisie dans une modale pourrait fuiter vers le filtre).
Clic sur une cellule de données active sa colonne (en plus de sélectionner
la ligne, comportement existant conservé). Petite case indicatrice
au-dessus de l'en-tête, vide pour les colonnes inactives.

## Avancement (filtrage)

- [x] `colonneActive` + capture clavier globale (gardée par onglet actif
      et absence de modale ouverte)
- [x] Ligne indicatrice au-dessus des en-têtes (`IndicateurFiltre`),
      en-têtes eux-mêmes inchangés
- [x] Filtres étendus à Statut et Localisation (en plus de Référence/
      Désignation/Catégorie/Type déjà là), Stock et Commande exclus
- [x] Ancienne ligne de filtres (cases de saisie sous les en-têtes)
      supprimée
- [x] `tsc -b`, `oxlint` et `vite build` passent sans erreur
- [x] Jean Didier est passé au chantier suivant (Sorties/Réintégrations)
      sans signaler de problème — considéré comme validé de facto

---

# Écran Entrées de stock (Réceptions)

**Statut :** terminé
**Démarré le :** 28/08/2026

## Objectif

Cahier des charges, section 6 (Flux de réception) et section 17 (MVP :
"Enregistrer les entrées"). Une réception a un numéro, un entrepôt, un
fournisseur et un numéro de PO optionnels, et une ou plusieurs lignes
(produit, quantité attendue, quantité reçue, lot/N° série/date
d'expiration si le produit les gère, prix unitaire, emplacement de
destination). Contrairement aux actions rapides déjà construites
(affecter/déplacer une localisation), le cahier des charges impose ici un
vrai processus en **deux étapes distinctes** : saisie, puis validation —
le stock n'augmente qu'à la validation.

## Analyse de l'existant

- `receptions` et `receptions_lignes` existent déjà en base (chantier de
  refonte du schéma), avec des données de démo, mais **aucune policy RLS
  d'écriture**, et rien ne les relie encore à `stock_produits`/
  `mouvements_stock` — la validation n'a jamais été implémentée.
- `produits.prix_moyen_pondere` existe mais n'est encore recalculé nulle
  part (toujours la valeur de démo figée).
- Route `App.tsx` : `<Route path="entrees" element={<ComingSoon titre="Entrées de stock" />} />`.
- Patterns réutilisables du chantier précédent : fonctions PostgreSQL
  `security invoker` pour l'atomicité, menu clic droit
  (`MenuContextuel.tsx`), tableau dense + panneau de détail
  (`Produits.tsx`), création de catégorie/fournisseur à la volée déjà
  présente dans `NouveauProduitModal`.
- Cahier des charges, section 5 : avertissement si le produit a déjà un
  emplacement différent dans le même entrepôt — non traité jusqu'ici
  (mis de côté lors du chantier Entrepôts), c'est le bon moment puisque
  la Réception est l'endroit où l'on choisit un emplacement pour du stock
  qui arrive.

## Plan détaillé

### 1. Décisions validées avec Jean Didier

- **Saisie** (créer une réception, statut `en_attente`) : Administrateur,
  Superviseur Entrepôt, Gestionnaire d'entrepôt, Magasinier (limités à
  leurs entrepôts assignés pour Gestionnaire/Magasinier).
- **Validation** (fait réellement augmenter le stock) : Administrateur,
  Superviseur Entrepôt, Gestionnaire d'entrepôt. Le Magasinier peut
  saisir mais pas valider — l'"autorisation ponctuelle" évoquée par le
  cahier des charges nécessiterait un mécanisme de permission plus fin
  qu'on n'a pas encore ; reporté à plus tard si besoin réel démontré.

### 2. Schéma

- RLS d'écriture sur `receptions` (insert/update par les rôles ci-dessus,
  limités à leurs entrepôts visibles) et `receptions_lignes` (insert/
  update via la réception parente).
- Séquence Postgres pour numéroter les réceptions sans risque de
  collision en cas de créations simultanées (`REC-<année>-<numéro>`).
- `creer_reception(entrepot, fournisseur, numero_po, lignes jsonb)` :
  crée l'en-tête + toutes les lignes en une seule transaction, statut
  `en_attente`.
- `valider_reception(reception_id)` : pour chaque ligne, calcule la
  répartition stock normal / quarantaine (voir règles ci-dessous),
  insère les mouvements `entree` correspondants, met à jour
  `stock_produits`, recalcule `produits.prix_moyen_pondere` (moyenne
  pondérée sur le stock total du produit, tous entrepôts confondus), puis
  met à jour le statut de la réception et `valide_par`/`valide_le`.

Règles de répartition à la validation (cahier des charges, section 6) :
- Ligne marquée anomalie → toute la quantité reçue part en Quarantaine.
- Sinon, si quantité reçue > attendue → la part "attendue" va à
  l'emplacement choisi, le surplus part en Quarantaine.
- Sinon → toute la quantité reçue va à l'emplacement choisi (complet ou
  partiel).
- Statut global : `validee` si toutes les lignes conformes et complètes,
  `partielle` si au moins une ligne incomplète, `anomalie` si au moins une
  ligne marquée anomalie.

### 3. Couche API (`src/lib/api/receptions.ts`, nouveau fichier)

- `getReceptions()`, `getReceptionDetail(id)` (en-tête + lignes).
- `creerReception(...)`, `validerReception(id)` — appellent les fonctions
  SQL via `supabase.rpc(...)`.

### 4. UI — `src/pages/Receptions.tsx` (remplace le `ComingSoon`)

- Tableau dense (numéro, entrepôt, fournisseur, statut, date), style
  cohérent avec Produits/Entrepôts.
- Clic droit → "Nouvelle réception" (rôles autorisés).
- Modale de saisie : entrepôt, fournisseur (sélection ou création à la
  volée), n° de PO, puis lignes ajoutables (produit, quantité attendue/
  reçue, emplacement — avec avertissement si le produit est déjà stocké
  ailleurs dans cet entrepôt —, lot/série/expiration si le produit les
  gère, prix unitaire, case anomalie).
- Clic sur une réception → panneau de détail listant ses lignes ; bouton
  "Valider" si statut `en_attente` et rôle autorisé.
- `App.tsx` : route `entrees` pointe vers `Receptions`. Nav : le libellé
  actuel "Entrées de stock" est conservé (déjà aligné avec le cahier des
  charges).

## Points de vigilance

- **PMP recalculé sur le stock total du produit**, tous entrepôts
  confondus (cohérent avec le fait que `prix_moyen_pondere` est une
  colonne unique sur `produits`, pas par entrepôt).
- **Pas d'écran Fournisseurs/PO dédié** (décision actée du cahier des
  charges, section 6) : le numéro de PO reste un champ texte libre saisi
  à la réception.
- **Reliquat sur réception partielle** : pour l'instant, compléter un
  reliquat se fait en créant une nouvelle réception plutôt qu'en rouvrant
  l'ancienne — plus simple, cohérent avec le fait qu'aucun écran Achats/PO
  formel n'existe en V1.

## Avancement

- [x] Décisions validées avec Jean Didier (permissions saisie/validation)
- [x] Schéma : séquence de numérotation, RLS d'écriture (`receptions`,
      `receptions_lignes`), fonctions RPC `creer_reception`/
      `valider_reception` — appliqués en base (additif, vérifié
      structurellement + testé fonctionnellement en conditions réelles :
      session simulée avec le rôle `authenticated` et l'UID de Jean
      Didier, dans une transaction annulée ensuite — cas testés : surplus
      partiellement en quarantaine, ligne anomalie entièrement en
      quarantaine, recalcul du PMP correct sur les deux produits,
      mouvements bien journalisés, aucune donnée réelle modifiée)
- [x] Couche API (`src/lib/api/receptions.ts`)
- [x] UI : écran `Receptions.tsx` (tableau dense, clic droit "Nouvelle
      réception", panneau de détail avec bouton "Valider" selon le rôle
      et le statut), modale de saisie multi-lignes avec fournisseur
      créable à la volée, champs lot/N° série/expiration conditionnels
      selon le produit, avertissement si le produit a déjà un emplacement
      différent dans cet entrepôt, case anomalie par ligne
- [x] `tsc -b` et `oxlint` passent sans erreur
- [x] Jean Didier est passé à la suite (retour détaillé sur d'autres sujets
      — filtres, volets figés, coquille applicative, Sorties — sans
      signaler de problème sur les Réceptions elles-mêmes) — considéré
      comme validé de facto

---

# Attribution et déplacement de localisation

**Statut :** terminé
**Démarré le :** 28/08/2026

## Objectif

Gap identifié par Jean Didier en relisant l'écran Produits : aucune action
n'écrit encore réellement dans `stock_produits` — tout le stock affiché
vient uniquement des données de démo. Il faut deux actions, accessibles
depuis le **menu clic droit sur un produit** (comme "Nouvelle référence"/
"Supprimer cette référence" déjà en place) :

1. **Affecter une localisation** : placer une quantité de stock à un
   emplacement précis (entrepôt + emplacement).
2. **Modifier une localisation** : déplacer une quantité de stock d'un
   emplacement à un autre, **au sein du même entrepôt** (le déplacement
   entre entrepôts reste couvert par le futur écran Transferts). Doit
   garder un historique complet.

## Analyse de l'existant

- `stock_produits` et `mouvements_stock` n'ont **aucune policy RLS
  d'écriture** — seule la lecture est couverte jusqu'ici. C'est la racine
  du problème : rien ne permet d'y écrire depuis l'application.
- `mouvements_stock` n'a pas de colonne pour distinguer "d'où" un
  déplacement vient (seul `emplacement_id` existe, une colonne = une
  destination). Il manque `emplacement_origine_id` et un type
  `'deplacement'` dans le check constraint du type.
- Le menu contextuel (`components/ui/MenuContextuel.tsx`) et son usage
  dans `Produits.tsx` (`onClicDroitLigne`) sont déjà en place, il suffit
  d'y ajouter deux entrées.
- `lib/api/entrepots.ts` a déjà `getEmplacements(entrepotId)`, réutilisable
  pour peupler les listes déroulantes des modales.
- Cahier des charges (section 19) : "En cas d'opérations simultanées par
  deux utilisateurs, le système doit éviter toute incohérence." Une
  opération en plusieurs étapes (lire le stock, le corriger, insérer le
  mouvement) faite en plusieurs appels depuis le navigateur n'offre pas
  cette garantie.

## Plan détaillé

### 1. Schéma

- `mouvements_stock` : ajout de `emplacement_origine_id` (nullable, `references emplacements`)
  et extension du type à `'deplacement'`.
- Deux fonctions PostgreSQL (`security invoker`, donc toujours soumises
  aux policies RLS de l'appelant) exécutées comme une seule transaction
  atomique, avec verrou (`for update`) sur la ligne source pour le
  déplacement — répond à l'exigence de cohérence en cas d'accès
  concurrents :
  - `affecter_localisation(produit, entrepot, emplacement, quantite, reference)` :
    crée/augmente la ligne `stock_produits`, insère un mouvement `entree`.
  - `deplacer_stock(produit, entrepot, emplacement_source, emplacement_destination, quantite, reference)` :
    vérifie le stock disponible à la source, décrémente/supprime la ligne
    source, crée/augmente la ligne destination, insère un mouvement
    `deplacement` avec origine et destination.
- RLS d'écriture sur `stock_produits` (insert/update/delete) et
  `mouvements_stock` (insert) : autorisé si `entrepot_id` fait partie des
  `entrepots_visibles()` de l'utilisateur (Administrateur/Superviseur :
  partout ; Gestionnaire/Magasinier : leurs entrepôts assignés). Même
  principe que pour les emplacements, étendu au Magasinier puisque la
  saisie quotidienne de stock fait partie de son rôle standard.

### 2. Couche API (`src/lib/api/localisation.ts`, nouveau fichier)

- `affecterLocalisation(...)`, `deplacerStock(...)` — appellent les
  fonctions SQL via `supabase.rpc(...)`.

### 3. UI (`Produits.tsx`)

- Menu clic droit sur un produit : "Affecter une localisation" (toujours
  proposé), "Modifier la localisation" (seulement si le produit a déjà du
  stock quelque part).
- Modale "Affecter" : Entrepôt, Emplacement (dépendant de l'entrepôt
  choisi, Quarantaine incluse mais signalée), Quantité.
- Modale "Modifier" : Entrepôt (limité à ceux où ce produit a du stock),
  Emplacement source (limité aux emplacements où ce produit a du stock
  dans cet entrepôt), Emplacement destination (les autres emplacements de
  ce même entrepôt), Quantité (plafonnée au stock disponible à la source).
- Après action réussie : rechargement des données de l'écran (stock,
  localisations, mouvements si le produit est sélectionné).

## Points de vigilance

- **Portée du déplacement** : même entrepôt uniquement, comme validé.
  Déplacer vers un autre entrepôt reste réservé au futur écran Transferts
  (workflow demande/validation/expédition/réception, différent d'un
  simple déplacement direct).
- **Permissions élargies au Magasinier** pour l'écriture de stock (à la
  différence de la gestion des emplacements eux-mêmes, réservée à partir
  de Gestionnaire) : cohérent avec son rôle de saisie quotidienne, mais à
  signaler — c'est une extension par rapport aux règles validées sur
  l'écran Entrepôts.
- **Référence de mouvement** générée côté client (ex. `AFF-<horodatage>`,
  `DEP-<horodatage>`), pas de numérotation séquentielle formelle pour
  l'instant — suffisant pour un outil manuel, à revoir si un vrai numéro
  de bon devient nécessaire.
- **Atomicité** : les deux actions passent par des fonctions PostgreSQL
  (pas plusieurs appels séparés depuis le navigateur), pour garantir
  qu'un déplacement ne peut jamais laisser le stock dans un état
  incohérent, même en cas d'accès concurrents.

## Avancement

- [x] Analyse de l'existant
- [x] Décisions validées avec Jean Didier (accès via menu clic droit,
      déplacement limité au même entrepôt)
- [x] Schéma : colonne `emplacement_origine_id`, type `'deplacement'`,
      RLS d'écriture (`stock_produits`, `mouvements_stock`), fonctions RPC
      `affecter_localisation`/`deplacer_stock` — appliqués en base
      (additif, vérifié structurellement + testé fonctionnellement en
      conditions réelles : session simulée avec le rôle `authenticated`
      et l'UID de Jean Didier, dans une transaction annulée ensuite
      — affectation et déplacement corrects, mouvements bien journalisés,
      aucune donnée réelle modifiée)
- [x] Couche API (`src/lib/api/localisation.ts`)
- [x] UI : menu clic droit enrichi ("Affecter une localisation", "Modifier
      la localisation" si le produit a déjà du stock, "Supprimer" marqué
      dangereux), modale Affecter (entrepôt/emplacement/quantité), modale
      Modifier (entrepôt limité à ceux où le produit est présent, source/
      destination/quantité plafonnée)
- [x] `tsc -b` et `oxlint` passent sans erreur
- [x] Jean Didier est passé à la suite ("nous allons travailler sur les
      entrées") sans signaler de problème — considéré comme validé de
      facto

---

# Écran Produits

**Statut :** terminé
**Démarré le :** 27/08/2026

## Objectif

Deuxième écran métier de la feuille de route. Cahier des charges, section
16 : "Liste des produits, catégorie, référence, seuils, stock réel,
localisation, quantité commandée, produits équivalents, historique des
mouvements par produit." Section 4 : attributs produit, produits
équivalents, recherche avec `*`. Section 17 (MVP) : "Créer les produits."

Premier écran à adopter la présentation dense inspirée d'AIRSTOCK validée
avec Jean Didier (voir mémoire `ui_dense_tables.md`) : tableau compact avec
beaucoup de colonnes visibles, et un panneau de détail qui s'ouvre en bas
au clic sur une ligne — dans le style visuel Jupply actuel (couleurs,
police, coins arrondis), pas une reproduction grise façon logiciel des
années 2000.

## Analyse de l'existant

- `produits`, `categories`, `fournisseurs`, `produits_fournisseurs`,
  `produits_equivalents`, `groupes_variantes` existent déjà en base
  (chantier de refonte du schéma), avec seulement des policies de
  **lecture**. Aucune policy d'écriture.
- `types/stock.ts` a déjà `Produit`, `ProduitAvecStock`, `Fournisseur`.
  Il manque un type pour les produits équivalents et pour la localisation
  par produit.
- `lib/api/stock.ts` a déjà `getProduitsAvecStock()` (vue `v_produits_stock`,
  stock disponible hors quarantaine) et `getMouvementsRecents()` — je les
  réutilise, en ajoutant les requêtes propres à cet écran dans un nouveau
  fichier `lib/api/produits.ts`.
- Aucune notion de "quantité commandée" n'est encore exposée : elle se
  déduit des `receptions_lignes` des réceptions au statut `en_attente`
  (quantité attendue restante). Une petite vue SQL est nécessaire.
- Route actuelle : `App.tsx` a `<Route path="produits" element={<ComingSoon titre="Produits" />} />`.
- `lib/permissions.ts` et `components/ui/Modal.tsx` existent déjà (chantier
  Entrepôts) et sont réutilisés tels quels.

## Plan détaillé

### 1. RLS (écriture)

Proposition (à valider, voir question posée séparément) : création/
modification/suppression de `produits`, `categories`, `fournisseurs`,
`produits_fournisseurs`, `produits_equivalents` réservées à Administrateur
et Superviseur Entrepôt — cohérent avec le traitement des entrepôts
(catalogue partagé par toute l'entreprise, pas propre à un entrepôt).

### 2. Vue SQL `v_produits_commandes`

Somme, par produit, du reliquat attendu sur les réceptions non encore
validées (`receptions.statut = 'en_attente'` ou `'partielle'`) :
`quantite_attendue - quantite_recue`. Alimente la colonne "Commande".

### 3. Couche API (`src/lib/api/produits.ts`, nouveau fichier)

- `getCategories()`, `getFournisseurs()`.
- `getLocalisationsProduits()` : stock par produit × entrepôt ×
  emplacement (hors quarantaine), pour la colonne "Localisation" (résumé :
  nom d'entrepôt si un seul, "N entrepôts" sinon) et le détail du panneau.
- `getCommandesProduits()` : lit `v_produits_commandes`.
- `getMouvementsProduit(produitId)` : historique filtré pour le panneau de
  détail.
- `getEquivalents(produitId)` : produits liés (jointure `produits_equivalents`).
- `creerProduit(donnees)`, `creerCategorie(nom)`, `creerFournisseur(nom, contact)`.
- `lierFournisseur` / `delierFournisseur`, `lierEquivalent` / `delierEquivalent`.

### 4. Permissions

Ajout à `lib/permissions.ts` : `peutGererCatalogue(role)` (produits,
catégories, fournisseurs, équivalents).

### 5. UI — `src/pages/Produits.tsx` (remplace le `ComingSoon`)

- Barre de recherche (référence/désignation). Comportement calé sur le
  cahier des charges (section 4) : recherche normale = "commence par" ;
  préfixe `*` = "contient" (ex. `*5440`).
- Tableau dense : Référence, Désignation, Catégorie, Type (badge
  Consommable/Outillage), Stock disponible (+ statut coloré), Commande,
  Localisation (résumé). Clic sur une ligne = sélection + ouverture du
  panneau de détail en bas (pas de nouvelle page).
- Panneau de détail (bas d'écran, deux colonnes) :
  - **Informations** : catégorie, type, unité, prix moyen pondéré, seuils
    (min/max/réappro), fournisseurs liés, produits équivalents (double-clic
    = sélectionne ce produit dans le tableau, comme demandé section 4).
  - **Mouvements récents** : même style que le composant Dashboard
    existant (entrée verte / sortie rouge / autres neutres), filtré sur ce
    produit.
- Bouton "Nouveau produit" (visible selon `peutGererCatalogue`) → `Modal`
  avec le formulaire (référence, désignation, catégorie — select existant
  ou "+ nouvelle catégorie" en ligne —, type, unité, prix, seuils,
  cases gère-lot/gère-série/gère-expiration, fournisseurs — cases à cocher
  sur la liste existante ou "+ nouveau fournisseur" en ligne).
- `App.tsx` : route `produits` pointe vers `Produits`.

## Points de vigilance

- **Qui peut créer un produit/catégorie/fournisseur** : proposé
  Administrateur + Superviseur Entrepôt (catalogue partagé), à valider —
  question séparée posée à Jean Didier.
- **Stock initial à zéro** : la création d'un produit ne crée aucun stock.
  Le stock n'entre qu'via une réception validée (écran Réceptions, chantier
  suivant) ou l'import Excel (chantier ultérieur), conformément à la règle
  du cahier des charges ("le stock n'est augmenté qu'après validation de
  la réception").
- **Variantes** (`groupes_variantes`) explicitement hors périmètre de ce
  chantier : le champ existe en base mais aucune UI de regroupement n'est
  construite maintenant, faute de cas d'usage démontré dans les données
  actuelles. À reprendre si Jean Didier en a besoin concrètement.
- Pas d'abstraction de type "DataTable générique" pour l'instant : le
  tableau est codé directement dans `Produits.tsx`. Si Stock/Mouvements/
  Outillage répètent exactement le même besoin, on en extraira un
  composant partagé à ce moment-là plutôt que d'en deviner la forme à
  l'avance.

## Avancement

- [x] Analyse de l'existant
- [x] Plan rédigé, validé par Jean Didier le 27/08/2026 (catalogue ouvert à
      Admin + Superviseur + Gestionnaire, plus large que pour les entrepôts)
- [x] Vue `v_produits_commandes` + RLS d'écriture (catégories, fournisseurs,
      produits, liens fournisseurs/équivalents) écrites dans `schema.sql` et
      appliquées en base (additif, vérifié via `pg_policies` — 14 policies
      au total sur ces 5 tables, données existantes intactes : 26 produits)
- [x] Couche API (`src/lib/api/produits.ts`)
- [x] Permissions (`peutGererCatalogue` dans `lib/permissions.ts`)
- [x] Écran `Produits.tsx` : recherche (préfixe `*` = "contient"), tableau
      dense (référence/désignation/catégorie/type/stock/statut/commande/
      localisation), panneau de détail en bas au clic (infos + fournisseurs
      + produits équivalents avec double-clic pour naviguer + historique
      des mouvements coloré par type), modal de création avec catégorie/
      fournisseur créables à la volée
- [x] `tsc -b` et `oxlint` passent sans erreur
- [x] Vérification en local par Jean Didier — a testé, et a demandé des
      ajustements d'interaction plus fidèles à AIRSTOCK (voir chantier
      "Affinage de l'écran Produits" ci-dessous)

---

# Affinage de l'écran Produits (interactions façon AIRSTOCK)

**Statut :** terminé
**Démarré le :** 27/08/2026

## Objectif

Après test de l'écran Produits, Jean Didier a partagé deux nouvelles
captures AIRSTOCK (menu clic-droit, écran "Gestion du stock" avec panneau
"Liste des dépôts" + "Derniers mouvements") et demandé 3 changements
précis, à traiter en premier lieu :

1. Ajout d'une référence via **clic droit** ("Nouvelle référence") plutôt
   qu'un bouton dédié.
2. **Filtrage par colonne** directement sous chaque en-tête, plutôt qu'une
   barre de recherche séparée.
3. Le panneau du bas doit refléter la structure AIRSTOCK : "Liste des
   dépôts" (stock par entrepôt) + "Derniers mouvements" avec Sens/Date/Qté/
   Prix/SN·Lot/Provenance-Destination.

## Analyse de l'existant

- `mouvements_stock` n'avait pas de colonnes `lot`, `numero_serie`,
  `prix_unitaire` — nécessaires pour afficher l'historique au même niveau
  de détail qu'AIRSTOCK (jusqu'ici ce détail ne vivait que dans
  `receptions_lignes`, au moment de la réception, pas sur le mouvement
  lui-même).
- L'écran `Produits.tsx` avait une barre de recherche globale + un bouton
  "Nouveau produit", et un panneau de détail "Informations" +
  "Mouvements récents" en 2 colonnes.

## Plan détaillé et exécution

1. **Schéma** : ajout de `lot`, `numero_serie`, `prix_unitaire` (nullables)
   sur `mouvements_stock` (migration additive appliquée en base).
   `seed.sql` mis à jour pour peupler `prix_unitaire` sur les mouvements
   générés, et deux mouvements de démonstration avec SN/Lot ajoutés
   (correspondant aux réceptions de démo déjà existantes). Backfill
   appliqué sur les données déjà en base (prix = PMP courant du produit,
   non destructif).
2. **Menu contextuel** : nouveau composant réutilisable
   `components/ui/MenuContextuel.tsx` (hook `useMenuContextuel`). Le
   bouton "Nouveau produit" est retiré ; clic droit sur le tableau (ou sur
   une ligne) ouvre "Nouvelle référence", et sur une ligne, "Supprimer
   cette référence" si le rôle le permet (`peutSupprimerProduit`, nouveau
   dans `permissions.ts`, réutilise la policy RLS déjà en place).
3. **Filtres par colonne** : barre de recherche globale retirée, remplacée
   par une ligne de filtres sous les en-têtes Référence/Désignation/
   Catégorie/Type (même règle `*` = "contient" que précédemment, appliquée
   par colonne).
4. **Panneau du bas** restructuré : une ligne compacte d'infos (catégorie,
   type, unité, PMP, seuils), puis deux tableaux côte à côte — "Stock par
   dépôt" (regroupé par entrepôt, avec ligne Total) et "Derniers
   mouvements" (Sens coloré IN/OUT/TRF/AJT/INV, Date, Qté, Prix, SN/Lot,
   Provenance/Destination = `motif`). Fournisseurs et produits équivalents
   conservés en dessous, dans un bloc secondaire.

## Points de vigilance

- **Simplification assumée** : la "Liste des dépôts" d'AIRSTOCK a des
  colonnes (DA, Cde, N/A, Panier) qu'on n'a pas d'équivalent direct pour
  l'instant (pas de réservation de stock, pas de commande par dépôt dans
  le MVP JUPPLY) — la version actuelle montre Dépôt/Localisation/Stock/
  Dispo uniquement. À enrichir si besoin identifié plus tard.
- Les autres actions du menu clic-droit AIRSTOCK (Référence équivalente,
  Changer de dépôt, Créer une DA de réappro., filtres avancés, export) ne
  sont pas construites maintenant — elles dépendent d'écrans/fonctions pas
  encore atteints dans la feuille de route (Transferts, Achats/V2,
  Rapports). "Référence équivalente" existe déjà autrement (bloc
  équivalents du panneau de détail).
- Colonne "ATA" (spécifique à l'aviation, référentiel Air Transport
  Association) volontairement absente : ne fait pas partie du vocabulaire
  JUPPLY (cahier des charges généraliste multi-secteurs).

## Avancement

- [x] Analyse + exécution directe (instructions très précises de Jean
      Didier, pas de question de validation nécessaire)
- [x] Migration schéma + backfill appliqués en base (non destructif,
      vérifié : 90 mouvements, tous avec un prix, 2 avec SN/Lot)
- [x] Menu contextuel, filtres par colonne, panneau du bas restructuré
- [x] `tsc -b` et `oxlint` passent sans erreur
- [x] Vérification en local par Jean Didier — structure du tableau et du
      clic droit validées ("j'ai vu dans un premier temps c'est bon"),
      3 nouvelles remarques traitées ci-dessous

## Retour de Jean Didier (round 2) et ajustements

Après ce premier essai validé, trois remarques précises :

1. **Type de produit "Rotable"** manquant : une pièce réparable, envoyée
   en réparation puis remise en stock (à distinguer de l'Outillage, qui
   revient sans réparation). Ajouté : `produits.type` accepte maintenant
   `'rotable'` en plus de `'consommable'`/`'outillage'` (contrainte de
   base modifiée, additif). `docs/CAHIER_DES_CHARGES.md` et
   `docs/GLOSSAIRE.md` mis à jour pour documenter ce 3e type. Le workflow
   de réparation lui-même (envoi/suivi/retour) n'est pas construit — seul
   le type est disponible pour l'instant.
2. **Colonne Localisation** devait afficher le code d'emplacement exact
   (ex. "CO1A"), pas le nom de l'entrepôt ni un simple décompte. Corrigé :
   `resumeLocalisation()` affiche maintenant les codes d'emplacement
   réels. Les codes eux-mêmes restent définis par Jean Didier via l'écran
   Entrepôts (convention libre).
3. **Colonne "É" (équivalents)** à gauche du tableau, avec la quantité en
   stock des produits équivalents, et double-clic pour voir leur détail
   (comportement observé sur la 2e capture AIRSTOCK). Ajouté : nouvelle
   colonne "É" avant Référence, `getToutesLesEquivalences()` (nouvelle
   fonction API) charge en une fois toutes les liaisons d'équivalence,
   double-clic ouvre une popup listant les produits équivalents (référence,
   désignation, stock), cliquer dessus sélectionne ce produit.

Données de démo enrichies pour pouvoir tester ces 3 points sans attendre
un vrai usage : Onduleur 650VA passé en `rotable`, nouveau produit
ART-0027 (Roulement à billes compatible) lié en équivalent à ART-0021.
Migration appliquée en base de façon additive et idempotente.

## Avancement (round 2)

- [x] Type "rotable" (schéma + docs + formulaire de création)
- [x] Localisation par code d'emplacement exact
- [x] Colonne "É" + popup équivalents
- [x] Données de démo enrichies, migration additive vérifiée (27 produits,
      1 rotable, 1 paire d'équivalents)
- [x] `tsc -b` et `oxlint` passent sans erreur
- [x] Jean Didier est passé à la suite (sauvegarde git, puis nouveau sujet
      "localisation") sans signaler de problème — considéré comme validé
      de facto

---

# Écran Entrepôts

**Statut :** terminé
**Démarré le :** 27/08/2026
**Terminé le :** 27/08/2026

## Objectif

Premier écran métier réel de la feuille de route (voir `HISTORY.md`),
remplaçant le "Fonctionnalité à venir" actuel. Permet de créer et
consulter les entrepôts, avec leurs zones/emplacements et leur Quarantaine
(cahier des charges, sections 5 et 16 ; écran MVP "Entrepôts" : "Liste des
entrepôts et leurs informations (zones, emplacements)" ; section 17 MVP :
"Créer les entrepôts").

C'est aussi le premier écran d'écriture (jusqu'ici seul le Dashboard,
en lecture seule, était branché) : il pose donc le premier exemple de
policies RLS d'écriture par rôle, et un premier exemple de formulaire /
composant modal réutilisable pour les écrans suivants.

## Analyse de l'existant

- `entrepots` et `emplacements` existent déjà en base (chantier
  précédent), avec seulement des policies de **lecture** (`entrepots_visibles()`
  restreint déjà la visibilité par rôle/assignation). Aucune policy
  d'écriture sur ces deux tables.
- `emplacements.est_quarantaine` : un emplacement Quarantaine est
  auto-créé par trigger à chaque entrepôt — il ne doit pas être modifiable
  ni supprimable depuis l'UI.
- Route actuelle : `App.tsx` a `<Route path="entrepots" element={<ComingSoon titre="Entrepôts" />} />`
  et, séparément, `<Route path="emplacements" element={<ComingSoon titre="Emplacements" />} />`.
  Le cahier des charges (section 16) ne prévoit **pas** d'écran
  "Emplacements" distinct — les emplacements font partie de l'écran
  Entrepôts. Je propose de retirer l'entrée de nav "Emplacements" et de
  couvrir ce besoin dans l'écran Entrepôts.
- Aucun composant modal/formulaire réutilisable n'existe encore
  (`src/components/` ne contient que des composants d'affichage). Ce sera
  le premier écran avec un formulaire de création — je pose une base
  simple réutilisable (`src/components/ui/Modal.tsx`) plutôt que de la
  redévelopper à chaque écran suivant (Produits, Réceptions, etc. en
  auront besoin aussi).
- Aucune notion de permission par rôle n'existe côté frontend (le rôle est
  seulement affiché dans `Topbar.tsx`). Je pose une base légère
  (`src/lib/permissions.ts`) avec les seules règles nécessaires à cet
  écran ; les écrans suivants y ajouteront les leurs au fur et à mesure.
- `types/stock.ts` a déjà `Entrepot` et `Emplacement` à jour avec le
  nouveau schéma.

## Plan détaillé

### 1. RLS (écriture) sur `entrepots` et `emplacements`

Règles proposées (à valider, voir Points de vigilance) :

- **Créer/modifier un entrepôt** : Administrateur, Superviseur Entrepôt.
- **Supprimer un entrepôt** : Administrateur uniquement.
- **Ajouter un emplacement** dans un entrepôt existant : Administrateur,
  Superviseur Entrepôt, ou Gestionnaire assigné à cet entrepôt (exclut le
  Magasinier — saisie quotidienne, pas de changement structurel). Interdit
  si `est_quarantaine = true` (la Quarantaine ne se crée que par trigger).
- **Supprimer un emplacement** : mêmes rôles, sauf si `est_quarantaine = true`
  (jamais supprimable depuis l'UI ni via RLS).

### 2. Couche API (`src/lib/api/entrepots.ts`, nouveau fichier)

- `getEntrepots()` : liste des entrepôts visibles, avec nombre
  d'emplacements et quantité totale en stock (jointure/complément à
  `v_stock_par_entrepot` déjà existante).
- `getEmplacements(entrepotId)` : emplacements d'un entrepôt (zone, rayon,
  étagère, code, quarantaine en premier/mise en évidence).
- `creerEntrepot({ nom, adresse })`.
- `creerEmplacement({ entrepotId, zone, rayon, etagere, code })`.

### 3. Permissions (`src/lib/permissions.ts`, nouveau fichier)

- `peutGererEntrepots(role)` → créer/modifier un entrepôt.
- `peutSupprimerEntrepot(role)` → administrateur seul.
- `peutGererEmplacements(role, entrepotId, entrepotsAssignes)` → ajouter un
  emplacement.

### 4. UI

- `src/components/ui/Modal.tsx` : dialogue centré générique (fond
  assombri, fermeture au clic extérieur/Échap), réutilisable pour tous les
  formulaires de création à venir.
- `src/pages/Entrepots.tsx` (remplace le `ComingSoon`) : liste des
  entrepôts (nom, adresse, nb emplacements, quantité totale en stock),
  bouton "Nouvel entrepôt" (visible seulement si `peutGererEntrepots`).
  Clic sur un entrepôt → panneau/section listant ses emplacements avec
  badge distinct pour la Quarantaine, et bouton "Ajouter un emplacement"
  (visible selon permission).
- `App.tsx` : route `entrepots` pointe vers `Entrepots`, route
  `emplacements` supprimée (fonctionnalité intégrée à l'écran ci-dessus).
- `navigation.ts` / `Sidebar.tsx` : retrait de l'entrée "Emplacements".

## Points de vigilance

- **Qui a le droit de créer/modifier/supprimer quoi** (section 1
  ci-dessus) n'est pas explicitement tranché par le cahier des charges —
  ce sont des propositions raisonnables basées sur la portée de chaque
  rôle (section 2 du cahier des charges), à valider ou ajuster.
- **Suppression de la nav "Emplacements"** : à confirmer que ça ne casse
  pas une attente précise de Jean Didier (l'écran n'a jamais été
  développé, donc aucune perte de fonctionnalité réelle).
- **Avertissement "produit déjà à cet emplacement"** (cahier des charges,
  section 5) concerne l'ajout de stock à un emplacement pour un produit
  donné — ça relève de l'écran Produits/Stock, pas de la création
  d'emplacements elle-même. Traité dans un chantier ultérieur.
- Le composant `Modal.tsx` et `permissions.ts` sont volontairement
  minimaux (juste ce dont cet écran a besoin) ; ils s'enrichiront au fil
  des écrans suivants plutôt que d'être conçus en avance pour tous les cas
  imaginables.

## Avancement

- [x] Analyse de l'existant
- [x] Plan rédigé, validé par Jean Didier le 27/08/2026 (Admin+Superviseur
      pour les entrepôts, +Gestionnaire assigné pour les emplacements)
- [x] RLS d'écriture (entrepôts, emplacements) écrites dans `schema.sql` et
      appliquées en base (additif, vérifié via `pg_policies` — 8 policies
      en place, données existantes intactes)
- [x] Couche API (`src/lib/api/entrepots.ts`)
- [x] Permissions (`src/lib/permissions.ts`) + `AuthContext` étendu avec
      `entrepotsAssignes`
- [x] Composant `Modal` + écran `Entrepots.tsx` (liste, création
      d'entrepôt, emplacements par entrepôt avec badge Quarantaine,
      création d'emplacement)
- [x] Nettoyage navigation ("Emplacements" retiré, fondu dans "Entrepôts")
- [x] `tsc -b` et `oxlint` passent sans erreur
- [x] Jean Didier est passé à la suite (retour visuel AIRSTOCK puis
      "continuons") sans signaler de problème — considéré comme validé de
      facto

**Note post-chantier :** Jean Didier a ensuite demandé un style visuel
inspiré d'AIRSTOCK (logiciel de gestion de stock aviation) pour les écrans
à fort volume de données — tableaux denses + panneau de détail en bas,
dans le style Jupply actuel. Portée confirmée : écrans de données
(Produits, Stock, Mouvements, Outillage), pas Entrepôts (resté en cartes,
volumétrie faible) ni le Dashboard/menu. Voir mémoire `ui_dense_tables.md`
et le chantier Produits suivant.

---

# Refonte du schéma de base de données selon le cahier des charges JUPPLY

**Statut :** terminé
**Démarré le :** 26/08/2026
**Terminé le :** 27/08/2026

## Objectif

Le cahier des charges fonctionnel (`docs/CAHIER_DES_CHARGES.md`) et le
glossaire (`docs/GLOSSAIRE.md`) fournis par Jean Didier décrivent une
application bien plus complète que ce qui existe aujourd'hui : 4 rôles
hiérarchiques avec privilèges à expiration, localisation à 5 niveaux avec
Quarantaine obligatoire, produits enrichis (fournisseurs, variantes, lots,
séries, expiration, équivalents), flux complets de réception/sortie/
transfert/inventaire, module Outillage, valorisation PMP, alertes
multiples. Le schéma Supabase actuel (`app-src/supabase/schema.sql`) ne
couvre qu'une version minimale (entrée/sortie simple, un seul niveau
d'emplacement, rôle en texte libre).

Ce chantier refond le schéma de base de données pour poser les fondations
de toute la V1, avant de construire les écrans un par un dessus (chantiers
suivants).

## Analyse de l'existant

Schéma actuel (`app-src/supabase/schema.sql`) :

- `entreprises`, `profiles` (role en texte libre, pas de contrainte),
  `entrepots`, `emplacements` (un seul niveau, plat), `categories`,
  `articles` (référence, nom, catégorie, stock_min — pas de type, prix,
  fournisseur, variante, lot, série, expiration), `stock_articles`
  (quantité par article + entrepôt + emplacement), `mouvements_stock`
  (uniquement `entree`/`sortie`, pas de transfert/ajustement/inventaire).
- RLS : uniquement des policies de **lecture**. Aucune policy d'écriture —
  cohérent avec le fait que seul le Dashboard (consultation) est
  fonctionnel aujourd'hui.
- Vues dashboard : `v_articles_stock`, `v_mouvements_recents`,
  `v_stock_par_entrepot`, consommées par `src/lib/api/stock.ts` et typées
  dans `src/types/stock.ts`.
- `profiles.role` est utilisé nulle part pour du contrôle d'accès dans le
  code React actuel (juste affiché) — donc le changer n'a pas d'impact
  fonctionnel immédiat sur l'UI existante.
- Le Dashboard est le seul écran branché à Supabase ; tout le reste
  affiche "Fonctionnalité à venir" (`src/pages/ComingSoon.tsx`). Il faut
  donc que ce chantier ne casse pas le Dashboard.
- Données uniquement de démo (`seed.sql`), pas d'utilisateur réel en
  production — Jean Didier a validé un reset complet de la base plutôt que
  des migrations incrémentales.

## Plan détaillé

### 1. Rôles, assignations et privilèges

- `profiles.role` devient une valeur contrainte parmi les 4 rôles officiels
  : `administrateur`, `superviseur_entrepot`, `gestionnaire_entrepot`,
  `magasinier`.
- Nouvelle table `profils_entrepots` (profile_id, entrepot_id) : liste des
  entrepôts assignés à un Gestionnaire ou un Magasinier (relation
  plusieurs-à-plusieurs, un utilisateur peut être assigné à plusieurs
  entrepôts).
- Nouvelle table `privileges` : droit ponctuel accordé à un utilisateur
  au-delà de son rôle standard (ex. accès temporaire à un entrepôt
  supplémentaire), avec `accorde_par`, `motif`, `date_expiration`. Un
  privilège expiré n'est simplement plus pris en compte (comparaison à
  `now()`), pas besoin de job de nettoyage.
- Nouvelle table `journal_droits` : historique de toute attribution/retrait
  de droit ou de privilège (qui, à qui, quand, pourquoi).

### 2. Localisation

- `entrepots` : inchangé, + colonne `adresse` (optionnelle).
- `emplacements` enrichi pour porter la localisation complète en une seule
  table : `entrepot_id`, `zone` (texte), `rayon` (texte), `etagere`
  (texte), `code` (identifiant de l'emplacement final), `est_quarantaine`
  (booléen). *Simplification proposée : pas de tables séparées
  `zones`/`rayons`/`etageres` — voir Points de vigilance.*
- Un emplacement `est_quarantaine = true` est créé automatiquement à la
  création de chaque entrepôt (trigger ou logique applicative).

### 3. Produits

- Renommage `articles` → `produits` (vocabulaire officiel du glossaire).
- Nouvelles colonnes : `type` (`consommable` / `outillage`),
  `unite_mesure`, `prix_moyen_pondere` (recalculé à chaque réception),
  `stock_max`, `seuil_reappro`, `gere_lot`, `gere_numero_serie`,
  `gere_expiration` (booléens indiquant si ce produit suit ces attributs).
- Nouvelle table `fournisseurs` (nom, contact) + table de liaison
  `produits_fournisseurs` (un produit peut avoir plusieurs fournisseurs).
- Nouvelle table `produits_equivalents` (produit_id ↔ produit_equivalent_id)
  pour la relation d'équivalence sans addition de quantités.
- Nouvelle table `groupes_variantes` + colonne `produits.groupe_variante_id`
  pour regrouper des produits à référence distincte (ex. tailles S/M/L/XL)
  sous un même "modèle" affiché ensemble.

### 4. Stock, mouvements et flux

- `stock_produits` (ex `stock_articles`) reste agrégé par
  produit + entrepôt + emplacement (quantité courante). Le détail
  lot/série/expiration/prix vit au niveau des réceptions (voir ci-dessous),
  pas dans le stock agrégé — voir Points de vigilance.
- `mouvements_stock` : type étendu à `entree`, `sortie`, `transfert`,
  `ajustement`, `inventaire`. Garde `stock_avant`/`stock_apres` pour la
  traçabilité déjà en place.
- Nouvelle table `receptions` (numéro, entrepôt, fournisseur, numéro de PO,
  statut : en_attente/validee/partielle/anomalie, validé_par, date) +
  `receptions_lignes` (produit, quantité attendue, quantité reçue, lot,
  numéro de série, date d'expiration, prix unitaire). La validation d'une
  réception génère les `mouvements_stock` de type `entree` et recalcule le
  PMP du produit concerné.
- Nouvelle table `bons_sortie` (numéro, demandé_par, statut) +
  `bons_sortie_lignes` (produit, entrepôt, emplacement, quantité). La
  confirmation génère les `mouvements_stock` de type `sortie`.
- Nouvelle table `transferts` (numéro de suivi unique, entrepôt_source,
  entrepôt_destination, statut : demande/valide/expedie/en_transit/recu,
  demandé_par, validé_par) + `transferts_lignes` (produit, quantité
  expédiée, quantité reçue, écart).
- Nouvelle table `inventaires` (type : global/partiel, entrepôt, statut :
  en_cours/verifie, démarré_par, vérifié_par) + `inventaires_lignes`
  (produit, emplacement, stock_theorique, stock_physique, ecart).
- Nouvelle table `affectations_outillage` (produit_id de type `outillage`,
  bénéficiaire, date_affectation, date_retour, statut : en_stock/affecte).

### 5. RLS (Row Level Security)

- Étendre les policies de **lecture** à toutes les nouvelles tables, sur le
  même principe qu'aujourd'hui (isolation par `entreprise_id`), avec en
  plus une restriction de visibilité par entrepôt pour les rôles
  Gestionnaire/Magasinier (ne voient que leurs entrepôts assignés via
  `profils_entrepots`), tandis qu'Administrateur et Superviseur Entrepôt
  voient tout.
- Les policies d'**écriture** (qui peut créer/valider une réception, une
  sortie, un transfert...) ne sont **pas** couvertes par ce chantier :
  elles seront ajoutées au moment de construire chaque écran
  correspondant, une fois qu'on sait précisément quel formulaire déclenche
  quelle action.

### 6. Vues du Dashboard et seed de démo

- Recréer `v_articles_stock`, `v_mouvements_recents`, `v_stock_par_entrepot`
  sur les nouvelles tables (`produits` au lieu de `articles`, etc.) pour
  que le Dashboard actuel continue de fonctionner sans régression.
- Réécrire `seed.sql` avec des données couvrant les nouveaux concepts
  (quelques produits de type Outillage, quelques réceptions avec
  fournisseur/lot/expiration, un transfert en transit, un inventaire en
  cours) pour que les futurs écrans aient de quoi s'afficher dès leur
  construction.

### 7. Code applicatif (minimum pour ne pas casser le Dashboard)

- `src/types/stock.ts` et `src/lib/api/stock.ts` : adapter aux noms de
  tables/colonnes renommés (`produits` au lieu de `articles`, etc.).
- `app-src/README.md` : mettre à jour les instructions de création du
  compte de démarrage avec les nouveaux rôles.
- Pas de nouveau écran construit dans ce chantier — uniquement la
  fondation. Les écrans (Produits, Réceptions, Sorties, Transferts,
  Inventaires, Outillage, Utilisateurs...) feront chacun l'objet d'un
  chantier séparé, une fois le schéma validé.

## Points de vigilance

- **Reset complet de Supabase** : toutes les données actuelles (démo)
  seront supprimées. Jean Didier devra recréer son profil admin après
  exécution du nouveau `schema.sql` (mêmes instructions qu'aujourd'hui,
  avec le rôle `administrateur`).
- **Simplification de la hiérarchie de localisation** : zone/rayon/étagère
  stockés comme colonnes texte sur `emplacements` plutôt qu'en tables
  séparées avec écrans de gestion dédiés. Couvre l'exigence du cahier des
  charges (localisation = Entrepôt + Zone + Rayon + Étagère + Emplacement)
  sans multiplier les écrans CRUD imbriqués en V1. À valider — si Jean
  Didier veut une gestion structurée de chaque niveau (ex. liste des zones
  d'un entrepôt), il faudra des tables séparées.
- **Simplification du suivi par lot** : le stock agrégé (`stock_produits`)
  ne se ventile pas par lot/date d'expiration ; ce détail vit dans
  `receptions_lignes`. Les alertes de péremption et le calcul du PMP
  s'appuieront sur cette table plutôt que sur un suivi FIFO strict par
  lot au niveau du stock. Suffisant pour le MVP, mais une bascule vers un
  suivi FIFO complet (mentionnée comme possible en V2 dans le cahier des
  charges) demandera une évolution du modèle.
- **RLS d'écriture non couverte ici** : ce chantier livre les tables et la
  lecture seule. Chaque écran métier (réception, sortie, transfert...)
  amènera ses propres policies d'écriture au moment de sa construction.
- **Migration du rôle actuel** : le champ `role` texte libre ('admin' /
  'utilisateur') est remplacé par les 4 rôles officiels ; à mettre à jour
  manuellement après le reset.

## Avancement

- [x] Cahier des charges et glossaire lus, sauvegardés dans `docs/`
- [x] Analyse du schéma existant
- [x] Plan détaillé rédigé (validé par Jean Didier le 27/08/2026, avec
      l'approche "base propre")
- [x] Nouveau `schema.sql` écrit (tables, trigger Quarantaine, RLS lecture,
      vues Dashboard)
- [x] Nouveau `seed.sql` écrit (couvre produits/outillage, réceptions avec
      lot/expiration, sortie, transfert en transit, inventaire en cours,
      quarantaine)
- [x] Mise à jour des vues Dashboard, types TypeScript, couche API et
      composants (`Dashboard.tsx` et cie), scripts (`setup-compte.mjs`,
      `verifier-seed.mjs`), navigation (Articles → Produits) et README.
      `tsc -b` et `oxlint` passent sans erreur.
- [x] Exécution sur le projet Supabase de Jean Didier (27/08/2026) : reset
      complet, nouveau schéma, compte Administrateur recréé (même
      entreprise "Jupply Demo", même compte auth), données de démo
      chargées. Bug trouvé et corrigé en cours de route : la fonction
      `current_role()` a dû être renommée `role_courant()` (mot réservé
      Postgres). Vérifié en base : 26 produits, 88 mouvements, réceptions/
      transfert/quarantaine bien peuplés.
- [x] Migration vérifiée côté base (vues et données correctement en place) ;
      Jean Didier est passé directement à la suite sans signaler de
      problème côté Dashboard, considéré comme validé de facto

---

_Aucun autre plan archivé pour le moment._
