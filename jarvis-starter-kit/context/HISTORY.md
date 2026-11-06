# Workspace History

> Journal chronologique de toutes les sessions et décisions importantes.
> Le plus récent en haut. Mis à jour automatiquement par Claude.
>
> **Comment ça marche :** Quand je lance la commande `/update` après une session importante, ou quand je raconte un changement significatif, Claude ajoute une entrée ici automatiquement. Je n'ai pas à écrire ce fichier manuellement.

---

## 2026-11-06

### Sauvegarde du Jarvis et changement d'ordinateur
- Le dossier `PROJET SOFTWARE` est désormais dans OneDrive (`OneDrive\Documents\PROJET SOFTWARE`) ; il reste aussi sur GitHub (dépôt privé vérifié)
- Choix de Jean Didier : sauvegarde par GitHub et OneDrive (pas de clé USB)
- Mémoire de Claude copiée dans `jarvis-starter-kit/memoire/` ; commande `/nouveau-pc` et guide `NOUVEAU-PC.md` créés
- Python 3.13 installé avec les modules documents (Excel, PDF, Word, PowerPoint, graphiques) ; `pandas` bloqué par Windows
- Reste à faire : ouvrir `OneDrive\Documents\PROJET SOFTWARE` dans VS Code et lancer `/nouveau-pc`

## 2026-10-01

### Remise à niveau du contexte (rattrapage depuis le 13/08)
- L'application de gestion des stocks porte désormais le nom **Jupply** et vit dans `jupply-software-main/` (application réelle dans `app-src/` : React, Vite, TypeScript, Tailwind, Supabase)
- La Phase 1 est sortie du cadrage : elle est en construction depuis le 26/08/2026 (refonte du schéma de base selon le cahier des charges)
- Écrans terminés : Entrepôts, Produits, Entrées de stock (Réceptions), Sorties de stock, Réintégrations, coquille applicative
- En attente de vérification locale par Jean Didier : Transferts entre entrepôts, et refonte visuelle complète selon la charte graphique (Light + Dark)
- Charte graphique formalisée le 05/09/2026 (`docs/charte-graphique/CHARTE_GRAPHIQUE.md`), référence visuelle unique du produit
- Le suivi détaillé de Jupply se fait dans `jupply-software-main/HISTORY.md` et `PLAN.md`, ce journal ne garde que les jalons
- CONTEXT.md et CLAUDE.md mis à jour en conséquence (statut de la Phase 1, nom du produit, nom de la skill de veille)

## 2026-08-13

### Cadrage fonctionnel Phase 1 de l'application de gestion des stocks
- Décision stratégique : construction en phases (MVP) plutôt que l'ERP complet d'un coup, pour générer un premier revenu plus vite
- Phase 1 verrouillée : modules Ventes (Commercial), Magasins/Stocks, Approvisionnement (Achats), en SaaS multi-entreprises
- Phase 2+ (roadmap) : Production, Comptabilité, Transport, chat interne, IA
- Cahier des charges fonctionnel détaillé produit et sauvegardé dans `Livrables/Gestion des stocks/`
- Inspiration produit confirmée : Odoo, Microsoft Dynamics, et le logiciel métier AIRSTOCK (référence visuelle pour la gestion des dépôts/emplacements)

### Correction : objectif de chiffre d'affaires
- Confirmation de Jean Didier : l'objectif long terme est bien 100 000 USD de CA sur les 3 premières années (et non 50 000 USD comme indiqué initialement dans CONTEXT.md/HISTORY.md, ce qui était une incohérence avec CLAUDE.md)
- CONTEXT.md corrigé en conséquence

### Installation initiale du Jarvis
- Workspace personnalisé pour Jean Didier, basé à Abidjan
- Profil principal : Mix (logistique professionnelle + études + entrepreneuriat tech), ne code pas lui-même
- Activité : développement d'un projet de progiciel/ERP pour la supply chain (gestion commerciale, stocks, achats, transport, douane), destiné aux PME et multinationales
- Objectifs court terme identifiés : concevoir 2 applications web commercialisables (gestion de stocks/approvisionnements et optimisation du transport) pour générer des revenus finançant l'ERP complet
- Vision long terme : lancer une entreprise de prestation/location d'applications web/mobile pour la supply chain (type Odoo, SAP, Routific), viser 50 000 USD de CA sur 3 ans
- Projets actifs au démarrage : application de gestion des stocks/approvisionnements/commandes ; application d'optimisation et gestion du transport
- Domaine d'aide prioritaire : développement des applications web
- Style de communication choisi : direct et efficace
