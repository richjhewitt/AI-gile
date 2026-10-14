#!/usr/bin/env bash
# aigile.lol site: installer for a Debian/Ubuntu server that already runs nginx. Safe to re-run (it updates the files).
#   sudo bash install-site.sh test.aigile.lol
#   sudo bash install-site.sh aigile.lol www.aigile.lol
# Run it from the site folder (index.html, style.css, assets/ next to it).
#
# It adds ONE nginx site per first domain and gets its certificate with certbot; it never edits or replaces other sites.
# If the join service is installed (/etc/nginx/snippets/aigile-join.conf), invite links work on this site too.
#
# Private site (AIG-699): only browsers with a test site pass get in; everyone else is sent to the public teaser.
#   sudo bash install-site.sh --private https://aigile.lol test.aigile.lol
# Needs the join service on this server (passes come from it). Re-run without --private to open the site up again.
#
# Board on this site (AIG-1008): your own board (on your PC, reached through its ssh -R tunnel to 127.0.0.1:<port> here) behind the
# same name. Browsers with the aigile_phone cookie get the board; everyone else gets the static teaser. /_pair/<code> and
# /api/phone/pair always go to the board (that is how a phone gets its cookie). Not combined with --private.
#   sudo bash install-site.sh --board 14321 test.aigile.lol
set -euo pipefail

TEASER=""
BOARD=""
while [ "${1:-}" = "--private" ] || [ "${1:-}" = "--board" ]; do
  if [ "$1" = "--private" ]; then
    TEASER="${2:-}"; shift 2 || true
    printf '%s' "$TEASER" | grep -Eq '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/-]*)?$' \
      || { echo "After --private give the teaser address everyone else goes to, e.g. --private https://aigile.lol" >&2; exit 1; }
  else
    BOARD="${2:-}"; shift 2 || true
    printf '%s' "$BOARD" | grep -Eq '^[0-9]{4,5}$' && [ "$BOARD" -ge 1024 ] && [ "$BOARD" -le 65535 ] \
      || { echo "After --board give the tunnel port on this server, e.g. --board 14321" >&2; exit 1; }
  fi
done
[ -z "$BOARD" ] || [ -z "$TEASER" ] || { echo "--board and --private cannot be combined." >&2; exit 1; }
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
cp -r "$HERE"/*.html "$HERE"/*.css "$HERE"/*.js "$HERE"/*.json "$HERE/assets" "$ROOT/"   # pages, teaser and form scripts, their data
chmod -R a+rX "$ROOT"

echo "==> Who may see it (/etc/nginx/snippets/$SITE.conf, rewritten on every run)"
install -d /etc/nginx/snippets
# Run without --board after a run with it: the board files go away (nothing is printed when there are none).
if [ -z "$BOARD" ]; then rm -f "/etc/nginx/conf.d/$SITE.conf" "/etc/nginx/snippets/$SITE-board.conf"; fi
if [ -n "$BOARD" ]; then
  SLUG="$(printf '%s' "$DOMAIN" | tr -c 'A-Za-z0-9\n' '_')"
  # http level (conf.d is included there): the cookie decides, and the websocket Connection header.
  sed "s#__SLUG__#$SLUG#g" > "/etc/nginx/conf.d/$SITE.conf" <<'NGINX'
# AI-gile board on this site (AIG-1008), rewritten on every run of install-site.sh --board.
map $cookie_aigile_phone $aigile_board_pick___SLUG__ {
	default 0;
	"~^[A-Za-z0-9_-]{20,}$" 1;
}
map $http_upgrade $aigile_board_conn___SLUG__ {
	default upgrade;
	"" close;
}
NGINX
  sed "s#__SLUG__#$SLUG#g" > "/etc/nginx/snippets/$SITE-board.conf" <<'NGINX'
# AI-gile board proxy (AIG-1008): the PC's tunnel end on 127.0.0.1. Included by the three board locations.
proxy_pass http://127.0.0.1:__PORT__;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $aigile_board_conn___SLUG__;
proxy_buffering off;
proxy_request_buffering off;
proxy_connect_timeout 5s;
proxy_send_timeout 60s;
proxy_read_timeout 3600s;
client_max_body_size 40m;
error_page 502 503 504 = @aigile_offline;
NGINX
  sed -i "s#__PORT__#$BOARD#g" "/etc/nginx/snippets/$SITE-board.conf"
  sed "s#__SLUG__#$SLUG#g" > "/etc/nginx/snippets/$SITE.conf" <<'NGINX'
# AI-gile site with the board (AIG-1008): a browser with the aigile_phone cookie gets the board, everyone else the static teaser.
location /_pair/ {
	include snippets/__SITE__-board.conf;
}
location = /api/phone/pair {
	include snippets/__SITE__-board.conf;
}
location / {
	if ($aigile_board_pick___SLUG__) { return 418; }
	error_page 418 = @aigile_board;
	try_files $uri $uri/ =404;
}
location @aigile_board {
	include snippets/__SITE__-board.conf;
}
location @aigile_offline {
	default_type text/html;
	add_header Cache-Control "no-store" always;
	return 503 '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Board offline</title><body style="font:18px system-ui,sans-serif;max-width:22em;margin:3em auto;padding:0 1em"><h1>Board offline</h1><p>Your board is not reachable right now. Is your computer on and AI-gile running? This page tries again when you reload it.</p>';
}
NGINX
  sed -i "s#__SITE__#$SITE#g" "/etc/nginx/snippets/$SITE.conf"
  echo "    board: browsers with the phone cookie go to the board on 127.0.0.1:$BOARD, everyone else gets the teaser"
elif [ -n "$TEASER" ]; then
  [ -f /etc/nginx/snippets/aigile-join.conf ] || { echo "--private needs the join service on this server (install-join.sh) for the passes." >&2; exit 1; }
  # Every request asks the join service whether the browser has a pass (204) or not (401: off to the teaser). /join/...
  # (the pass link itself) is a longer prefix location from aigile-join.conf, so it stays open.
  sed "s#__TEASER__#$TEASER#" > "/etc/nginx/snippets/$SITE.conf" <<'NGINX'
# AI-gile private site (AIG-699): only browsers with a test site pass get in.
location = /_aigile_pass {
	internal;
	proxy_pass http://127.0.0.1:4600/join/site/check;
	proxy_pass_request_body off;
	proxy_set_header Content-Length "";
	proxy_set_header Cookie $http_cookie;
}
location / {
	auth_request /_aigile_pass;
	error_page 401 = @aigile_teaser;
	try_files $uri $uri/ =404;
}
location @aigile_teaser {
	return 302 __TEASER__;
}
NGINX
  echo "    private: only browsers with a pass; everyone else goes to $TEASER"
else
  echo "# AI-gile site: open to everyone (install-site.sh --private makes it pass-only)." > "/etc/nginx/snippets/$SITE.conf"
  echo "    open to everyone"
fi

echo "==> nginx site (only /etc/nginx/sites-available/$SITE is created)"
if [ -f "/etc/nginx/sites-available/$SITE" ] && ! grep -q "include snippets/$SITE.conf;" "/etc/nginx/sites-available/$SITE"; then
  echo "WARNING: this older site has no 'include snippets/$SITE.conf;' line, so who may see it doesn't change." >&2
  echo "         Add that line inside its server block (next to root), then run: nginx -t && systemctl reload nginx" >&2
fi
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
	include snippets/$SITE.conf;
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
