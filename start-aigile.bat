@echo off
rem Starts AI-gile (if not already running) and opens it in the browser.
cd /d "%~dp0"
curl -s -o nul http://localhost:4321/api/meta && goto open
rem AIGILE_DEV=1 shows a "refresh" prompt after each new build; remove once development settles.
set AIGILE_DEV=1
start "AI-gile server" /min node server.js
timeout /t 1 /nobreak >nul
:open
start "" http://localhost:4321
