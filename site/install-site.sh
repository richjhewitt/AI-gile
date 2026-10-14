#!/usr/bin/env bash
# aigile.lol site: installer for a Debian/Ubuntu server that already runs nginx. Safe to re-run (it updates the files).
#   sudo bash install-site.sh test.aigile.lol
#   sudo bash install-site.sh aigile.lol www.aigile.lol
# Run it from the site folder (index.html, style.css, assets/ next to it).
#
# It adds ONE nginx site per first domain and gets its certificate with certbot; it never edits or replaces other sites.
# If the join service is installed (/etc/nginx/snippets/aigile-join.conf), invite links work on this site too.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run this as root: sudo bash install-site.sh your.domain" >&2; exit 1; fi
[ "$#" -ge 1 ] || { echo "Give the domain names, e.g.: sudo bash install-site.sh aigile.lol www.aigile.lol" >&2; exit 1; }
for d in "$@"; do
  if ! printf '%s' "$d" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'; then
    echo "Not a domain name: $d" >&2; exit 1
  fi
done
DOMAIN="$1"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/index.html" ] || { echo "index.html not found next to install-site.sh." >&2; exit 1; }
systemctl is-active --quiet nginx 2>/dev/null || { echo "nginx is not running on this server." >&2; exit 1; }

SITE="aigile-site-$DOMAIN"
ROOT="/var/www/$SITE"
# Checked before anything is changed: no other site may already answer to these names.
for d in "$@"; do
  if grep -RIlE "server_name[^;]*[[:space:]]$d([[:space:]]|;)" /etc/nginx/sites-enabled /etc/nginx/conf.d \
       --exclude="$SITE" --exclude="$SITE.conf" 2>/dev/null | grep -q .; then
    echo "An existing nginx site already uses server_name $d. Not touching it." >&2; exit 1
  fi
done

echo "==> Packages"
command -v certbot >/dev/null || { apt-get update -y && apt-get install -y certbot python3-certbot-nginx; }

echo "==> Site files ($ROOT)"
install -d -o root -g root -m 755 "$ROOT"
cp -r "$HERE/index.html" "$HERE/style.css" "$HERE/assets" "$ROOT/"
chmod -R a+rX "$ROOT"

echo "==> nginx site (only /etc/nginx/sites-available/$SITE is created)"
if [ ! -f "/etc/nginx/sites-available/$SITE" ]; then
  JOIN=""
  [ -f /etc/nginx/snippets/aigile-join.conf ] && JOIN="	include snippets/aigile-join.conf;"
  cat > "/etc/nginx/sites-available/$SITE" <<NGINX
server {
	listen 80;
	listen [::]:80;
	server_name $*;
	root $ROOT;
	index index.html;
	# No access log: no trackers, nothing records who visited.
	access_log off;
$JOIN
}
NGINX
else
  echo "    keeping existing /etc/nginx/sites-available/$SITE (certbot may have edited it)"
fi
ln -sf "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
if ! nginx -t; then
  rm -f "/etc/nginx/sites-enabled/$SITE"
  echo "nginx -t failed: the new site was switched off again and nginx was not reloaded." >&2; exit 1
fi
systemctl reload nginx
CERT=()
for d in "$@"; do CERT+=(-d "$d"); done
certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect "${CERT[@]}" \
  || echo "WARNING: certbot failed. Check the DNS A records, then run: sudo certbot --nginx ${CERT[*]}"

echo
echo "Site is up. Certificates can take up to a minute the first time."
echo "Open:   https://$DOMAIN"
