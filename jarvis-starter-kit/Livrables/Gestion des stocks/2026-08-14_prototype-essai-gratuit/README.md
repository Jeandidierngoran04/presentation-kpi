# Prototype — Page « Essai gratuit » Jupply Software

**Date :** 14/08/2026
**Source :** projet Claude Design "Jupply Software homepage design" (fichier `Jupply Free Trial.dc.html`)

## Ce que c'est

La page d'inscription à l'essai gratuit, inspirée de la mise en page Dynamics 365 (argumentaire à gauche, formulaire à droite), avec l'identité Jupply et le même pied de page que la page de connexion et la page d'accueil.

- `index.html` : la page
- `support.js` : moteur d'interprétation (identique aux autres prototypes)
- `uploads/Symbole-6d86a454.jpg` : logo (réutilisé depuis le prototype de la page de connexion, renommé avec l'extension `.jpg`)

## Comment l'ouvrir

```
cd "Livrables/Gestion des stocks/2026-08-14_prototype-essai-gratuit"
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080/index.html`.

## État

- Le bouton « Commencer votre essai gratuit » reste désactivé tant que la case d'acceptation des conditions n'est pas cochée (comportement voulu, reproduit du design)
- Aucune vraie inscription n'est faite pour l'instant, formulaire visuel uniquement
- **Politique d'essai confirmée :** 60 jours, aucune carte bancaire requise
