# /nouveau-pc

À lancer sur un ordinateur fraîchement configuré (ou une seule fois sur ce PC). Peut être relancée sans risque : si tout est déjà en ordre, elle le constate et ne casse rien.

Avant cette commande, l'utilisateur a fait à la main les gestes impossibles à automatiser (voir `jarvis-starter-kit/NOUVEAU-PC.md`) : récupérer le dossier `PROJET SOFTWARE` (OneDrive synchronisé, ou téléchargé depuis GitHub), installer VS Code et l'extension Claude Code avec le même compte Claude, ouvrir le dossier `PROJET SOFTWARE` dans VS Code.

Le Jarvis est sauvegardé à deux endroits :
- **GitHub** (dépôt privé `Jeandidierngoran04/Projet-Didier-Tety`), à chaque `/commit` ;
- **OneDrive** (`OneDrive\Documents\PROJET SOFTWARE`), en continu.

La mémoire longue durée de Claude est dans `jarvis-starter-kit/memoire/`, à l'intérieur du dépôt.

## Étape 1 : Vérifier les prérequis

1. Détecte le système (Windows ou macOS).
2. **Git** : `git --version`. S'il manque, installe-le (Windows : `winget install --id Git.Git --source winget --silent --accept-package-agreements --accept-source-agreements` ; Mac : `xcode-select --install`). Si l'installation n'est pas possible, dis : « Installe Git (git-scm.com sur Windows), puis retape /nouveau-pc », et arrête-toi.
3. **Dépôt** : vérifie que le dossier courant est bien le dépôt (`git remote -v` montre `Projet-Didier-Tety`) et qu'il contient `jarvis-starter-kit/memoire/MEMORY.md`.
   - Si le dossier vient de OneDrive et que `memoire` manque : la synchronisation n'est peut-être pas finie. Dis-lui d'attendre et de retaper `/nouveau-pc`, puis arrête-toi.
   - Si le dépôt est en retard sur GitHub (`git fetch` puis `git status`), propose `git pull` avant de continuer.

## Étape 2 : Trouver le dossier mémoire local de Claude Code

Claude Code range sa mémoire dans `~/.claude/projects/<chemin du dossier, caractères spéciaux remplacés par des tirets>/memory` (Windows : `%USERPROFILE%\.claude\projects\...`).
Repère dans `~/.claude/projects/` le dossier qui correspond exactement au dossier courant (son nom se termine par `-PROJET-SOFTWARE`). Le dossier mémoire est son sous-dossier `memory`.

## Étape 3 : Relier la mémoire au dépôt

Cible du lien : `<dossier courant>/jarvis-starter-kit/memoire`.

1. Si `memory` est **déjà un lien** vers cette cible, ne touche à rien et passe à l'étape 4.
   - Windows : `(Get-Item <memory>).LinkType` renvoie `Junction` et `.Target` pointe vers la cible.
   - Mac : `readlink <memory>` renvoie la cible.
2. Si `memory` existe et **contient des fichiers** : copie dans `memoire` ceux qui n'y sont pas encore (en cas de doublon de nom, garde les deux en renommant la copie ; si `MEMORY.md` existe des deux côtés, fusionne leurs lignes d'index). Vérifie la copie, puis **demande l'accord** avant de supprimer le dossier local `memory`.
3. Crée le lien (sans droits administrateur) :
   - **Windows (PowerShell)** : `New-Item -ItemType Junction -Path "<memory>" -Target "<cible>"`
   - **Mac (Terminal)** : `ln -s "<cible>" "<memory>"`
4. Vérifie que le nombre de fichiers vu dans `memory` est égal à celui de `memoire`.

Si une action est bloquée par le mode d'autorisation de Claude Code (modification de `.claude` jugée sensible), explique pourquoi et demande l'accord. Ne cherche pas à contourner le blocage.

## Étape 4 : Outils de Jupply (si l'ordinateur sert à développer)

1. **Node.js** : `node --version`. S'il manque : `winget install --id OpenJS.NodeJS.LTS --source winget --silent --accept-package-agreements --accept-source-agreements` (Mac : nodejs.org).
2. **Dépendances** : dans `jupply-software-main/app-src`, lance `npm install` (le dossier `node_modules` n'est pas sur GitHub).
3. **Clés Supabase** : le fichier `jupply-software-main/app-src/.env.local` n'est **jamais** sur GitHub. S'il manque (dépôt téléchargé depuis GitHub), demande à l'utilisateur de le récupérer depuis OneDrive ou depuis son tableau de bord Supabase. Ne l'invente pas.

## Étape 5 : Python (facultatif)

Si `context/CONTEXT.md` mentionne Excel, PDF ou Word : vérifie Python (Windows : `"%LOCALAPPDATA%\Programs\Python\Python313\python.exe" --version`, attention au faux `python` du Microsoft Store), sinon installe-le (`winget install --id Python.Python.3.13 --source winget --scope user --silent --accept-package-agreements --accept-source-agreements` ; Mac : python.org), puis les modules `pandas openpyxl pypdf pdfplumber python-docx python-pptx matplotlib reportlab`. Pas bloquant. Sur le PC d'origine, `pandas` est bloqué par le contrôle intelligent des applications de Windows : ce n'est pas grave, `openpyxl` suffit pour Excel.

## Étape 6 : Confirmer

Lis `jarvis-starter-kit/CLAUDE.md`, `jarvis-starter-kit/context/CONTEXT.md` et `jarvis-starter-kit/context/HISTORY.md`, puis présente le même résumé que `/prime`. Termine par une phrase : prérequis vérifiés, mémoire reliée (nombre de fichiers), outils Jupply (prêts ou non), Python (prêt ou non), contexte chargé.

## Règles

- Ne jamais supprimer un dossier mémoire qui contient des fichiers sans copie vérifiée et sans accord explicite.
- Ne jamais mettre `.env.local` ni aucune clé sur GitHub.
- Français, phrases simples, tutoiement, pas de tirets longs.
