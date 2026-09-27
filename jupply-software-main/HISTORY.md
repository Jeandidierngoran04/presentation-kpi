# Historique du projet

> Journal chronologique des chantiers, le plus récent en haut.
> Cette page reste toujours courte : une trace par chantier, avec un lien vers
> `HISTORY_ARCHIVE.md` pour le détail complet une fois le chantier terminé.
> `HISTORY_ARCHIVE.md` n'est consulté qu'à la demande, jamais automatiquement.

---

## En cours

- **[2026-08-27] Construction de l'application JUPPLY selon le cahier des
  charges.** Feuille de route : Entrepôts → Produits → Réceptions → Sorties
  → Transferts → Inventaires → Outillage → Utilisateurs (rôles/privilèges)
  → Mouvements → Rapports → Paramètres → enrichissement final du Dashboard.
  Chaque écran fait l'objet de son propre plan validé avant exécution.
  Écran Produits, attribution/déplacement de localisation, écran Entrées
  de stock, coquille applicative façon AIRSTOCK (ruban + onglets, densité,
  filtrage par colonne au clavier), puis Sorties de stock et
  Réintégrations (onglets dédiés, panier multi-produits, réintégration
  ligne de sortie par ligne de sortie) terminés — voir mémoire
  `ui_dense_tables.md` pour la convention visuelle retenue. Étape en
  cours : Transferts entre entrepôts (workflow multi-étapes demande →
  validation → expédition → en transit → réception, cf. `PLAN.md`) —
  code complet, en attente de vérification locale.

- **[2026-09-05] Charte graphique + refonte visuelle de l'application.**
  Charte formalisée dans `docs/charte-graphique/CHARTE_GRAPHIQUE.md`
  (identité "Clean SaaS Sage" façon Gemini, navigation 3 niveaux Top Bar
  une ligne / Sub-Header / onglets inverted radius, Light + Dark Mode,
  Plus Jakarta Sans, iconographie outline, densité). Règle ajoutée dans
  `CLAUDE.md`. Plan de refonte de `app-src/` en 5 paliers (fondations →
  coquille → primitives → écrans un par un → passe finale) dans
  `PLAN.md`, en attente du feu vert.

## Terminé

- **[2026-08-30 → 2026-08-31] Sorties de stock et Réintégrations.** Voir
  `HISTORY_ARCHIVE.md#sorties-de-stock-et-réintégrations`.
- **[2026-08-28 → 2026-08-30] Coquille applicative façon AIRSTOCK (ruban +
  onglets).** Voir `HISTORY_ARCHIVE.md#coquille-applicative-façon-airstock-
  ruban--onglets`.
- **[2026-08-28] Écran Entrées de stock (Réceptions).** Voir
  `HISTORY_ARCHIVE.md#écran-entrées-de-stock-réceptions`.
- **[2026-08-28] Attribution et déplacement de localisation.** Voir
  `HISTORY_ARCHIVE.md#attribution-et-déplacement-de-localisation`.
- **[2026-08-27 → 2026-08-28] Écran Produits (+ affinage façon AIRSTOCK).**
  Voir `HISTORY_ARCHIVE.md#écran-produits-affinage-façon-airstock`.
- **[2026-08-27] Écran Entrepôts.** Voir
  `HISTORY_ARCHIVE.md#écran-entrepôts`.
- **[2026-08-26 → 2026-08-27] Refonte du schéma de base de données selon le
  cahier des charges JUPPLY.** Voir `HISTORY_ARCHIVE.md#refonte-du-schéma-de-
  base-de-données-selon-le-cahier-des-charges-jupply`.
- **[2026-08-15] Module Gestion des Stocks — Dashboard (première version).**
  Absorbé par la refonte du schéma ci-dessus (le Dashboard tourne maintenant
  sur le nouveau schéma complet).
- **[2026-08-13 → 2026-08-14] Maquettes visuelles du site vitrine.** Voir
  `HISTORY_ARCHIVE.md#maquettes-du-site-vitrine`.
