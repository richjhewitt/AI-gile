@echo off
rem Starts AI-gile (if not already running) and opens it in the browser.
cd /d "%~dp0"
rem Another port: set AIGILE_PORT before starting (default 4321).
if not defined AIGILE_PORT set AIGILE_PORT=4321
curl -s -o nul http://localhost:%AIGILE_PORT%/api/meta && goto open
where node >nul 2>nul || (echo Node.js was not found. Install the LTS version from https://nodejs.org, then run this again. & pause & exit /b 1)
rem AIGILE_DEV=1 shows a "refresh" prompt after each new build; remove once development settles.
set AIGILE_DEV=1
start "AI-gile server" /min node server.js
timeout /t 1 /nobreak >nul
:open
start "" http://localhost:%AIGILE_PORT%
