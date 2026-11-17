# /commit

> Commande pour sauvegarder l'état actuel du projet dans Git, puis l'envoyer sur GitHub.



## Mission

Quand je lance `/commit`, exécute la séquence suivante à la racine de `Appli Présentation` (le dépôt contient l'application Présentation KPI et le Jarvis ; Jupply vit dans son propre dossier, hors de ce dépôt).

Le dépôt GitHub de ce projet est le dépôt **privé** `presentation-kpi` (remote `origin`), le seul remote. Ne jamais ajouter ni pousser vers le dépôt de Jupply.

Lancer `/commit` vaut demande explicite d'envoyer sur GitHub : après le commit, pousse sur `origin` (étape 5).

### Étape 1 : État des lieux

En parallèle :
1. `git status` pour voir les fichiers modifiés / non suivis
2. `git diff --stat` pour voir l'ampleur des changements
3. `git log --oneline -5` pour rester cohérent avec le style des messages précédents
4. `git log --oneline origin/main..main` pour repérer d'éventuels commits locaux pas encore envoyés

S'il n'y a rien à commiter **et** rien à pousser, dis-le moi simplement et arrête-toi là. Ne crée jamais de commit vide. S'il n'y a rien à commiter mais des commits en attente, passe directement à l'étape 5.

### Étape 2 : Vérifications avant d'enregistrer

1. **Aucun secret** : vérifie que `.env` (et toute variante contenant de vraies clés) n'apparaît pas dans les fichiers à commiter. Si un fichier suspect apparaît (nom évoquant des identifiants, clés, mots de passe), préviens-moi avant de continuer plutôt que de le stager automatiquement.
2. **Pas de fichiers lourds ou générés** : `node_modules/`, `dist/` et `*.tsbuildinfo` ne doivent jamais partir (ils sont dans `presentation-kpi/.gitignore`).
3. **L'application compile** : si des fichiers de `presentation-kpi/src` ont changé, lance `npx tsc -b` dans `presentation-kpi`. En cas d'erreur, montre-la-moi et demande-moi si on commit quand même.

### Étape 3 : Proposer le commit

Résume en une ou deux phrases ce qui a changé et propose un message de commit clair (pourquoi plutôt que quoi, en français, sans tirets longs, dans le style des messages précédents). Présente-le moi :

```
Voici ce que je vais enregistrer :
- [fichier 1]
- [fichier 2]
...

Message proposé :
"[message]"

Je lance l'enregistrement et l'envoi sur GitHub ?
```

### Étape 4 : Enregistrer

Une fois validé :
1. `git add` sur les fichiers concernés (jamais `git add -A` aveugle si des fichiers suspects ont été détectés à l'étape 2)
2. `git commit` avec le message validé
3. `git status` pour confirmer que tout est propre

### Étape 5 : Envoyer sur GitHub

1. `git push origin main`
2. Si l'envoi est refusé par une autorisation de Claude Code, ne contourne rien : dis-moi que tout est enregistré sur le PC et donne-moi la commande à taper moi-même dans le terminal de VS Code : `git push origin main`.
3. Si GitHub refuse l'envoi (historique différent), ne force jamais : explique-moi la situation et attends ma décision.

### Étape 6 : Confirmer

```
C'est sauvegardé et envoyé sur GitHub. Commit [hash court] : "[message]"
```

(ou, si l'envoi n'a pas pu se faire : « C'est sauvegardé sur ton PC. Pour l'envoyer sur GitHub : git push origin main »)



## Règles importantes

- Ne jamais commiter `.env` ou un fichier contenant de vraies clés/secrets
- Ne jamais pousser vers le dépôt de Jupply
- Ne jamais utiliser `git push --force`, `git reset --hard`, `git checkout --`, ou toute commande destructive sans demande explicite
- Ne jamais passer `--no-verify` ou sauter les hooks
- Toujours demander validation du message avant de commiter, sauf si je dis explicitement « vas-y sans me demander »
- Communication en français systématique, pas de tirets longs (em dashes)
