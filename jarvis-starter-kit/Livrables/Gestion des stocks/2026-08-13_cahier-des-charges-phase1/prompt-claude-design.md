# Prompt pour Claude Design — Application de gestion des stocks (Phase 1)

> À copier-coller directement dans Claude Design. Basé sur le cahier des charges `README.md` du même dossier.

---

Conçois l'interface d'une application web SaaS B2B destinée aux PME et commerces, pour gérer leur cycle vente → stock → approvisionnement. Le logiciel s'appelle ** JUPPLY SOFTWARE **.

## Contexte produit

- SaaS multi-entreprises : une seule plateforme héberge plusieurs entreprises clientes, avec des données totalement séparées. Chaque entreprise personnalise son logo et son nom, visibles dans l'interface.
- Alternative à bas coût aux ERP lourds type Odoo, SAP, Microsoft Dynamics, pour des PME et commerces qui n'ont pas les moyens de ces solutions.
- Utilisable sur ordinateur (poste de travail complet) et sur téléphone (navigateur web responsive, mêmes données).
- Interface entièrement en français.

## Direction visuelle

- Style **professionnel B2B, sobre et rassurant**, inspiré d'Odoo et de Microsoft Dynamics : pas de design "flashy" ou consumer, l'objectif est d'inspirer confiance à un dirigeant de PME.
- Bonne densité d'information : les écrans manipulent des tableaux de données (commandes, articles, mouvements de stock), l'interface doit rester lisible et scannable même avec beaucoup de lignes.
- Navigation latérale (sidebar) groupée par module : **Ventes**, **Magasins/Stocks**, **Achats**, avec un accès rapide au tableau de bord.
- Barre supérieure : logo + nom de l'entreprise connectée (zone personnalisable par le client), nom/rôle de l'utilisateur connecté, notifications (cloche), recherche globale.
- Prévoir une identité neutre par défaut (le nom/logo de l'entreprise cliente vient se substituer par-dessus), mais un thème démo cohérent et propre pour présenter les maquettes.

## Rôles à représenter dans les maquettes

Administrateur, Directeur, Responsable Logistique, Magasinier, Acheteur, Commercial — chaque rôle voit une interface adaptée à ses droits (ex. le Commercial voit les ventes + le stock en lecture, l'Acheteur voit les achats).

## Écrans prioritaires à concevoir

### 1. Tableau de bord
KPI : chiffre d'affaires, valeur du stock, rotation des stocks, ruptures de stock, commandes en cours (par statut), achats en cours, performance fournisseurs, performance commerciale, produits proches de la péremption (alerte à 30 jours).

### 2. Ventes — Liste des commandes clients
Tableau des commandes avec : client, statut (Brouillon / Proforma envoyée / BC reçu / Validée / En préparation / Préparée / Livrée), criticité (badges colorés : Urgent / Critique / Réappro), date de livraison souhaitée, montant. Filtres et recherche.

### 3. Ventes — Création / détail d'une commande
- Sélection du client via une fiche client existante (recherche avancée, tri par nom — la base peut contenir 1000+ clients)
- Ajout d'un ou plusieurs produits (recherche produit avec support de la syntaxe `*motif` pour chercher "contient" au lieu de "commence par")
- Champs : quantité, date de livraison souhaitée, criticité, localisation/lieu de livraison, prix unitaire, montant HT/TTC (taxe configurable par entreprise)
- Bouton **« Générer facture proforma »** (génère un PDF avec numéro de suivi)
- Zone **Documents** : upload du Bon de Commande (BC) client en PDF
- Bouton de validation avec les deux chemins : validation standard (BC joint) ou validation dérogatoire (notification au Responsable Logistique)

### 4. Fiche produit / catalogue
Code produit, désignation, prix, famille, options **Part Number (P/N)** et **Serial Number (SN)** (cases à cocher qui révèlent des champs additionnels), unité de mesure avec facteur de conversion.

### 5. Magasins — Feuille de préparation de commande
Liste des articles à préparer avec leur localisation, triés par ordre de préparation optimal. Bouton pour joindre une photo horodatée de la commande préparée. Action « Panier de sortie » pour valider la sortie de stock.

### 6. Stocks — Fiche article
Vue centrale façon logiciel de gestion d'entrepôt (dépôts multiples, quantités, seuils min/max) : quantité en stock, quantité réservée, disponible réel, localisation (`Zone/Dépôt` + `[Étagère][Niveau].[Box]`), dates de péremption/calibrage, lots/numéros de série. En bas de l'écran, **historique des mouvements** de l'article (entrées/sorties, date, quantité, provenance/destination).

### 7. Stocks — Détail des réservations
Sur un article donné : liste des réservations en cours (client, quantité réservée, date de livraison prévue), avec le disponible réel affiché en évidence. Vue permettant d'arbitrer par priorité (criticité de la commande, délai de réapprovisionnement) quand la demande dépasse le disponible.

### 8. Configuration des emplacements (admin entreprise)
Interface pour créer/éditer la structure de stockage propre à l'entreprise : Zones/Dépôts (ex. Outillage, Quarantaine, Produits finis, Retours) et Localisations physiques (ex. `AA1.12`).

### 9. Achats — RFQ et commandes fournisseurs
Émission de RFQ vers plusieurs fournisseurs, comparaison des offres, génération du bon de commande. Indicateur visuel si la commande dépasse le seuil nécessitant une approbation (notification au Responsable Logistique).

### 10. Achats — Réception de marchandises
Écran de contrôle à réception : quantité reçue, état du colis, case **« Conformité de la commande »**. Si non conforme : champ obligatoire pour le motif, redirection visuelle vers le dépôt Quarantaine. Zone pour joindre les documents (facture fournisseur...).

### 11. Fiche fournisseur
Historique des commandes, coordonnées, indicateurs de performance.

## Détails d'interaction importants

- Statuts et criticité toujours représentés par des **badges colorés cohérents** dans toute l'application (mêmes couleurs partout pour "Urgent", "Validée", "Non conforme", etc.)
- Recherche avancée par `*` (contient) disponible sur les listes longues (articles, clients)
- Notifications in-app pour : alerte seuil de stock bas, relance fournisseur à échéance, demande d'approbation (vente sans BC, achat au-dessus du seuil)
- Design pensé responsive (le mobile doit rester exploitable pour un magasinier en déplacement avec son téléphone, notamment pour la préparation de commande et la photo horodatée)

## Ce qui n'est PAS dans le périmètre (ne pas concevoir)

Pas de module Production, Comptabilité, Transport, chat interne, ni assistant IA — ces modules arriveront dans une phase ultérieure du produit.

## Résultat attendu

Un ensemble d'écrans cohérents (maquettes/prototype navigable) qui montrent la direction visuelle et l'ergonomie de l'application, en priorisant le tableau de bord, la création de commande de vente, et la fiche article en stock comme écrans les plus représentatifs du produit.
