# Jupply Software

SaaS de gestion des stocks, ventes et approvisionnements pour PME et commerces — alternative à coût réduit aux ERP classiques (Odoo, SAP, Microsoft Dynamics).

## Structure

- `index.html` — page d'accueil publique (site vitrine), à la racine pour un déploiement Netlify direct
- `connexion/index.html` — page de connexion (Se connecter), maquette visuelle
- `essai-gratuit/index.html` — page d'inscription à l'essai gratuit (60 jours, sans carte bancaire), maquette visuelle
- `support.js` — moteur d'interprétation des pages vitrine (charge React/Babel via CDN au chargement), dupliqué dans chaque dossier de page vitrine
- `app-src/` — application réelle (React + Vite + TypeScript + Supabase), construite module par module. Voir `app-src/README.md`.
- `PLAN.md` / `PLAN_ARCHIVE.md` / `HISTORY.md` / `HISTORY_ARCHIVE.md` — processus de suivi des chantiers, voir `CLAUDE.md`.

## État actuel

Le site vitrine (accueil, connexion, essai gratuit) reste une maquette visuelle pour l'instant. L'effort porte maintenant sur `app-src/`, la vraie application, en commençant par le module Gestion des Stocks (Dashboard) avec une base de données Supabase réelle et une isolation des données par entreprise.

## Déploiement

Site vitrine prévu via Netlify, connecté à ce dépôt GitHub (déploiement en pause, quota gratuit atteint). Le déploiement de `app-src/` sera défini une fois le module Stock validé.
