# Prototype — Tableau de bord Jupply Software

**Date :** 14/08/2026
**Source :** projet Claude Design "Jupply Software Design" (fichier `Jupply Software v2.dc.html`), importé et implémenté en local

## Ce que c'est

Une page web autonome et fonctionnelle qui reprend fidèlement l'écran de tableau de bord conçu dans Claude Design : KPI (chiffre d'affaires, valeur du stock, commandes, ruptures), pipeline des commandes par statut, table des commandes, achats fournisseurs, activité récente, rotation des stocks, péremptions proches, top commerciaux.

- `index.html` : la page (structure + style repris du design)
- `support.js` : le moteur qui interprète le template et charge React/Babel automatiquement depuis un CDN au chargement de la page — **une connexion internet est nécessaire pour l'affichage**

## Comment l'ouvrir

Double-cliquer sur `index.html` ne suffit pas forcément selon le navigateur (restrictions locales) — le plus fiable est de servir le dossier :

```
cd "Livrables/Gestion des stocks/2026-08-14_prototype-dashboard-jupply"
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080/index.html` dans le navigateur.

## État actuel — important

- **Seul le tableau de bord est implémenté.** Les icônes de navigation à gauche (Ventes, Articles, Mouvements, Achats, Fournisseurs) changent le titre en haut mais n'affichent pas encore de contenu — ces écrans n'existaient pas dans le fichier de design importé, donc rien à implémenter pour l'instant. Il faudra les concevoir dans Claude Design puis les réimporter.
- **Données affichées = données fictives** (ULTIUM, K. Mansouri, montants d'exemple) codées en dur dans la page, à connecter plus tard à de vraies données.
- Vérifié : la page s'affiche correctement et sans erreur JavaScript (testé avec Playwright/Chromium).

## Prochaine étape suggérée

Concevoir les écrans suivants dans Claude Design (voir la liste complète dans `../2026-08-13_cahier-des-charges-phase1/prompt-claude-design.md`), notamment : liste/création de commande de vente et fiche article en stock, puis les importer et les implémenter de la même façon.
