# Glossaire du projet JUPPLY

> Dictionnaire des termes métier — Application de gestion de stocks
> multi-entrepôts. Fourni par Jean Didier le 26/08/2026, en complément du
> [Cahier des charges](CAHIER_DES_CHARGES.md).

## 1. Les notions de base du stock

**Produit** — Un article que l'entreprise achète, reçoit, stocke, déplace,
prête ou sort. *Ex. : Ordinateur Dell Latitude 5440.* Un produit possède
aussi un Type (Consommable ou Outillage) — voir section 9.

**Référence produit** — Le code qui permet d'identifier précisément un
produit. Il est unique pour toute l'entreprise. *Ex. : DELL-L5440-16G.*

**Désignation** — Le nom lisible du produit. *Ex. : Ordinateur Dell
Latitude 5440 16 Go.*

**Catégorie** — Un groupe dans lequel on classe les produits. *Ex. :
Informatique, Mobilier, Outillage, Consommables.*

**Unité de mesure** — La manière de compter le produit. *Ex. : pièce,
carton, kilogramme, litre.* Un produit possède une seule unité de mesure.
Aucune conversion entre unités (ex. carton ↔ pièce) n'est gérée dans le
MVP : un produit acheté en carton ne sort qu'en carton.

## 2. Les quantités de stock

**Stock initial** — La quantité présente dans l'entrepôt au moment où
JUPPLY commence à être utilisé. Importé depuis Excel au démarrage du
projet.

**Stock disponible** — La quantité que l'on peut réellement utiliser ou
sortir maintenant.

**Stock physique** — La quantité réellement présente dans l'entrepôt
lorsque l'on compte physiquement les produits.

**Stock théorique** — La quantité que le système pense avoir en stock en
fonction de toutes les opérations enregistrées. Peut différer du stock
physique en cas d'erreur, de perte ou de mouvement non enregistré.

**Stock minimum** — Le niveau en dessous duquel le stock est considéré
comme faible.

**Stock maximum** — La quantité que l'entreprise ne souhaite normalement
pas dépasser.

**Seuil de réapprovisionnement (stock d'alerte, point de commande)** — Le
niveau de stock qui déclenche l'alerte dans l'application, et à partir duquel il
faut envisager de refaire une commande.

**Stock dormant** — Un produit qui reste très longtemps en stock sans
mouvement. Identifié depuis le dashboard.

**Valeur du stock** — Montant financier estimé du stock actuellement
détenu par l'entreprise. Chaque réception conserve son prix d'achat réel ;
la valeur globale est calculée selon une méthode de valorisation (PMP pour
JUPPLY).

**Prix Moyen Pondéré (PMP)** — Méthode de valorisation du stock qui
recalcule un prix moyen à chaque nouvelle entrée, en tenant compte des
quantités et des prix déjà en stock. Méthode officiellement retenue pour
JUPPLY, conforme au référentiel comptable SYSCOHADA. Le prix de chaque
réception reste conservé individuellement en base, ce qui permettra une
bascule vers du FIFO plus tard si besoin.

**FIFO (First In, First Out)** — Méthode de valorisation où l'on
considère que les produits entrés en premier sont sortis en premier ;
chaque sortie reprend le prix exact du lot le plus ancien encore en stock.
Non retenue comme méthode principale pour JUPPLY, mais reste possible
techniquement dans le futur car chaque réception garde son propre prix.

## 3. Localisation physique

**Entrepôt** — Un lieu physique dans lequel les produits sont stockés. Il
peut y avoir plusieurs entrepôts.

**Zone** — Une partie d'un entrepôt. *Ex. : Entrepôt A → Zone A → Zone B.*

**Emplacement** — L'endroit précis où se trouve le produit. *Ex. :
Entrepôt A → Zone 2 → Rayon 04 → Étagère B → Emplacement 07.*

**Localisation** — L'information permettant de savoir où se trouve le
produit : la combinaison Entrepôt + Zone + Rayon + Étagère + Emplacement.
« Localisation », « emplacement » et « position » désignent la même chose.

**Quarantaine** — Un emplacement spécial où l'on place un produit qui ne
doit pas encore être considéré comme utilisable (endommagé, non conforme,
en attente de vérification). Chaque entrepôt possède sa propre Quarantaine.
Un produit en quarantaine est physiquement présent mais n'est pas
comptabilisé dans le stock disponible.

**Libération de quarantaine** — Action qui permet de sortir un produit de
la quarantaine et de le remettre dans le stock utilisable, après
vérification.

## 4. Les mouvements de stock

**Mouvement de stock** — Toute opération qui change la quantité ou la
localisation d'un produit. *Ex. : Entrée, Sortie, Transfert, Ajustement,
Inventaire, Affectation, Retour.*

**IN / OUT** — Notation utilisée dans l'historique des produits : IN =
entrée, OUT = sortie.

**Entrée** — Opération par laquelle une quantité de produit entre dans un
stock. *Ex. : 50 ordinateurs reçus d'un fournisseur.*

**Sortie** — Opération par laquelle une quantité quitte un stock. *Ex. :
10 ordinateurs livrés au service informatique.* La raison de la sortie est
conservée dans l'historique.

**Ajustement de stock** — Modification exceptionnelle du stock pour
corriger une différence entre le stock du système et la réalité. *Ex. :
Système : 100, comptage : 97 → Ajustement : –3.* Les ajustements sont
historisés et contrôlés.

**Inventaire** — Opération pendant laquelle on compte physiquement les
produits afin de vérifier si le stock du système correspond à la réalité.
Deux types : inventaire global et inventaire partiel.

**Écart d'inventaire** — Différence entre la quantité attendue par le
système et la quantité réellement comptée. *Ex. : Système = 120, comptage
= 115 → Écart = –5.*

## 5. Achats et réception

**Bon de commande / PO** — Purchase Order — document qui indique ce que
l'entreprise a commandé au fournisseur. Le numéro de PO est conservé lors
des réceptions. La création et le suivi complet des PO sont reportés au
futur module Achats (V2). En V1, seul le numéro de PO est saisi et
consultable au moment de la réception.

**Réception** — Processus par lequel l'entreprise constate qu'une
marchandise est arrivée. Une réception ne signifie pas forcément que tout
est accepté immédiatement.

**Réception partielle** — Une commande n'est pas livrée entièrement. *Ex. :
Commandé : 100, reçu : 70 → reste à recevoir : 30.* Le reliquat peut être
complété plus tard sur le même bon de commande.

**Réception en excès** — Le fournisseur livre davantage que ce qui avait
été commandé. *Ex. : Commandé : 100, reçu : 110.* Le surplus entre en
stock, sauf si l'opérateur le déclare non conforme (il passe alors en
quarantaine le temps de clarifier la situation).

**Produit non conforme** — Produit reçu mais qui ne respecte pas ce qui
était attendu (mauvais modèle, produit cassé, mauvais numéro de série,
mauvaise quantité ou spécification). Identifié comme anomalie et placé en
quarantaine.

**BL / Bon de livraison** — Document accompagnant généralement la
marchandise et indiquant ce qui a été livré.

**LTA** — Lettre de Transport Aérien — document lié au transport de
marchandises.

**Fournisseur** — Entreprise ou personne auprès de laquelle un produit est
acheté. Un produit peut avoir plusieurs fournisseurs. Pas d'écran dédié
« Fournisseurs » en V1 ; l'information reste saisie à la réception et
consultable dans le rapport des entrées. Un écran dédié est prévu avec le
module Achats (V2).

## 6. Lot, numéro de série et expiration

**Numéro de lot** — Un numéro identifiant un groupe de produits fabriqués
ou reçus ensemble. *Ex. : LOT-2026-0825.*

**Numéro de série / S/N** — Serial Number — un identifiant unique donné à
une unité individuelle. *Ex. : Ordinateur A → S/N 001234.*

**Différence lot / série** — Le lot regroupe plusieurs produits ; le
numéro de série identifie une unité particulière.

**Date d'expiration** — Date après laquelle le produit ne doit normalement
plus être utilisé ou vendu. Des alertes sont prévues avant expiration.

## 7. Variantes et produits équivalents

**Variante produit** — Une version différente d'un même produit qui doit
être suivie séparément. *Ex. : T-shirt → S / M / L / XL, chacun suivi
individuellement.*

**Produit équivalent** — Un autre produit, avec un code différent,
considéré comme répondant au même besoin. Les quantités ne sont pas
additionnées entre produits équivalents. *Ex. : Produit A : FILTRE-001 (10
disponibles) ↔ Produit B : FILTRE-XYZ (5 disponibles).* Depuis la fiche
d'un produit, un double clic permet d'accéder à son ou ses produits
équivalents.

## 8. Recherche et filtres

**Filtre** — Mécanisme permettant de réduire une liste pour n'afficher que
les éléments correspondant à un critère. *Ex. : Entrepôt = Abidjan,
Catégorie = Informatique.*

**Recherche avec \*** — Recherche par contenu partiel de la référence ou
de la désignation. *Ex. : \*5440 renvoie toutes les références contenant
« 5440 », quelle que soit sa position.* Règle officiellement retenue : le
caractère « * » filtre par « contient ».

## 9. Outillage

**Outillage** — Matériel qui n'est pas simplement consommé, mais qui peut
être affecté à une personne ou un service puis retourné à l'entrepôt.
Intégré dès la Version 1, avec un écran dédié simplifié.

**Affectation** — Action d'attribuer un outil à une personne, une équipe
ou un service. *Ex. : Perceuse P-003 affectée à Jean Dupont.*

**Retour** — Action par laquelle l'outil affecté revient à l'entrepôt.
Crée un historique du type : Stock → Affectation → Utilisation → Retour →
Stock.

**Type de produit** — Attribut d'un produit indiquant s'il s'agit d'un
Consommable (sortie définitive), d'un Outillage (prêt puis retour) ou d'un
Rotable (envoyé en réparation puis retour). Permet de distinguer les trois
logiques de gestion sans dupliquer la structure des données.

**Rotable** NOUVEAU — Pièce réparable qui sort du stock pour être envoyée
en réparation (atelier interne ou fournisseur), puis réintègre le stock
une fois réparée. *Ex. : Onduleur envoyé en réparation, puis remis en
stock une fois le composant défectueux remplacé.* Différence avec
l'Outillage : l'Outillage revient tel quel après usage (prêt), le Rotable
revient après une intervention de réparation. Ajouté au vocabulaire le
27/08/2026 ; le workflow de suivi de réparation reste à construire.

## 10. Les transferts

**Transfert inter-entrepôts** — Déplacement de produits d'un entrepôt vers
un autre.

**Entrepôt source** — L'entrepôt qui possède actuellement le produit et
qui l'expédie.

**Entrepôt destination** — L'entrepôt qui doit recevoir le produit.

**En transit** — Le produit a quitté l'entrepôt source mais n'a pas encore
été reçu par l'entrepôt destination.

## 11. Les utilisateurs et responsabilités

**Utilisateur** — Une personne qui possède un compte dans JUPPLY.

**Rôle** — La fonction ou le niveau de responsabilité d'une personne dans
l'application. 4 rôles retenus pour JUPPLY : Administrateur, Superviseur
Entrepôt, Gestionnaire d'entrepôt, Magasinier. Un utilisateur ne possède
qu'un seul rôle, correspondant à son poste réel — le cumul de rôles n'est
pas autorisé.

**Administrateur** — Personne qui gère principalement les comptes, les
accès et la configuration globale. Visibilité globale sur l'ensemble du
système.

**Superviseur Entrepôt** — Le responsable qui supervise l'ensemble des
entrepôts. Vision globale, peut intervenir sur plusieurs entrepôts et
assigner des accès.

**Gestionnaire d'entrepôt** — Personne responsable de la gestion
opérationnelle d'un ou plusieurs entrepôts. Peut gérer un seul entrepôt ou
plusieurs, selon son affectation.

**Magasinier** — Personne travaillant sous la responsabilité d'un
Gestionnaire d'entrepôt, chargée principalement de la saisie des entrées et
sorties (anciennement « Gestionnaire adjoint »). Le Magasinier peut valider
des opérations si le Gestionnaire d'entrepôt le lui autorise.

## 12. Droits, accès et permissions

**Droit d'accès** — Ce qu'un utilisateur a le droit de faire ou de voir.
*Ex. : Voir le stock ✅ · Modifier le stock ❌ · Supprimer un utilisateur
❌.*

**Permission** — Autorisation précise accordée à un utilisateur. *Ex. :
Permission de consulter, de créer, de modifier, de valider.*

**Privilège d'accès** — Un droit supplémentaire accordé à une personne
au-delà de ce que son rôle standard lui permet. *Ex. : Gestionnaire =
droit standard sur son entrepôt ; privilège = autorisation exceptionnelle
de gérer également un second entrepôt.* Amélioration prévue : chaque
privilège pourra à terme être assorti d'une date d'expiration, afin
d'éviter les droits « oubliés » qui restent actifs indéfiniment. Toute
attribution de privilèges est historisée.

**Droits en cascade** — Système dans lequel certains responsables peuvent
attribuer certains droits aux personnes placées sous leur responsabilité.
*Ex. : Administrateur → Superviseur → Gestionnaire d'entrepôt →
Magasinier.* Le détail exact de ce que chaque niveau peut attribuer doit
rester strictement encadré, pour ne pas créer un système difficile à
contrôler.

**Maker-Checker** — Principe de sécurité selon lequel la personne qui
saisit une opération ne doit pas être la même que celle qui la valide, en
particulier au-delà d'un certain seuil de valeur. Non activé dans le MVP,
mais la structure de données (seuil de validation par produit ou entrepôt)
est prévue dès le départ pour permettre son activation future sans refonte.

## 13. Validation et contrôle

**Validation** — Action par laquelle une personne autorisée confirme
qu'une opération est correcte. *Ex. : Réception saisie → vérification →
validation → stock augmenté.*

**Annulation** — Action qui permet de rendre une opération précédemment
validée non applicable, tout en gardant sa trace. Préférée à la
suppression des opérations validées.

**Traçabilité** — Pouvoir répondre à : qui a fait quoi, quand, sur quoi,
quelle était la valeur avant, quelle est la valeur après. Le nom, la date
et l'heure de chaque action doivent être consultables.

**Historique** — La liste chronologique des opérations effectuées sur un
produit ou dans le système. *Ex. : IN - S/N - 20 - 01/08 · OUT - S/N -
1000 - 01/08 · Inventaire - 01/08.*

**Audit / journal d'audit** — Une trace des actions réalisées dans le
système. *Ex. : Marie, 25/08/2026 10:32, modification de quantité : 40 →
35.*

## 14. Dashboard

**Dashboard / Tableau de bord** — L'écran qui donne une vue synthétique de
la situation. Affiche notamment : stock, ruptures, stocks faibles,
transferts, dernières opérations, expirations, anomalies.

**Alerte** — Message indiquant qu'une situation mérite l'attention d'un
utilisateur. *Ex. : Stock trop faible, produit expirant bientôt, transfert
non réceptionné, produit en quarantaine, outillage à retourner.* Toutes
les alertes sont affichées uniquement dans l'application (pas d'email
dans cette version).

**Jours de couverture de stock** — Nombre de jours restants avant
rupture, estimé à partir du stock disponible et de la consommation moyenne
récente. Formule : Stock disponible ÷ consommation moyenne journalière (30
derniers jours glissants). Équivalent du « Days of Inventory on Hand »
utilisé à l'international.

## 15. Rapports et exports

**Rapport** — Un document ou une vue permettant d'analyser les données.
*Ex. : Rapport des entrées, des sorties, d'inventaire, des transferts.*
Disponibles par jour, semaine, mois, trimestre, semestre et année.

**Export Excel** — Permet de sortir les informations JUPPLY sous forme de
fichier Excel.

**Export PDF** — Permet de produire un document PDF à partir d'une
opération ou d'un rapport. Prévu notamment pour les sorties.

## 16. Interface et technologie

**Application web** — Application accessible depuis un navigateur
Internet, sans nécessairement installer un logiciel sur chaque ordinateur.

**Responsive** — Interface qui s'adapte automatiquement à la taille de
l'écran. Usages principaux prévus : ordinateur et tablette.

**MVP (Minimum Viable Product)** — Première version minimale contenant
uniquement ce qui est nécessaire pour apporter une vraie valeur. Pour
JUPPLY, le MVP comprend : Produits, Entrepôts, Stock, Entrées, Sorties,
Transferts, Historique, Dashboard, et l'écran Outillage.

**Application mobile native** — Une véritable application installée sur
Android/iPhone. Non prioritaire au lancement.

## 17. Importation des anciennes données

**Import Excel** — Prendre des fichiers Excel existants et injecter leurs
données dans JUPPLY. Prévu pour les produits, les stocks initiaux et les
anciens historiques d'entrées/sorties.

**Historique existant** — Les anciennes opérations réalisées avant JUPPLY.
*Ex. : Entrées 2024, sorties 2025, inventaires 2025.*

## 18. Dictionnaire officiel des termes JUPPLY

Pour éviter que chacun utilise son propre vocabulaire, voici la liste
normalisée des termes à utiliser partout dans l'application et la
documentation.

| Terme officiel JUPPLY | Signification |
|---|---|
| Produit | Article géré par le système |
| Référence | Identifiant du produit |
| Désignation | Nom du produit |
| Catégorie | Groupe auquel appartient le produit |
| Type de produit | Consommable, Outillage ou Rotable |
| Entrepôt | Lieu physique de stockage |
| Zone | Partie d'un entrepôt |
| Emplacement | Position précise dans l'entrepôt |
| Quarantaine | Emplacement réservé aux produits non disponibles |
| Stock physique | Quantité réellement comptée |
| Stock théorique | Quantité calculée par le système |
| Stock disponible | Quantité réellement utilisable |
| Stock en transit | Quantité expédiée mais pas encore reçue |
| Mouvement | Toute opération modifiant le stock |
| Entrée (IN) | Augmentation du stock |
| Sortie (OUT) | Diminution du stock |
| Transfert | Déplacement entre deux entrepôts |
| Inventaire | Vérification physique du stock |
| Écart | Différence entre système et réalité |
| Ajustement | Correction officielle du stock |
| Lot | Groupe de produits identifié ensemble |
| Numéro de série | Identifiant unique d'une unité |
| Variante | Version différente d'un produit |
| Équivalent | Autre produit considéré comme substituable |
| PO | Bon de commande fournisseur (module Achats, V2) |
| BL | Bon de livraison |
| Réception | Enregistrement d'une marchandise reçue |
| Réception partielle | Réception de moins que prévu |
| Produit non conforme | Produit ne répondant pas aux exigences |
| Affectation | Attribution d'un outillage |
| Retour | Retour d'un outillage affecté |
| En transit | Expédié mais pas encore réceptionné |
| Validation | Confirmation d'une opération |
| Annulation | Invalidation d'une opération sans effacer son historique |
| Traçabilité | Capacité à savoir qui a fait quoi et quand |
| Alerte | Signalement d'une situation à surveiller |
| Jours de couverture de stock | Nombre de jours estimé avant rupture |
| Dashboard | Tableau de bord synthétique |
| MVP | Première version minimale réellement utilisable |
| Permission | Droit d'effectuer une action |
| Privilège | Droit supplémentaire accordé à un utilisateur |
| Rôle | Fonction d'un utilisateur dans le système |
| Magasinier | Rôle chargé de la saisie des entrées/sorties (anciennement « Gestionnaire adjoint ») |
| PMP | Prix Moyen Pondéré — méthode de valorisation du stock retenue pour JUPPLY |
