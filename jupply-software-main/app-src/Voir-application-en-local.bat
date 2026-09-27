@echo off
title Jupply Software - Application (local)
cd /d "%~dp0"

if not exist node_modules (
  echo Installation des dependances, premiere fois seulement...
  call npm install
)

echo Demarrage de l'application...
start "Serveur app Jupply (ne pas fermer)" /min cmd /c "npm run dev"

timeout /t 4 /nobreak >nul

start "" http://localhost:5173

echo.
echo L'application est ouverte dans votre navigateur : http://localhost:5173
echo.
echo Pour arreter le serveur, fermez la fenetre "Serveur app Jupply".
echo Vous pouvez fermer cette fenetre-ci sans probleme.
echo.
pause
