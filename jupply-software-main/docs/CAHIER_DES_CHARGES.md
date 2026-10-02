# Cahier des charges fonctionnel — Projet JUPPLY

> Application de gestion de stocks multi-entrepôts. Document de référence
> fonctionnelle, fourni par Jean Didier le 26/08/2026.

## 1. Objectif du projet

JUPPLY est une application web destinée à centraliser la gestion des stocks
de plusieurs entrepôts au sein d'une seule plateforme. Elle remplace l'usage
actuel de fichiers Excel, échanges WhatsApp et documents papier dispersés
entre entrepôts, qui empêchent d'avoir une vision fiable et actualisée du
stock disponible.

### Problèmes identifiés

- Manque de visibilité globale sur le stock réel de chaque entrepôt.
- Risques d'erreur de saisie et écarts entre stock théorique et stock physique.
- Absence de gestion structurée des produits non conformes (nécessité d'un
  emplacement Quarantaine).
- Mouvements de stock parfois oubliés ou mal enregistrés.
- Difficultés à localiser un produit précisément (entrepôt, zone, emplacement).
- Absence de suivi structuré des outillages prêtés puis retournés.

### Résultat attendu

Disposer d'une information fiable et actualisée en temps réel sur les stocks
de tous les entrepôts, avec traçabilité complète de chaque opération (qui,
quand, quoi).

### Trois priorités du projet

- Connaître le stock réel de chaque entrepôt ainsi que son emplacement précis.
- Tracer l'intégralité des mouvements de stock.
- Gérer facilement les transferts entre entrepôts.

## 2. Acteurs et rôles

Le système repose sur une hiérarchie de 4 rôles avec des droits en cascade :
chaque niveau supervise en principe le(s) niveau(x) en dessous de lui.

✔ **Décision actée** — Un utilisateur ne peut avoir qu'un seul rôle,
correspondant à son poste réel. Le cumul de rôles est exclu.

| Rôle | Portée | Responsabilités principales |
|---|---|---|
| Administrateur | Global — tous les entrepôts | Gestion des comptes et des accès, configuration globale, visibilité totale, arbitrage des cas exceptionnels. |
| Superviseur Entrepôt | Global — tous les entrepôts | Supervision de tous les stocks, mouvements et utilisateurs ; peut assigner des accès ; valide les transferts et écarts importants. |
| Gestionnaire d'entrepôt | Un ou plusieurs entrepôts assignés | Gestion opérationnelle : réceptions, sorties, transferts, inventaires, validation des opérations de son ou ses entrepôts. |
| Magasinier | Entrepôt(s) assigné(s) | Saisie des entrées et sorties au quotidien, préparation des produits ; validation possible si autorisée par le Gestionnaire. |

### Règles de visibilité et de modification

- L'Administrateur voit et peut agir sur l'ensemble du système.
- Le Superviseur Entrepôt voit et peut agir sur l'ensemble des entrepôts.
- Le Gestionnaire d'entrepôt et le Magasinier ne voient que le(s) entrepôt(s)
  qui leur sont assignés.
- Chaque action doit pouvoir être consultée via un bouton de traçabilité
  indiquant : nom de l'utilisateur, date et heure.

## 3. Sécurité, droits et validation

### Droits en cascade et privilèges

Les droits standards sont attribués automatiquement selon le rôle. Un
privilège d'accès est un droit supplémentaire, au-delà du standard du rôle,
accordé ponctuellement à un utilisateur (ex. : un Gestionnaire qui reçoit
temporairement le droit de gérer un second entrepôt).

Chaque privilège exceptionnel accordé doit pouvoir être assorti d'une date
d'expiration. Objectif : éviter les droits « oubliés » qui restent actifs
indéfiniment. Cette structure est prévue dès la base de données du MVP.

Toute attribution ou retrait de droit doit être historisé dans un journal
dédié (qui a donné quel droit, à qui, quand, pourquoi), sur le même principe
que la traçabilité des mouvements de stock.

### Validation des opérations

Pour le MVP, la validation reste simple : le Gestionnaire d'entrepôt valide
les opérations de son entrepôt ; le Magasinier peut valider si le
Gestionnaire le lui autorise ; l'administrateur et le superviseur Entrepôt
peuvent intervenir à tout niveau.

Toute correction ou annulation d'une opération déjà validée nécessite
l'autorisation de l'Administrateur, du Superviseur Entrepôt ou du
Gestionnaire d'entrepôt selon le niveau de modification. Les opérations
validées ne sont jamais supprimées : elles sont annulées, en conservant leur
trace.

### Traçabilité

Le système doit pouvoir répondre systématiquement à : qui a fait quoi,
quand, sur quel élément, quelle était la valeur avant, quelle est la valeur
après. Cette exigence s'applique à toutes les opérations : mouvements de
stock, validations, annulations, et attributions de droits.

## 4. Produits

Un produit est un article que l'entreprise achète, reçoit, stocke, déplace,
prête ou sort. Chaque produit possède un code unique servant de référence
principale.

### Attributs d'un produit

- Référence (identifiant unique dans toute l'entreprise)
- Désignation (nom lisible)
- Catégorie (regroupement de produits)
- Unité de mesure
- Prix (pour le calcul de la valeur du stock)
- Fournisseur(s) — un produit peut avoir plusieurs fournisseurs
- Variantes éventuelles (ex. : T-shirt en tailles S / M / L / XL, suivies
  séparément)
- Lot et/ou numéro de série, selon le produit
- Date d'expiration, pour les produits périssables
- Type de produit : Consommable, Outillage ou Rotable (voir section 10)

✔ **Décision actée (27/08/2026)** — Un troisième type de produit,
**Rotable**, s'ajoute à Consommable et Outillage : une pièce réparable qui
sort du stock pour être envoyée en réparation, puis réintègre le stock une
fois réparée (par opposition au Consommable, définitivement consommé à la
sortie, et à l'Outillage, prêté à une personne/service puis simplement
retourné sans réparation). Le champ Type de produit passe donc de deux à
trois valeurs possibles. Le workflow de réparation (envoi vers un atelier/
fournisseur, suivi, retour) n'est pas encore détaillé dans ce document et
reste à spécifier lors de la construction de l'écran correspondant.

Terme retenu pour le regroupement de produits : **« Catégorie »**

Un produit possède une seule unité de mesure. Aucune conversion d'unité
(ex. carton ↔ pièce) n'est gérée dans le MVP : un produit acheté en carton
ne sort qu'en carton.

### Produits équivalents

Deux produits avec des références différentes peuvent être déclarés
équivalents, sans que leurs quantités ne soient additionnées. Depuis la
fiche d'un produit, l'utilisateur doit pouvoir accéder directement à son ou
ses produits équivalents (double clic).

### Recherche de produits

La recherche s'effectue par référence ou par désignation, directement dans
la colonne concernée de la liste des produits.

Le caractère « * » permet une recherche par contenu partiel : il filtre
tous les produits dont la référence ou la désignation contient la suite de
caractères saisie, quelle que soit sa position.

## 5. Entrepôts et localisation

Un entrepôt est un lieu physique de stockage. Un entrepôt peut être
subdivisé en zones, elles-mêmes subdivisées en rayons, étagères et
emplacements précis. La localisation complète d'un produit correspond à la
combinaison : **Entrepôt + Zone + Rayon + Étagère + Emplacement**.

- Un même produit peut être stocké dans plusieurs entrepôts simultanément.
- Un même produit peut avoir plusieurs emplacements au sein d'un même
  entrepôt ; un avertissement doit alors être affiché indiquant
  l'emplacement déjà existant, avant confirmation d'un nouvel emplacement.
- Chaque entrepôt doit disposer d'un emplacement réservé appelé
  **Quarantaine**, pour les produits non conformes, endommagés ou en
  attente de vérification.

Un produit en quarantaine est physiquement présent dans l'entrepôt mais
n'est pas comptabilisé dans le stock disponible. Une action de libération
de quarantaine permet, après vérification, de transférer le produit vers
son emplacement normal.

## 6. Flux de réception

Une réception est le processus par lequel l'entreprise constate l'arrivée
d'une marchandise, généralement en provenance d'un fournisseur.

### Étapes

- Le responsable ou le magasinier de l'entrepôt réceptionne la marchandise.
- Il vérifie le produit, le lot/numéro de série, la quantité, l'état, et le
  numéro de bon de commande le cas échéant.
- Si la quantité et l'état sont conformes, la réception est validée et le
  stock est augmenté.
- Si la quantité reçue est inférieure à la quantité attendue, la réception
  est enregistrée comme partielle ; le reliquat pourra être ajouté
  ultérieurement sur le même bon de commande.
- Si la quantité reçue est supérieure à la quantité attendue, le surplus
  est placé en quarantaine jusqu'à clarification avec le fournisseur.
- Si un produit est endommagé ou non conforme, il est signalé comme
  anomalie et placé en quarantaine ; après vérification, il peut être
  transféré vers son emplacement définitif.
- La validation définitive de la réception est effectuée par le
  Gestionnaire d'entrepôt ; le Magasinier peut également valider si cette
  autorisation lui est accordée.

Le stock n'est augmenté qu'après validation de la réception.

**Au niveau de l'historique, les entrées doivent être en couleur verte.**

### Fournisseurs et bons de commande (PO)

✔ **Décision actée** — Pour cette version, la gestion des stocks est la
priorité. Il n'y a pas d'écran dédié « Fournisseurs » ni « Bons de
commande » dans le MVP : ces informations (fournisseur, numéro de PO)
restent saisies au moment de la réception et consultables via le rapport
des entrées.

→ **Reporté en V2** — Un module Achats complet (création et suivi des bons
de commande / PO, fiche fournisseur détaillée, délais de livraison) sera
ajouté dans une version ultérieure.

## 7. Flux de sortie

Un produit sort de l'entrepôt pour être livré à un client, utilisé en
interne, ou transféré vers un autre entrepôt.

- La sortie est demandée par un utilisateur autorisé et préparée par le
  magasinier ou le responsable.
- Le stock diminue au moment de la confirmation de la sortie.
- Une sortie peut être annulée, avec les droits nécessaires.
- Si le stock disponible est insuffisant, l'application doit empêcher la
  sortie ou afficher une alerte.
- Chaque sortie doit produire un récapitulatif complet (éléments sortis,
  emplacement, quantité...) exportable en PDF, avec un numéro de bon de
  sortie.

**N.B : Au niveau de l'historique, les sorties doivent être en couleur rouge.**

## 8. Transferts entre entrepôts

Le transfert de produits d'un entrepôt vers un autre est une fonction
essentielle du système.

- Le transfert est demandé par le Superviseur Entrepôt.
- Il est validé par l'Administrateur ou le Superviseur Entrepôt concerné,
  selon les règles.
- L'entrepôt source prépare le produit ; le produit quitte officiellement
  l'entrepôt lors de l'expédition.
- Pendant le transport, le produit a le statut « En transit » : il n'est
  plus disponible dans l'entrepôt source, et pas encore disponible dans
  l'entrepôt destination.
- Le produit devient disponible dans l'entrepôt destination lors de la
  confirmation de réception par son responsable.
- Si la quantité reçue diffère de la quantité expédiée, l'écart est
  enregistré.
- Si un transfert n'est jamais réceptionné, il reste en statut « En
  transit » et une alerte peut être déclenchée.
- Un bon de transfert est requis pour tout transfert, avec un numéro de
  suivi unique.

## 9. Inventaire

L'inventaire permet de comparer le stock théorique (calculé par le
système) au stock physique (compté sur le terrain).

- Deux types d'inventaire sont possibles : global ou partiel.
- Avant un inventaire, il doit être possible de signaler son démarrage dans
  le système : le stock concerné reste affiché « en jaune » jusqu'à
  vérification, pour signaler qu'un inventaire est en cours.
- Une fois l'inventaire vérifié et l'absence d'écart confirmée, une ligne
  « Inventaire » est ajoutée à l'historique de chaque produit concerné.
- L'application calcule automatiquement l'écart entre stock théorique et
  stock physique.
- Le responsable valide l'écart ; les écarts importants peuvent nécessiter
  une validation de l'Administrateur ou du Superviseur Entrepôt.
- Une fois l'écart validé, le stock peut être corrigé (ajustement), avec
  conservation de l'historique de l'ajustement.

## 10. Outillage

L'outillage désigne le matériel qui n'est pas simplement consommé, mais
affecté temporairement à une personne ou un service, puis retourné à
l'entrepôt après utilisation.

Un écran dédié « Outillage » est ajouté au MVP, avec une version
simplifiée du workflow, sans complexifier la gestion du stock classique.

### Contenu de l'écran Outillage (V1)

- Liste des outils : référence, désignation, statut (« En stock » /
  « Affecté »).
- Action « Affecter » : sélection de l'outil, de la personne ou du service
  bénéficiaire, et de la date d'affectation.
- Action « Retourner » : remet l'outil en stock disponible, avec date de
  retour.
- Historique par outil, sur le même principe que l'historique des produits
  (Stock → affectation → Utilisation → Retour → Stock).

Pour permettre cette distinction sans dupliquer la structure des données,
chaque produit possède un champ Type : « Consommable » ou « Outillage ».

## 11. Valorisation du stock

La valeur du stock correspond au montant financier estimé du stock
actuellement détenu par l'entreprise. Chaque réception conserve son prix
d'achat réel.

✔ **Décision actée** — Méthode retenue : le Prix Moyen Pondéré (PMP),
conforme au référentiel comptable SYSCOHADA utilisé par l'entreprise. Le
prix de chaque réception continue d'être conservé individuellement en base
de données, ce qui permettra, si nécessaire, de basculer vers une
valorisation FIFO plus tard, ou de proposer les deux méthodes en rapport,
sans perte de données.

## 12. Alertes et automatisation

### Opérations automatiques

- Calcul et mise à jour du stock après chaque mouvement.
- Calcul des écarts d'inventaire.
- Génération des alertes définies ci-dessous.

### Alertes prévues

- Référence en alerte sur la quantité (stock inférieur ou égal au stock
  d'alerte, c'est-à-dire au seuil de réapprovisionnement).
- Référence en alerte sur la date de péremption.
- Référence en commande chez les fournisseurs.
- Référence en alerte sur la date de garantie (fournisseur), déclenchée 7
  jours avant échéance.
- Alerte sur le temps de stock (voir ci-dessous).
- Outillages en alerte (retour attendu, affectation prolongée).
- Transfert en attente de réception.
- Réception non validée après un certain délai.

### Alerte sur le temps de stock

✔ **Décision actée** — Définition retenue : nombre de jours de couverture
de stock restant (équivalent du « Days of Inventory on Hand » utilisé à
l'international), calculé ainsi : **Stock disponible ÷ consommation
moyenne journalière sur les 30 derniers jours glissants**. Ce chiffre est
affiché dans le dashboard.

### Seuils par produit

- Stock minimum : niveau plancher du produit. Il sert de stock d'alerte
  uniquement quand aucun seuil de réapprovisionnement n'est renseigné.
- Stock maximum : niveau que l'entreprise ne souhaite normalement pas
  dépasser.
- Seuil de réapprovisionnement (stock d'alerte, point de commande) : niveau
  à partir duquel l'alerte est déclenchée et une commande doit
  être envisagée.

### Notifications

Les alertes et notifications sont affichées uniquement dans l'application
(aucun envoi d'email dans cette version).

## 13. Dashboard

Le dashboard donne une vue synthétique de la situation, organisée par
catégorie et par entrepôt, avec possibilité de double-cliquer sur chaque
élément pour accéder au détail.

### Doit afficher notamment

- Nombre total de produits en stock et valeur globale du stock.
- Produits en rupture et produits au niveau du stock d'alerte.
- Transferts en cours et dernières opérations.
- Toutes les alertes listées en section 12.
- Entrepôts avec le plus de mouvements, produits qui sortent le plus,
  produits dormants (stocks sans mouvement depuis longtemps).

La vue « Tableau de bord » présente les produits avec : Référence,
Désignation, Stock, Commande, Localisation, Famille/Catégorie. Un clic sur
une ligne ouvre un panneau de détail (bas de l'écran, à droite) affichant :
sens du mouvement (IN/OUT), date, prix, numéro de série, numéro de PO pour
les entrées.

## 14. Rapports et exports

Les rapports disponibles couvrent : état du stock, mouvements,
inventaires, transferts, historique, entrées et sorties — avec
regroupement par jour, semaine, mois, trimestre, semestre et année,
incluant les valeurs financières.

- Export possible en Excel et en PDF.
- Filtres disponibles : entrepôt, produit, catégorie, période, type de
  mouvement.
- Accès aux exports : Administrateur, Superviseur Entrepôt et Gestionnaires
  d'entrepôt, selon leurs droits.

✔ **Décision actée** — Le rapport des entrées inclut également les
informations fournisseur associées à chaque réception, en l'absence
d'écran Fournisseurs dédié dans cette version.

## 15. Import des données existantes

L'application doit permettre d'importer, depuis des fichiers Excel, les
produits, les stocks initiaux, ainsi que les historiques existants
d'entrées et de sorties, afin de ne pas démarrer avec une base vide.

## 16. Écrans de l'application (Version 1)

| Écran | Contenu principal |
|---|---|
| Dashboard | Indicateurs clés, alertes par catégorie et par entrepôt, détail au double-clic. |
| Produits | Liste des produits, catégorie, référence, seuils, stock réel, localisation, quantité commandée, produits équivalents, historique des mouvements par produit. |
| Entrepôts | Liste des entrepôts et leurs informations (zones, emplacements). |
| Stock | Stock initial, entrées, sorties, stock disponible par produit et par entrepôt. |
| Réceptions | Réceptions en attente, validées ou avec anomalies ; détail au double-clic. |
| Sorties | Demandes et sorties réalisées, numéro de bon de sortie, export PDF. |
| Transferts | Transferts demandés, validés, expédiés, en transit, reçus. |
| Inventaires | Inventaires en cours et historique. |
| Outillage | Liste des outils, statut, affectation, retour, historique par outil. |
| Mouvements | Historique global des mouvements de stock (IN/OUT/Transfert/Ajustement/Inventaire). |
| Utilisateurs | Utilisateurs, rôles, entrepôts assignés, privilèges. |
| Rapports | Rapports avec filtres et export Excel/PDF. |
| Paramètres | Configuration générale de l'application. |

## 17. Périmètre de la Version 1 (MVP)

Le MVP (Minimum Viable Product) regroupe les fonctionnalités strictement
nécessaires pour apporter une vraie valeur dès le lancement :

- Créer les utilisateurs (avec leurs rôles et entrepôts assignés).
- Créer les entrepôts.
- Créer les produits.
- Enregistrer les entrées.
- Enregistrer les sorties.
- Effectuer les transferts.
- Consulter les stocks.
- Voir l'historique des mouvements.
- Disposer d'un dashboard simple.
- Gérer l'outillage (affectation / retour).
- Expiration automatique des privilèges d'accès exceptionnels.

**Résumé du flux central :** Produits → Entrepôts → Stock → Entrées →
Sorties → Transferts → Historique → Dashboard, complété par le module
Outillage.

## 19. Contraintes générales

- Application web, accessible depuis un navigateur, sans installation.
- Interface responsive, utilisable confortablement sur ordinateur et
  tablette (usages principaux).
- Fonctionnement en ligne requis pour le MVP (pas de mode hors-ligne).
- Volumétrie estimée : quelques cinquantaines d'utilisateurs au
  lancement, plusieurs entrepôts, plusieurs centaines à quelques milliers
  de produits, volume de mouvements potentiellement important —
  l'application doit rester performante.
- Le système doit empêcher un stock négatif ; une autorisation
  exceptionnelle pourra être envisagée plus tard.
- En cas d'opérations simultanées par deux utilisateurs, le système doit
  éviter toute incohérence dans l'enregistrement des données.

## 20. Journal des clarifications

Ce journal récapitule les points ayant fait l'objet d'une clarification
lors de la revue du cahier des charges initial, afin de garder une trace
des décisions prises.

| # | Sujet | Décision |
|---|---|---|
| 1 | Validation des opérations | MVP simple ; structure de données prête pour des seuils de validation (Maker-Checker) en V2. |
| 2 | Droits en cascade / privilèges | Structure prête pour des privilèges avec date d'expiration ; journal des attributions de droits prévu. |
| 3 | Rôles multiples | Interdits — un utilisateur = un seul rôle, selon son poste. |
| 4 | Fournisseurs | Pas d'écran dédié en V1 ; information consultable dans le rapport des entrées. |
| 5 | Bons de commande (PO) | Reportés au module Achats (V2). |
| 6 | Valorisation du stock | Prix Moyen Pondéré (PMP), conforme SYSCOHADA. |
| 7 | Alerte sur le temps de stock | Jours de couverture = stock disponible ÷ consommation moyenne journalière (30 jours glissants). |
| 8 | Recherche avec * | Filtre par « contient ». |
| 9 | Unité de mesure | Un produit = une seule unité ; pas de conversion dans le MVP. |
| 10 | Notifications | Uniquement dans l'application, pas d'email. |
| 11 | Catégorie / Famille | Terme retenu : « Catégorie ». |
| 12 | Outillage | Intégré en V1 avec un écran simplifié dédié. |
| 13 | Réservation de stock | Reportée au module Achats (V2). |
| 14 | Rôle Magasinier | Remplace « Gestionnaire adjoint » ; même niveau hiérarchique. |

---

Ce document constitue la référence fonctionnelle pour la conception et le
développement de la Version 1 (MVP) de JUPPLY. Voir également le
[Glossaire du projet JUPPLY](GLOSSAIRE.md) pour la définition précise de
chaque terme métier.
