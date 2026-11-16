@echo off
title Presentation KPI - Application (local)
cd /d "%~dp0"

if not exist node_modules (
  echo Installation des dependances, premiere fois seulement...
  call npm install
)

echo Demarrage de l'application...
start "Serveur Presentation KPI (ne pas fermer)" /min cmd /c "npm run dev -- --port 5180 --strictPort"

timeout /t 4 /nobreak >nul

start "" http://localhost:5180

echo.
echo L'application est ouverte dans votre navigateur : http://localhost:5180
echo Pour arreter, fermez la fenetre "Serveur Presentation KPI".
echo.
pause
