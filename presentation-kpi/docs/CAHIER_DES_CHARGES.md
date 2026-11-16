# Cahier des charges : Application de présentation KPI

> Version 0.1 du 14/11/2026, à valider par Jean Didier.
> Nom de travail : **Présentation KPI**.

---

## 1. Objectif

Préparer et projeter en quelques clics les réunions de pilotage Supply Chain multi-pays :

- **Réunion hebdo** avec les collaborateurs.
- **Réunion mensuelle** avec le directeur, avec un contenu différent du hebdo.

L'application lit automatiquement les chiffres dans Google Sheets, produit des visuels qui comparent les pays et les périodes, et propose un **mode diaporama** plein écran, utilisable en présentiel (vidéoprojecteur) comme en ligne (partage d'écran).

Elle **garde l'historique** de chaque présentation : une présentation passée reste consultable telle qu'elle a été montrée, même si le fichier change ensuite.

---

## 2. Principes

1. **Aucune ressaisie** : les chiffres viennent du Google Sheet, l'application ne fait que les lire.
2. **Ouvert** : n'importe quel pays du monde, n'importe quelle agence, et de nouveaux indicateurs peuvent être ajoutés sans modifier l'application.
3. **Lisible en 3 secondes** : un gros chiffre, une couleur de statut, une tendance. Les détails viennent ensuite.
4. **Beau et cohérent** : une seule charte, les mêmes couleurs de statut partout, les drapeaux des pays.

---

## 3. Sources de données

### 3.1 Google Sheet « Data KPI West Africa »
Il reste la source unique. On y ajoute **un onglet « Données app »** au format liste, alimenté par des formules à partir des onglets existants. Les onglets actuels ne changent pas.

| Colonne | Exemple | Rôle |
|---|---|---|
| Période | 02/11/2026 | Lundi de la semaine, ou 1er jour du mois |
| Type | Semaine / Mois | Rythme de la donnée |
| Pays | Côte d'Ivoire | |
| Agence | Abidjan - Angré | Vide si la donnée est nationale |
| Indicateur | OTD | Doit exister dans le catalogue (section 5) |
| Valeur | 98,8 | Nombre seul, sans texte ni % |
| Cible | 100 | Optionnel. Si vide, on prend la cible du catalogue |

Avec ce format, une nouvelle semaine s'ajoute en nouvelles lignes, et l'historique se garde naturellement.

### 3.2 Google Sheet « Réclamations qualité »
Il s'agit du fichier que Jean Didier va créer. Une ligne par réclamation : date, pays, agence, nature, statut.
L'application compte et regroupe elle-même les réclamations par pays, mois, semaine, agence et nature.

### 3.3 Connexion (v0.5 : feuille « Donnée » uniquement)
- Source unique : la feuille **« Donnée »** (une ligne par KPI, 2 colonnes par pays : Couverture / Stock), alimentée par les imports de Jean Didier. **Aucune saisie, aucun onglet supplémentaire** (« Données app » abandonné).
- « KPI OTD » sert seulement à dater OTD S1, S2, S3 ; « Point mensuel » fournit l'OTD mensuel.
- Script Apps Script v3 ([apps-script/Code.gs](../apps-script/Code.gs)) : renvoie le contenu de ces feuilles tel qu'il s'affiche, n'écrit rien. La lecture est faite par l'application ([src/lib/feuilleDonnee.ts](../src/lib/feuilleDonnee.ts)).
- Les KPI hors OTD sont rattachés à la dernière semaine OTD remplie et au dernier mois de « Point mensuel ».
- Historique : conservé par la **clôture** des présentations (photo figée), pas dans le Sheet.
- Tant que le Sheet n'est pas connecté (ou qu'un ancien script répond), l'application utilise une copie de « Donnée » du 15/11/2026.
- TOP = 100 %, FLOP = 0 %, N/A = pas de donnée. Problèmes récurrents (DL = délai de livraison…) : saisis dans l'application.

---

## 4. Historique des présentations

- Chaque présentation (hebdo ou mensuelle) est enregistrée avec ses réglages : période, pays et indicateurs.
- Bouton **« Clôturer »** après la réunion : l'application fige une photo des chiffres. La présentation reste ensuite identique pour toujours.
- Tant qu'elle n'est pas clôturée, la présentation se met à jour en direct depuis le Sheet.
- L'écran d'accueil liste les présentations passées, classées par date, avec un filtre Hebdo / Mensuel.

---

## 5. Catalogue des indicateurs (réunion hebdo)

| Famille | Indicateur | Unité | Cible | Meilleur si | Remarque |
|---|---|---|---|---|---|
| **Livraison client** | OTD (On-Time Delivery) | % | 100 % | ↑ | Comparaison des semaines choisies, WoW |
| **Stock** | Montures (Standard) | modèles présents / cible | ex. 150 | ↑ | Jauge **avec les nombres affichés** : 158 / 150 |
| | Lapaire + | modèles présents / cible | ex. 25 | ↑ | Ex. 17 / 25 |
| | Solaires | modèles présents / cible | ex. 30 | ↑ | |
| | Etuis, Etuis+, Sacs cabas, Sprays, Pochettes | stock + couverture (mois) | > 1 mois | ↑ | Couverture calculée dans le Sheet. **Alerte rouge dès 1 mois ou moins** |
| **Production** | Affaires non assemblées | nombre | 0 ? | ↓ | |
| | Productivité | % | 100 % | ↑ | |
| | Casse atelier | ‰ (pour 1 000 montages) | à définir | ↓ | |
| | Qualité de montage | à préciser | à définir | ↓ ? | |
| **Livreurs** | Respect des tournées | % | 100 % | ↑ | Remplace TOP / FLOP |
| | Conduite et entretien moto | % | 100 % | ↑ | |
| | Communication | % | 100 % | ↑ | |
| **Qualité** | Réclamations | nombre | à définir | ↓ | Par pays, agence et nature |

**Cibles réglables** : toutes les cibles et seuils d'alerte sont choisis par l'utilisateur dans un écran « Cibles ». Les valeurs du tableau ne sont que des valeurs de départ.

**Statut couleur** (identique partout) :
- 🟢 **Vert** : cible atteinte.
- 🟠 **Orange** : proche de la cible (seuil à définir par indicateur, 95 % par défaut).
- 🔴 **Rouge** : alerte.

## 6. Réunion mensuelle (directeur)

Mêmes indicateurs que le hebdo, avec les **données du mois** (comparaison MoM), plus une page **Problèmes récurrents** (DL, réclamations…). **Design distinct** : thème aubergine et violet, bandeau latéral, page de garde claire avec le mois en très grand.

---

## 7. Expérience utilisateur (UX/UI)

### 7.1 Écrans
1. **Accueil** : deux grandes cartes, « Nouvelle présentation hebdo » et « Nouvelle présentation mensuelle », puis l'historique en dessous.
2. **Préparation** (3 étapes sur un seul écran) :
   - **Période** : choix des semaines à comparer (ex. 19/10 et 26/10/2026) ou des mois.
   - **Pays** : recherche dans la liste mondiale avec drapeaux, puis sélection en pastilles.
   - **Indicateurs** : cases par famille, toutes cochées par défaut.
   - Un aperçu des diapos s'affiche en direct à droite.
3. **Tableau de bord** : toute la présentation sur une page, à faire défiler, pour préparer la réunion.
4. **Diaporama** : bouton bien visible.

### 7.2 Mode diaporama
- Plein écran au format 16:9, lisible au fond d'une salle comme en visio.
- Navigation avec les flèches du clavier, la barre d'espace, un clic ou un télécommandeur. Touche Échap pour sortir.
- Ordre des diapos :
  1. Page de garde : titre, période, drapeaux des pays.
  2. Synthèse : une carte par famille avec son statut couleur.
  3. Une diapo par indicateur ou par famille.
  4. Points d'attention : liste automatique de tout ce qui est en rouge.
  5. Page de fin.
- Numéro de diapo et barre de progression discrète. Transitions douces.
- **Export PDF** de la présentation, pour l'envoyer après la réunion.

### 7.3 Visuels par indicateur
- **OTD** : barres groupées (semaines × pays), ligne pointillée de la cible à 100 %, flèche et valeur WoW.
- **Stock modèles** : jauge par pays, avec le nombre présent et la cible écrits en gros (ex. **17** / 25, 68 %).
- **Stock consommables** : tableau pays × article avec la couverture colorée.
- **Production** : cartes chiffres avec la tendance.
- **Livreurs** : grille pays × critère avec des pastilles en %.
- **Réclamations** : évolution dans le temps, répartition par nature, classement des agences.

---

## 7 bis. Pages ajoutées (v0.2)

- **Meilleur pays et pays à relever** : score = part des indicateurs atteints (vigilance = ½ point), classement, meilleur pays par semaine ou par mois.
- **Divers et axes d'amélioration** : rédigés dans l'application (texte, pays, responsable, échéance), en dernière page.
- **Semaines visibles** sur chaque diapo (pastille S44 · S45, ou les mois).
- **Export PowerPoint (.pptx) et PDF** pour que la direction garde la présentation (diapos en image, fidèles à l'écran).
- **Collaborateurs en consultation** : accès en lecture seule, prévu avec la mise en ligne (lot 3).

## 7 ter. Saisie, calendrier et cibles par pays (v0.6)

- **Écran Saisie** : saisir ou corriger un chiffre pour une semaine ou un mois choisi dans un calendrier, par rubrique et par pays. Une valeur saisie l'emporte sur celle du Sheet (↺ pour revenir au Sheet).
- **Indicateurs ajoutés** dans l'application (nom, rubrique, unité, sens, cible, alerte). Si la feuille « Donnée » contient une ligne du même nom, ses chiffres sont repris automatiquement. Rubrique « Autres indicateurs » : diapo dédiée.
- **Choix des périodes** : mode **Automatique** (les N dernières semaines ou mois qui ont des chiffres, mise à jour seule) ou **calendrier** (semaines ou mois cliqués). La clôture fige les périodes affichées.
- **Cibles par pays** : chaque indicateur a une cible par défaut et, si besoin, une cible propre à chaque pays (ex. OTD CI 98 %, RDC 90 %). Sur l'OTD, un trait pointillé par pays.
- **Mise en page jusqu'à 6 pays** : au-delà de 3 pays, cartes OTD sous le graphique, tableaux resserrés avec statut en icône, jauges plus petites, classement sur une ligne par pays.

## 7 quater. Deux sources et Paramètres (v0.7)

- **Nouvelle présentation** : choix de la source **Data KPI (Sheet)** ou **Manuel**.
- **Paramètres** (onglets) : **Mes KPI** (créer, dupliquer, supprimer ; un KPI = un ou plusieurs éléments, chacun avec unité, sens, cible, alerte et cibles par pays ; enregistrés et réutilisables), **Réalisations** (saisie par période via calendrier, KPI et pays), **Cibles (Sheet)**, **Corrections (Sheet)**.
- **Design lisible sans explication** : graphiques à libellés directs (période sous chaque barre, valeur au-dessus, pays et cible sous le groupe), couleur = statut, numérotation « KPI n », phrase « À retenir » calculée, légende des couleurs, diapo « Faits marquants par pays ».

## 8. Technique

- **Interface** : React, TypeScript, Vite, Tailwind et Recharts (la même base que Jupply, réutilisée).
- **Données** : Google Sheets en lecture via Apps Script.
- **Historique et connexion** : Supabase (comptes, présentations enregistrées, photos figées).
- **Hébergement** : en ligne (Vercel ou Netlify), accessible depuis n'importe quel PC.

---

## 9. Étapes de réalisation

| Lot | Contenu | Résultat |
|---|---|---|
| 1 | Maquette cliquable avec les vrais chiffres du Sheet copiés en dur | Valider le design et le diaporama |
| 2 | Onglet « Données app » et connexion au Google Sheet | Les chiffres se mettent à jour seuls |
| 3 | Historique et clôture des présentations | Retrouver les réunions passées |
| 4 | Réunion mensuelle | Le pack directeur |
| 5 | Réclamations qualité | Les analyses par nature et par agence |
| 6 | Export PDF et mise en ligne | Partage après la réunion |

---

## 10. Questions ouvertes

1. ~~Couverture~~ : réglé, en mois, alerte à 1 mois ou moins.
2. ~~Cibles~~ : réglé, choisies par l'utilisateur. Unité de la qualité de montage à préciser.
3. **Contenu mensuel** : quels indicateurs pour la réunion avec le directeur ?
4. **Accès** : uniquement Jean Didier, ou aussi les collaborateurs en lecture seule ?
