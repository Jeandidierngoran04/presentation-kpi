# Jupply Software — Application

Application réelle (React + Vite + TypeScript + Tailwind CSS + Supabase), construite module par module.
Module actuel : **Gestion des Stocks** (écran Dashboard).

## Mise en route

1. Crée un projet sur [supabase.com](https://supabase.com), récupère **Project URL** et la clé **anon public**
   (Project Settings → API), et colle-les dans `.env.local` :
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
2. Dans l'éditeur SQL de Supabase, exécute `supabase/schema.sql` (tables, sécurité multi-entreprises, vues).
3. Crée ton entreprise et ton compte utilisateur (instructions en bas de `supabase/schema.sql`).
4. Optionnel : exécute `supabase/seed.sql` pour générer des données de démonstration réalistes
   (articles, entrepôts, mouvements de stock).
5. Double-clique sur `Voir-application-en-local.bat` (ou `npm install && npm run dev`).

## Architecture des données

Le schéma (`supabase/schema.sql`) couvre l'intégralité du cahier des charges (voir `docs/CAHIER_DES_CHARGES.md`
et `docs/GLOSSAIRE.md` à la racine du dépôt) : rôles, entrepôts avec quarantaine, produits enrichis,
réceptions, sorties, transferts, inventaires, outillage. La couche d'accès aux données
(`src/lib/api/stock.ts`) interroge directement Supabase via des vues SQL (`v_produits_stock`,
`v_mouvements_recents`, `v_stock_par_entrepot`). La sécurité au niveau ligne (RLS) garantit qu'une
entreprise ne voit jamais les données d'une autre, et qu'un Gestionnaire/Magasinier ne voit que les
entrepôts qui lui sont assignés.

## Ce qui est fonctionnel pour l'instant

Uniquement le **Dashboard** du module Gestion des Stocks (connexion réelle, KPI, alertes, mouvements
récents, stock par catégorie, top articles, stock par entrepôt). Les autres entrées du menu affichent une
page "Fonctionnalité à venir" — elles sont prévues dans la navigation mais pas encore développées.
