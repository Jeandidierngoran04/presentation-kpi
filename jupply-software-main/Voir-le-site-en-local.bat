@echo off
title Jupply Software - Apercu local
cd /d "%~dp0"

echo Demarrage du serveur local...
start "Serveur local Jupply (ne pas fermer)" /min cmd /c "python -m http.server 8080"

timeout /t 2 /nobreak >nul

start "" http://localhost:8080

echo.
echo Le site est ouvert dans votre navigateur : http://localhost:8080
echo.
echo Pour arreter le serveur local, fermez la fenetre "Serveur local Jupply".
echo Vous pouvez fermer cette fenetre-ci sans probleme.
echo.
pause
