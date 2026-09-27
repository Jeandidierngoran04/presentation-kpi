# /prime

> Commande pour démarrer une nouvelle session avec contexte complet.

---

## Mission

Quand je lance `/prime` au début d'une session, exécute la séquence suivante :

### Étape 1 : Charger le contexte

Lis dans cet ordre, en intégralité :
1. `jarvis-starter-kit/CLAUDE.md` (le fichier racine du Jarvis)
2. `jarvis-starter-kit/context/CONTEXT.md` (mon contexte personnel et professionnel)
3. `jarvis-starter-kit/context/HISTORY.md` (l'historique de mes sessions précédentes)
4. `jupply-software-main/HISTORY.md` et `jupply-software-main/PLAN.md` (l'état d'avancement du produit Jupply ; ne lis jamais `HISTORY_ARCHIVE.md` sauf si je le demande)

### Étape 2 : Résumer ta compréhension

Présente-moi un résumé clair et synthétique en suivant cette structure :

```
Bonjour [Prénom], j'ai bien chargé ton contexte. Voici où on en est :

**Qui tu es**
- [Synthèse en 2-3 lignes du profil]

**Tes objectifs court terme**
- [Top 3 des objectifs en cours]

**Tes projets actifs**
- [Liste des projets en cours]

**Où en est Jupply**
- [Chantier en cours dans PLAN.md et dernières entrées de HISTORY.md]

**Dernière session**
- [Si HISTORY.md contient une entrée récente, la résumer]

Je suis prêt à t'aider. Que veux-tu faire aujourd'hui ?
```

### Étape 3 : Attendre les instructions

Ne lance aucune action de toi-même. Attends que je te donne le sujet de la session.

---

## Règles importantes

- Si certains fichiers sont vides ou incomplets, signale-le et propose de les remplir
- Si tu détectes une incohérence entre les fichiers, signale-le calmement
- Ne fais pas de suppositions sur ce qu'on doit faire aujourd'hui, attends mes instructions
- Le résumé doit être en français et utiliser le tutoiement
- Pas de tirets longs (em dashes) dans tes réponses
