---
name: erreurs-disparaissent-une-fois-corrigees
description: Jupply rule for every screen - a red error message or highlight must vanish as soon as the user fixes the problem
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9534f059-acaa-4417-8594-deed785807cf
  modified: 2026-10-30T07:37:06.496Z
---

Règle demandée par Jean Didier pour toute l'application (tous les onglets, pages, fenêtres) : une erreur est signalée en rouge, et **dès que l'utilisateur la corrige, le rouge et le message disparaissent**. Un message qui reste affiché après correction est un défaut.

**Why:** il l'a constaté plusieurs fois (bandeau « Reçu par » ou « quantité manquante » resté affiché après correction) ; l'écran doit refléter l'état réel.

**How to apply:** utiliser `components/ui/BandeauErreur.tsx` pour tout bandeau d'erreur (se masque à la première saisie, revient si l'action est relancée) ; calculer en continu les messages de validation et les cases rouges à partir de l'état (pas un `setErreur` figé) ; le compteur « n à corriger » diminue jusqu'à disparaître. Voir aussi [[interface-sans-explication]].
