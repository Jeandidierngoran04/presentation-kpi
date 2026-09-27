# /commit

> Commande pour sauvegarder l'état actuel du workspace dans Git.



## Mission

Quand je lance `/commit`, exécute la séquence suivante à la racine de `PROJET SOFTWARE` (un seul dépôt Git regroupe Jarvis et Jupply). Après le commit, envoie-le sur GitHub avec `git push` pour mettre la sauvegarde à l'abri : c'est la seule exception à la règle sur `git push` ci-dessous.

### Étape 1 : État des lieux

En parallèle :
1. `git status` pour voir les fichiers modifiés / non suivis
2. `git diff` pour voir les changements non stagés
3. `git log --oneline -10` pour rester cohérent avec le style des messages précédents

Si rien n'a changé (aucun fichier modifié ou non suivi), dis-le moi simplement et arrête-toi là. Ne crée jamais de commit vide.

### Étape 2 : Vérifier qu'aucun secret ne part

Avant de stager quoi que ce soit, vérifie que `.env` (et toute variante contenant de vraies clés) n'apparaît pas dans les fichiers à commiter. Si un fichier suspect apparaît (nom évoquant des identifiants, clés, mots de passe), préviens-moi avant de continuer plutôt que de le stager automatiquement.

### Étape 3 : Proposer le commit

Résume en une ou deux phrases ce qui a changé et propose un message de commit clair (pourquoi plutôt que quoi, en français, sans tirets longs). Présente-le moi :

```
Voici ce que je vais commiter :
- [fichier 1]
- [fichier 2]
...

Message proposé :
"[message]"

Je lance le commit ?
```

### Étape 4 : Exécuter

Une fois validé :
1. `git add` sur les fichiers concernés (jamais `git add -A` aveugle si des fichiers suspects ont été détectés à l'étape 2)
2. `git commit -m "..."` avec le message validé
3. `git status` pour confirmer que tout est propre

### Étape 5 : Confirmer

```
C'est sauvegardé. Commit [hash court] : "[message]"
```



## Règles importantes

- Ne jamais commiter `.env` ou un fichier contenant de vraies clés/secrets
- Ne jamais utiliser `git push --force`, `git reset --hard`, `git checkout --`, ou toute commande destructive sans demande explicite
- Ne jamais passer `--no-verify` ou sauter les hooks
- Toujours demander validation du message avant de commiter, sauf si je dis explicitement "vas-y sans me demander"
- Communication en français systématique, pas de tirets longs (em dashes)
