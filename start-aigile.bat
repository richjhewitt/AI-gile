@echo off
rem Starts AI-gile (if not already running) and opens it in the browser.
cd /d "%~dp0"
curl -s -o nul http://localhost:4321/api/meta && goto open
start "AI-gile server" /min node server.js
timeout /t 1 /nobreak >nul
:open
start "" http://localhost:4321
