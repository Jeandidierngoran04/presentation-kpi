# Prototype — Page de connexion Jupply Software

**Date :** 14/08/2026
**Source :** projet Claude Design "Jupply Software homepage design" (fichier `Jupply Login.dc.html`)

## Ce que c'est

La page de connexion (« Se connecter ») : carte e-mail + mot de passe (avec affichage/masquage du mot de passe), et un pied de page complet façon Odoo (colonnes Produit/Ressources/Entreprise, réseaux sociaux, sélecteur de langue FR/EN), cohérente avec la page d'accueil déjà construite.

- `index.html` : la page
- `support.js` : moteur d'interprétation (identique aux autres prototypes)
- `uploads/Symbole-6d86a454.jpg` : le logo (renommé avec l'extension `.jpg` pour un affichage fiable une fois servi en statique)

## Comment l'ouvrir

```
cd "Livrables/Gestion des stocks/2026-08-14_prototype-page-connexion"
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080/index.html`.

## État

Formulaire visuel uniquement — aucune vraie authentification pour l'instant (le bouton « Se connecter » ne fait rien, c'est normal à ce stade).
