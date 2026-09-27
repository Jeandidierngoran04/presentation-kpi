# Livrables

Ce dossier contient tout ce que Claude produit pour Jean Didier : sites web, applications, contenus Youtube, et les livrables des deux projets d'applications de gestion supply chain.

## La règle d'or

- **Inputs** (documents fournis par Jean Didier : cahiers des charges, exports, captures, notes) → `context/import/`
- **Outputs** (ce que Claude produit : code, maquettes, scripts, briefs, documents finaux) → `Livrables/`

Ne jamais mélanger les deux. Un fichier qui arrive de l'extérieur va dans `context/import/`. Un fichier que Claude crée ou génère va dans `Livrables/`.

## Organisation

| Dossier | Contenu |
|---|---|
| `Sites-web/` | Sites internet (vitrines, landing pages, etc.) |
| `Applications/` | Outils, scripts, automatisations |
| `Youtube/` | Briefs vidéo, scripts, hooks, calendrier éditorial |
| `Gestion des stocks/` | Livrables pour l'application web de gestion des stocks |
| `Gestion Transport/` | Livrables pour l'application web de gestion du transport |

## Convention de nommage des projets

Chaque projet vit dans son propre sous-dossier, nommé ainsi :

```
AAAA-MM-JJ_nom-du-projet/
```

- `AAAA-MM-JJ` : date de création du projet (facilite le tri chronologique)
- `nom-du-projet` : nom court en minuscules, mots séparés par des tirets

Exemples :
- `Livrables/Sites-web/2026-08-13_vitrine-erp-jarvis/`
- `Livrables/Gestion des stocks/2026-08-13_mvp-stock-app/`
- `Livrables/Youtube/2026-08-13_serie-supply-chain/`

À l'intérieur d'un projet, organiser librement selon son type (code, docs, assets...), mais garder un `README.md` à la racine du projet qui résume son objectif et son statut.
