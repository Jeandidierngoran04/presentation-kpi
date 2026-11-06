# Changer d'ordinateur sans rien perdre

Tout ton Jarvis et ton projet Jupply sont sauvegardés à deux endroits :

- **GitHub** (dépôt privé `Projet-Didier-Tety`) : à chaque `/commit` ;
- **OneDrive** (`OneDrive\Documents\PROJET SOFTWARE`) : en continu.

La mémoire de Claude est dans `jarvis-starter-kit/memoire/`, elle voyage avec le reste.

Sur un nouvel ordinateur, fais ces gestes à la main, puis Claude fait le reste.

## 1. Récupérer ton dossier

**Le plus simple : OneDrive.**
- Installe OneDrive et connecte-toi avec **le même compte**
- Laisse la synchronisation se terminer complètement
- Vérifie que `Documents\PROJET SOFTWARE` est bien réapparu

**Sinon, depuis GitHub** (si OneDrive n'est pas disponible) :
- Installe Git : git-scm.com (options par défaut)
- Dans un terminal : `git clone https://github.com/Jeandidierngoran04/Projet-Didier-Tety.git "PROJET SOFTWARE"`
- Attention : le fichier des clés Supabase (`jupply-software-main/app-src/.env.local`) n'est **pas** sur GitHub. Récupère-le depuis OneDrive ou depuis ton tableau de bord Supabase.

## 2. VS Code et Claude Code
- Installe VS Code : code.visualstudio.com
- Onglet Extensions : installe **Claude Code** (éditeur : Anthropic)
- Connecte-toi avec ton compte Claude habituel

## 3. Ouvrir ton dossier
- VS Code : Fichier › Ouvrir un dossier › choisis `PROJET SOFTWARE`

## Ensuite
Ouvre Claude Code et tape :

    /nouveau-pc

Claude vérifie ce qui manque, relie sa mémoire, réinstalle les outils de Jupply et te montre un résumé pour prouver qu'il te reconnaît. Tu peux la relancer sans risque.

## Au quotidien
- `/prime` en début de session : Claude recharge ton contexte
- `/update` en fin de session : Claude note ce qu'on a fait
- `/commit` : sauvegarde sur GitHub
