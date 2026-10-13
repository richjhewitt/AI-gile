#!/bin/sh
# Puts an "AI-gile" launcher in your applications menu (no sudo). Usage: sh tools/linux/install.sh [path/to/AI-gile.AppImage]
# Without an AppImage the launcher starts the board from this folder (node server.js) and opens it in your browser.
set -e
here=$(cd "$(dirname "$0")/../.." && pwd)
data="${XDG_DATA_HOME:-$HOME/.local/share}"
apps="$data/applications"
icons="$data/icons"
mkdir -p "$apps" "$icons"
cp "$here/desktop/icon.png" "$icons/aigile.png"
if [ -n "$1" ]; then
  app=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
  chmod +x "$app"
  exec_line="\"$app\""
else
  command -v node >/dev/null 2>&1 || { echo "Node.js was not found. Install the LTS version from https://nodejs.org, then run this again."; exit 1; }
  exec_line="sh -c 'cd \"$here\" && (curl -s -o /dev/null http://localhost:\${AIGILE_PORT:-4321}/api/meta || (nohup node server.js >/dev/null 2>&1 &)); sleep 1; xdg-open http://localhost:\${AIGILE_PORT:-4321}'"
fi
cat > "$apps/aigile.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=AI-gile
Comment=AI-gile board
Exec=$exec_line
Icon=$icons/aigile.png
Terminal=false
Categories=Development;
EOF
chmod +x "$apps/aigile.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" 2>/dev/null || true
echo "Launcher made: $apps/aigile.desktop"
