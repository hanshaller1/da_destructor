@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 oder neuer wird benoetigt. Bitte Node.js installieren.
  pause
  exit /b 1
)
echo DA DESTRUCTOR - http://127.0.0.1:4173
echo START AUDIO im Browser startet den Klang. Dieses Fenster geoeffnet lassen.
start "" "http://127.0.0.1:4173"
node server.mjs
pause
