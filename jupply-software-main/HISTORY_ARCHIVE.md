# Archive de l'historique

> Détail complet des chantiers terminés. Ce fichier n'est lu qu'à la demande
> (pour retrouver un détail précis), jamais automatiquement — `HISTORY.md` reste
> la référence courante, avec une trace courte pointant ici.

---

## Sorties de stock et Réintégrations

**Période :** 2026-08-30 → 2026-08-31
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Deux nouveaux onglets "Sorties Manuelles" et "Réintégration" (catégorie
Réceptions/Expéditions du ruban). Sortie : panier multi-produits, "Valider"
déduit le stock immédiatement (pas de validation séparée comme les
réceptions). Réintégration : annule tout ou partie d'une sortie déjà
confirmée sans jamais supprimer l'historique — suivi au niveau de chaque
ligne de sortie précise (`bon_sortie_ligne_id`), pas d'un agrégat
produit+entrepôt, avec un vrai verrou `for update of` par ligne.

Premier essai rejeté par Jean Didier (fenêtres modales au lieu d'onglets,
suivi agrégé au lieu de ligne par ligne) — repris entièrement en onglets
`TabsContext` avec un `SelectionContext` dédié pour que le ruban sache
pré-remplir "Sorties Manuelles" avec le produit sélectionné dans Produits.
Plusieurs rounds de correction d'interface suite à des captures AIRSTOCK
détaillées : densité (retour "tu exploites mal l'espace de l'écran"),
recherche par référence uniquement avec convention `*` = "contient"
(mutualisée dans `lib/filtreTexte.ts`, réutilisée aussi par Produits.tsx),
en-tête à deux blocs (colonne gauche champs produit/quantités, colonne
droite opérateur/bon/date + notes en zone de texte étirée), listes de
gauche toujours peuplées (pas seulement au moment de la frappe), boutons
Ajouter/Supprimer sous la liste plutôt qu'en bouton contextuel.

Dernier ajustement : "Date du mouvement" rendue modifiable (pré-remplie à
aujourd'hui) — `creer_sortie`/`creer_reintegration` acceptent un
`p_date_mouvement` optionnel, utilisé pour `cree_le` du bon et du
mouvement de stock associé (`lib/dates.ts` pour la conversion sans
décalage de fuseau horaire). Piège rencontré : ajouter un paramètre à une
fonction RPC existante change sa signature, donc `create or replace`
laisse un second overload et le `grant` qui suit échoue avec "function
name is not unique" — corrigé en faisant un `drop function` explicite
avant de recréer. Autre piège (RLS) : `for update`/`for update of` sur une
table sans policy RLS **UPDATE** dédiée fait disparaître silencieusement
les lignes verrouillées au lieu de renvoyer une erreur — policy ajoutée
sur `bons_sortie_lignes`. Chaque changement de schéma testé via une
transaction annulée (session simulée) avant application réelle.

## Coquille applicative façon AIRSTOCK (ruban + onglets)

**Période :** 2026-08-28 → 2026-08-30
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Jean Didier est revenu sur la décision "le menu latéral reste tel quel" :
toute l'application (Dashboard inclus) adopte désormais un ruban
horizontal façon AIRSTOCK (2 niveaux : catégories puis actions) à la place
du menu latéral, avec plusieurs écrans ouverts en même temps sous forme
d'onglets internes qui gardent leur état. `TabsContext`, `Ruban.tsx`,
`BarreOnglets.tsx` créés ; `Sidebar.tsx`/`navigation.ts` supprimés ;
`App.tsx` simplifié à une seule route `/stocks` (plus de lien direct par
écran). Volets figés (en-tête de tableau fixe au défilement).

Deux rounds de correction après retour de Jean Didier avec captures à
l'appui : (1) l'écran Produits était beaucoup trop peu dense comparé à
AIRSTOCK (une seule ligne visible) à cause de marges généreuses et d'un
bloc d'infos non demandé — corrigé en déplaçant ce bloc dans une fiche
produit séparée et en densifiant partout (marges, tailles, coins arrondis) ;
(2) le filtrage par colonne devait fonctionner en cliquant une colonne
puis en tapant au clavier (sans case de saisie à cliquer), avec le texte
affiché au-dessus de l'en-tête plutôt que dans une ligne séparée — implémenté
via capture clavier globale gardée par onglet actif et absence de modale
ouverte. Mémoire `ui_dense_tables.md` mise à jour avec la leçon retenue.

## Écran Entrées de stock (Réceptions)

**Période :** 2026-08-28
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Premier vrai workflow en deux étapes de l'application : saisie d'une
réception (statut `en_attente`, tous rôles opérationnels y compris
Magasinier) puis validation séparée (Administrateur/Superviseur/
Gestionnaire uniquement, pas le Magasinier), qui seulement à ce moment
augmente le stock. Ventilation automatique normal/Quarantaine (surplus,
anomalie), recalcul du Prix Moyen Pondéré du produit sur son stock total,
numérotation séquentielle via une séquence Postgres. Avertissement ajouté
si un produit a déjà un emplacement différent dans l'entrepôt choisi
(exigence du cahier des charges laissée de côté au chantier Entrepôts).
Testé fonctionnellement (cas surplus + cas anomalie) avant livraison.

## Attribution et déplacement de localisation

**Période :** 2026-08-28
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Gap identifié par Jean Didier : aucune action n'écrivait encore dans
`stock_produits` (tout le stock affiché venait des données de démo). Ajout
de deux actions via le menu clic droit sur un produit (écran Produits) :
"Affecter une localisation" (placer une quantité à un emplacement) et
"Modifier la localisation" (déplacer du stock d'un emplacement à un autre,
au sein du même entrepôt — le déplacement entre entrepôts reste réservé
au futur écran Transferts). Les deux passent par des fonctions PostgreSQL
atomiques (`affecter_localisation`, `deplacer_stock`), pas par plusieurs
appels séparés depuis le navigateur, pour garantir la cohérence en cas
d'accès concurrents (exigence explicite du cahier des charges). Premières
policies RLS d'écriture sur `stock_produits`/`mouvements_stock`, ouvertes
jusqu'au Magasinier (saisie quotidienne de stock). Testé fonctionnellement
en conditions réelles (session simulée avec le compte de Jean Didier, dans
une transaction annulée ensuite) avant livraison.

## Écran Produits (+ affinage façon AIRSTOCK)

**Période :** 2026-08-27 → 2026-08-28
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Écran Produits construit avec le catalogue complet (référence, désignation,
catégorie, type, unité, prix moyen pondéré, seuils, fournisseurs, produits
équivalents), recherche, et création via formulaire. Catalogue ouvert en
écriture à Administrateur + Superviseur Entrepôt + Gestionnaire d'entrepôt.

Après un premier essai, Jean Didier a partagé des captures d'AIRSTOCK
(logiciel de gestion de stock aviation qu'il connaît) et demandé une
présentation plus proche : tableau dense avec filtres par colonne (au lieu
d'une barre de recherche), ajout/suppression via menu clic droit (au lieu
de boutons), et un panneau de détail bas d'écran avec "Stock par dépôt" +
"Derniers mouvements" (Sens/Date/Qté/Prix/SN·Lot/Provenance-Destination).
`mouvements_stock` a reçu des colonnes `lot`/`numero_serie`/`prix_unitaire`
pour supporter cet historique détaillé.

Second retour après validation de la structure : ajout d'un 3e type de
produit "Rotable" (pièce réparable, distincte de l'Outillage), correction
de la colonne Localisation pour afficher le code d'emplacement exact
plutôt que le nom de l'entrepôt, et ajout d'une colonne "É" (équivalents)
avec quantité et popup de détail au double-clic.

Tout le travail (refonte du schéma + écrans Entrepôts et Produits) a été
sauvegardé dans 2 commits git le 28/08/2026, en local (pas encore poussé).

## Écran Entrepôts

**Période :** 2026-08-27
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Premier écran métier construit après la refonte du schéma, et premier
écran d'écriture de l'application (jusque-là seul le Dashboard, en
lecture seule, était branché). Liste des entrepôts (cartes : nom, adresse,
nb d'emplacements, quantité en stock), création d'un entrepôt, et par
entrepôt : liste des emplacements (zone/rayon/étagère/code) avec la
Quarantaine mise en évidence, création d'un emplacement.

Décisions validées avec Jean Didier : création/modification d'entrepôt
réservée à Administrateur + Superviseur Entrepôt (suppression :
Administrateur seul) ; ajout d'emplacement ouvert en plus au Gestionnaire
assigné à cet entrepôt. RLS d'écriture ajoutée en base de façon additive
(sans toucher aux données existantes). Premiers composants réutilisables
posés pour les écrans suivants : `Modal.tsx`, `lib/permissions.ts`,
`entrepotsAssignes` dans `AuthContext`. Nav "Emplacements" retirée
(fondue dans "Entrepôts", pas prévue comme écran séparé au cahier des
charges).

**Décision qui a suivi :** Jean Didier a partagé une capture d'AIRSTOCK
(logiciel de gestion de stock aviation) et demandé une présentation
similaire pour les écrans à fort volume de données. Portée confirmée :
tableaux denses + panneau de détail en bas pour Produits/Stock/Mouvements/
Outillage, dans le style visuel Jupply actuel — Entrepôts et le Dashboard
restent inchangés. Voir chantier Produits suivant.

## Refonte du schéma de base de données selon le cahier des charges JUPPLY

**Période :** 2026-08-26 → 2026-08-27
**Statut :** terminé (plan complet dans `PLAN_ARCHIVE.md`)

Jean Didier a fourni un cahier des charges fonctionnel complet et un
glossaire pour JUPPLY (sauvegardés dans `docs/CAHIER_DES_CHARGES.md` et
`docs/GLOSSAIRE.md`). Le schéma minimal existant (module Dashboard) ne
couvrait qu'une fraction de ce périmètre. Refonte complète :

- 4 rôles officiels avec assignation aux entrepôts et privilèges à
  expiration, journal des droits.
- Localisation enrichie (zone/rayon/étagère en colonnes texte sur
  `emplacements`) avec emplacement Quarantaine auto-créé par trigger à
  chaque entrepôt, exclu du stock disponible dans les vues.
- Produits enrichis : type (consommable/outillage), fournisseurs
  multiples, variantes, produits équivalents, PMP, seuils.
- Nouvelles tables pour tout le flux métier : réceptions (avec lot/série/
  expiration/prix), sorties, transferts (statut "en_transit"),
  inventaires, affectations d'outillage.
- RLS de lecture étendue avec visibilité par entrepôt selon le rôle
  (fonction `role_courant()` — renommée depuis `current_role()`, mot
  réservé Postgres qui a fait échouer la première tentative d'exécution).
- Code applicatif mis à jour en cohérence (types, API, composants
  Dashboard, navigation "Articles" → "Produits", scripts).

Exécuté directement sur le Supabase de Jean Didier via
`scripts/run-sql.mjs` (accord explicite donné après un premier essai
manuel resté sur l'ancien schéma) : reset complet, nouveau schéma, compte
Administrateur recréé, données de démo rechargées. Vérifié en base : 26
produits, 88 mouvements, réceptions/transfert/quarantaine peuplés.

**Décision qui a suivi :** Jean Didier veut maintenant construire
l'application de bout en bout selon le cahier des charges, écran par
écran, avec les 4 rôles. Feuille de route posée dans `HISTORY.md`
("Construction de l'application JUPPLY selon le cahier des charges").

## Maquettes du site vitrine

**Période :** 2026-08-13 → 2026-08-14
**Statut :** terminé (superseded par le pivot vers le développement réel, voir
chantier en cours dans `HISTORY.md`)

Prototypage visuel du site vitrine avec l'outil de design Claude, à partir du
cahier des charges fonctionnel Phase 1 (modules Ventes, Magasins/Stocks,
Approvisionnement) :

- Page d'accueil publique (`index.html`)
- Page de connexion (`connexion/index.html`)
- Page d'inscription à l'essai gratuit, 60 jours sans carte bancaire
  (`essai-gratuit/index.html`)
- Premier prototype visuel du tableau de bord interne (`app/index.html`), non
  connecté à une base de données
- Connexion des boutons "Se connecter" / "Essai gratuit" entre les pages

Déploiement Netlify connecté au dépôt GitHub, désactivé ensuite (quota gratuit
atteint) au profit d'une vérification en local via un fichier `.bat`.

**Décision qui a suivi :** sur recommandation d'un expert ERP/Supply Chain, le
projet a pivoté pour construire d'abord le cœur fonctionnel réel (module Gestion
des Stocks) plutôt que de continuer à peaufiner le site vitrine. Ce pivot est le
chantier actuellement en cours (voir `HISTORY.md`).
