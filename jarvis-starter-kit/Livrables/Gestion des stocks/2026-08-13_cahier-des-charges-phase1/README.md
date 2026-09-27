# Cahier des charges fonctionnel — Phase 1
## Application de gestion des stocks, ventes et approvisionnements

**Date :** 13/08/2026
**Statut :** Cadrage fonctionnel — base pour le prompt de design (Claude Design)

---

## 1. Vue d'ensemble

Application web SaaS multi-entreprises permettant aux PME et commerces de gérer leur cycle vente → stock → approvisionnement, à coût réduit par rapport aux ERP classiques (Odoo, SAP, Microsoft Dynamics).

**Stratégie produit :** construction en phases plutôt que l'ERP complet d'un coup, pour générer un premier revenu rapidement.

- **Phase 1 (ce document) :** modules Ventes (Commercial), Magasins/Stocks, Approvisionnement (Achats)
- **Phase 2+ (roadmap, hors périmètre) :** Production, Comptabilité, Transport, chat interne, intelligence artificielle

**Inspiration produit :** Odoo, Microsoft Dynamics, et le logiciel métier AIRSTOCK (référence pour la gestion des dépôts/emplacements et l'historique des mouvements par article).

---

## 2. Architecture générale

### Multi-entreprises (multi-tenant)
- Une seule plateforme hébergeant plusieurs entreprises clientes, avec des données **complètement séparées**
- Chaque entreprise personnalise : logo, nom
- TVA/taxe **configurable par entreprise**
- Structure de stockage (dépôts, emplacements) **configurable par entreprise** (voir §5.3)
- Seuils de stock **configurables par article et par entreprise**
- Numérotation des documents (proforma, BC...) : automatique et séquentielle en Phase 1 ; personnalisation du format par entreprise repoussée en Phase 2

### Web et mobile
- **Ordinateur :** accès complet à toutes les données et fonctionnalités
- **Téléphone :** accès aux mêmes données via navigateur web responsive (logique "Outlook web"), pas d'application native prévue en Phase 1

### Modèle commercial
- SaaS hébergé, abonnement mensuel ou annuel (-15% sur l'annuel)
- **Essai gratuit : 60 jours, sans carte bancaire requise**
- *Note : la gestion de la facturation d'abonnement (billing SaaS) n'a pas besoin d'être automatisée dès la Phase 1 — peut être gérée manuellement au démarrage.*

---

## 3. Rôles et permissions (Phase 1)

Seuls les rôles utiles aux modules Phase 1 sont détaillés ici. Les rôles Comptable et Ingénieur Production seront ajoutés avec leurs modules respectifs en Phase 2.

| Rôle | Droits |
|---|---|
| **Administrateur** | Crée les comptes utilisateurs et gère les accès |
| **Directeur** | Accès à toutes les données, lecture seule |
| **Responsable Logistique** | Accès à toutes les données, lecture seule, Modification sur tout sauf interface commercial — **+ droit de validation** des commandes soumises sans Bon de Commande client (workflow d'approbation, voir §5.4) |
| **Magasinier** | Accès à tout, modification uniquement sur les éléments liés au stock |
| **Acheteur** | Accès limité aux éléments liés à ses tâches (achats) |
| **Commercial** | Accès au stock (lecture, pour vérifier la disponibilité) et à ses outils de vente |

---

## 4. Module Ventes (Commercial)

### 4.1 Catalogue produits (référentiel partagé Ventes/Stocks/Achats)
- Fiche produit centralisée : code produit, désignation, unité, prix unitaire, famille/catégorie
- Case à cocher **« Article avec Part Number (P/N) »** → active un champ code produit/P-N dédié
- Case à cocher **« Serial Number (SN) »** → active le suivi par numéro de série sur cet article
- **Unité de mesure avec facteur de conversion** (ex. 1 carton = 24 unités) : le stock et les mouvements peuvent être suivis dans l'unité d'achat (carton) et l'unité de vente (unité), converties automatiquement

### 4.2 Fiche client
- Base clients : chaque client est enregistré une fois (nom, contact, adresse, localisation de livraison...)
- Lors de la création d'une commande, le commercial **sélectionne** le client existant dans une liste au lieu de ressaisir ses informations (historique par client, pas de doublons liés à des fautes de frappe)
- **Recherche avancée** obligatoire dès que la base grandit (ex. 1000+ clients) : tri par nom + recherche pour retrouver et sélectionner rapidement un client (même logique de recherche que celle des articles en §5.6)

### 4.3 Création d'une commande client
Le commercial ouvre sa session et enregistre la commande en précisant :
- Client (sélectionné depuis la fiche client, §4.2)
- Produit(s) — possibilité d'ajouter **un ou plusieurs produits** à la même commande
- Quantité demandée
- Date de livraison souhaitée
- Criticité : **Urgent / Critique / Réappro**
- Date de commande : automatique (date du jour)
- Localisation du client / lieu de livraison souhaité (si disponible)
- Prix unitaire, montant HT, montant TTC (taxe appliquée selon le taux configuré par l'entreprise)

### 4.4 Facture proforma
- Bouton **« Générer facture proforma »** → génère un PDF à envoyer au client
- Numéro de suivi unique par facture proforma, **modifiable** et mis à jour
- Objectif : le client utilise cette proforma pour émettre son propre Bon de Commande (BC)

### 4.5 Suivi documentaire
- Une fois le BC reçu du client, il est **joint en PDF au dossier de la commande** (onglet Documents)
- Permet de retrouver le BC à tout moment sans dépendre du support physique

### 4.6 Validation de la commande
Deux chemins possibles :
1. **Cas standard :** BC client (PDF) joint au dossier + validation du panier → commande validée
2. **Cas dérogatoire :** validation du panier **sans** BC PDF → notification automatique envoyée au **Responsable Logistique** pour approbation → une fois approuvée, la commande est prise en compte

Dans les deux cas, une fois la commande validée → **notification automatique envoyée au Magasin** pour préparation.

### 4.7 Cycle de vie d'une commande
`Brouillon → Proforma envoyée → BC reçu (ou validation dérogatoire soumise) → Validée → En préparation → Préparée → Livrée`

---

## 5. Module Magasins / Stocks

### 5.1 Préparation de commande
- Une commande validée génère une **feuille de préparation** listant tous les articles avec leur localisation
- Les articles sont triés selon un **ordre de préparation optimal** (chemin de picking le plus efficace dans l'entrepôt)

### 5.2 Preuve de préparation
- Une fois la commande préparée, **photo horodatée** prise depuis le téléphone utilisé pour la préparation, rattachée à la commande
- Usage **interne uniquement** (non visible du client)
- Trois usages : preuve de préparation conforme, donnée d'analyse du temps de préparation, protection en cas de litige avec le transporteur (permet de savoir si l'erreur vient de la préparation ou du transport)

### 5.3 Structure de stockage (configurable par entreprise)
Deux niveaux, entièrement personnalisables (noms créés/édités librement par chaque entreprise) :

- **Niveau 1 — Zone / dépôt**, exemples : Outillage, Quarantaine, Pièces A320, Pièces A330, Matières premières, Produits finis, Retours, Batteries
- **Niveau 2 — Localisation physique**, format `[Étagère][Niveau].[Box]`, exemples : AA1.12, AB2.05, AC1.08, BA3.15

### 5.4 Gestion des écarts stock virtuel / stock physique
Cas type : le commercial consulte le stock système, confirme une disponibilité au client, mais au moment de la préparation le magasinier constate que le stock physique réel est inférieur.
→ Le magasinier **signale l'écart au commercial** et **avise la production** (besoin de réassort/fabrication).

### 5.5 Réservation de stock
- Dès qu'une commande client est validée (§4.6), la quantité correspondante est **réservée** sur le stock de l'article et n'apparaît plus comme disponible pour d'autres ventes
- **Disponible réel** = Stock total − Somme des réservations en cours
- **Détail des réservations visible par article** : liste des réservations en cours avec client, quantité réservée, date de livraison prévue
  *Exemple : sur 50 stylos en stock, si un client a réservé 15 pour livraison dans 2 mois, il reste 35 disponibles immédiatement pour d'autres commandes.*
- **Arbitrage en cas de demande supérieure au disponible réel** : si un nouveau client demande une quantité supérieure au disponible immédiat (ex. il veut les 50 stylos sur place), le système permet de visualiser les réservations existantes (client, quantité, délai) pour arbitrer quelle commande est servie en priorité, en tenant compte :
  - de la **criticité** de chaque commande (Urgent / Critique / Réappro, §4.3)
  - du **délai de réapprovisionnement** prévu auprès des fournisseurs (module Achats, §6.1) pour savoir si la demande peut être couverte par un réassort avant l'échéance

### 5.6 Sortie de stock (commande client)
- Clic droit sur la commande préparée → **« Panier de sortie »** → validation → la sortie de stock est officialisée dans le système

### 5.7 Sorties manuelles (hors commande — pharmacies, garages, prestataires de service...)
- L'utilisateur sélectionne l'article concerné (avec recherche), précise la quantité, valide
- **Recherche avancée :** si l'utilisateur ne connaît pas le début du nom/code de l'article, il peut taper `*` suivi d'une suite de lettres/chiffres pour rechercher **« contient »** au lieu de **« commence par »**

### 5.8 Traçabilité des articles
- Dates de péremption et de calibrage
- Numéros de lot ou de série
- Suivi des outillages : articles prêtés puis retournés en stock (cycle prêt/retour)
- Méthodes de gestion : **FIFO** et **FEFO**
- **Historique des mouvements par article** : consultable en cliquant sur l'article (sens entrée/sortie, date, quantité, prix, N° de série/lot, provenance/destination) — inspiré de la référence AIRSTOCK fournie
- **Traçabilité amont/aval par lot** : pour un numéro de lot donné, retrouver à quels clients il a été vendu (utile en cas de rappel produit)

### 5.9 Retours clients (version simple)
- Le client signale un problème sur une commande livrée (article manquant, défectueux, erreur de livraison)
- Le commercial ou le magasinier enregistre un **retour** lié à la commande d'origine : motif, quantité concernée, statut (**Ouvert** / **Résolu**)
- Les articles physiquement retournés peuvent être réintégrés dans le dépôt **Retours** (zone déjà prévue en §5.3)
- *Version simple : pas de workflow d'approbation ni de remboursement automatisé en Phase 1 — traçabilité et suivi de statut uniquement*

---

## 6. Module Approvisionnement (Achats)

### 6.1 Demande de prix et commande fournisseur
- Émission de **RFQ (Request For Quotation)** vers un ou plusieurs fournisseurs
- Comparaison des offres reçues selon des **critères définis librement par chaque entreprise**
- Génération du **Bon de Commande fournisseur** à partir de l'offre retenue

### 6.2 Workflow d'approbation des achats
- **Seuil de montant configurable par entreprise** : en dessous, l'acheteur valide seul la commande fournisseur
- **Au-dessus du seuil**, la commande part automatiquement en attente d'approbation du **Responsable Logistique** avant d'être envoyée au fournisseur (même logique que la dérogation BC côté vente, §4.6)

### 6.3 Fiche fournisseur
- Base fournisseurs avec historique

### 6.4 Réception des marchandises
Après contrôle physique de la marchandise à réception, deux cas d'enregistrement :

**a) Réception liée à une commande existante**
- Clic droit sur la commande fournisseur → bouton **« Réception »**
- Écran de contrôle : quantité reçue, état du colis/des articles...
- Case **« Conformité de la commande »** :
  - **Cochée non conforme** → saisie obligatoire du motif de non-conformité → les articles sont affectés au **dépôt Quarantaine** au lieu du stock normal
  - **Conforme** → mise à jour normale du stock

**b) Réception manuelle** (marchandise reçue sans commande préalable dans le système)
- Écran d'enregistrement dédié, indépendant d'une commande

**Pièces jointes**
- Toute entrée issue d'une commande fournisseur ou pas doit permettre de **joindre les documents liés** (facture fournisseur, etc.)
- Ces documents doivent être consultables depuis l'historique de l'article (§5.7)

### 6.5 Seuils de stock
- Seuils minimum/maximum configurables **par article et par entreprise** (déclenchent les alertes, voir §7)

---

## 7. Automatisations (Phase 1)

- **Alerte seuil bas :** dès qu'un article atteint son seuil minimum, notification envoyée au responsable dans le système
- **Relance fournisseur :** à l'échéance de la date de livraison prévue d'une commande fournisseur, notification envoyée à l'acheteur/responsable pour relancer le fournisseur
- **Approbation achats :** notification au Responsable Logistique dès qu'une commande fournisseur dépasse le seuil de montant défini par l'entreprise (§6.2)
- **Export de rapports périodiques**

*(Le chat interne est repoussé à la Phase 2 / grand ERP, décision confirmée.)*

---

## 8. Tableaux de bord & KPI (Phase 1)

Limités aux données disponibles avec les modules Phase 1 (Ventes, Stocks, Achats) :

- Chiffre d'affaires
- Valeur du stock
- Rotation des stocks
- Ruptures de stock
- Suivi des commandes (par statut)
- Suivi des achats
- Performance fournisseurs
- Performance commerciale
- Produits proches de la péremption (alerte à 30 jours)

*Retirés du périmètre Phase 1 (dépendent de modules non construits) : performance transport, éléments comptables/recouvrement, KPI production. Le suivi des livraisons et la gestion des litiges/retours n'ont pas été détaillés en tant que processus — proposés en §9 pour discussion, sinon repoussés en Phase 2.*

---

## 9. Propositions inspirées d'Odoo / SAP — décisions

Toutes les propositions ont été tranchées :

| Proposition | Décision | Détail |
|---|---|---|
| Unités de mesure et conversions | ✅ Incluse Phase 1 | §4.1 |
| Réservation de stock à la validation | ✅ Incluse Phase 1, enrichie (arbitrage par priorité/délai) | §5.5 |
| Numérotation de documents configurable | ✅ Version simple Phase 1 (auto-incrémentale), personnalisation par entreprise en Phase 2 | §2 |
| Workflow d'approbation multi-niveaux achats | ✅ Incluse Phase 1, seuil configurable par entreprise | §6.2 |
| Traçabilité amont/aval par lot | ✅ Incluse Phase 1 | §5.8 |
| Portail client en lecture seule | ❌ Repoussée au grand ERP (Phase 2+) | — |

---

## 10. Décisions complémentaires

- **Gestion des retours/litiges clients :** incluse en Phase 1, version simple (§5.9) — pas de workflow d'approbation ni de remboursement automatisé pour l'instant
- **Billing SaaS (abonnements) :** confirmé hors Phase 1, gestion manuelle au démarrage (§2)

---

## 11. Hors périmètre Phase 1 (roadmap)

- Module Production (planification, maintenance, demandes vers Achats)
- Module Comptabilité (recouvrement, facturation définitive)
- Module Transport (planification, optimisation d'itinéraires)
- Chat interne
- Intelligence artificielle (assistant, prévisions de demande, génération de rapports, requêtes en langage naturel, détection d'anomalies, recommandations d'achat)
- Rôles Comptable et Ingénieur Production
- KPI liés à ces modules
