#!/usr/bin/env bash
# AI-gile DM relay: installer for a Debian/Ubuntu server. Safe to re-run (it updates in place).
#   sudo bash install.sh relay.example.com
# Run it from a folder that holds relay.js next to it (or one folder up, as in the repo).
#
# If nginx is already running (a server with other sites) it adds ONE new nginx site for your
# domain and gets its certificate with certbot; it never edits or replaces other sites.
# Otherwise it installs Caddy. Force a mode with:  sudo WEB=nginx bash install.sh relay.example.com
set -euo pipefail

DOMAIN="${1:-}"
if [ "$(id -u)" -ne 0 ]; then echo "Run this as root: sudo bash install.sh your.domain" >&2; exit 1; fi
if ! printf '%s' "$DOMAIN" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'; then
  echo "Give the domain name as the one argument, e.g.: sudo bash install.sh relay.example.com" >&2; exit 1
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC=""
for c in "$HERE/relay.js" "$HERE/../relay.js"; do if [ -f "$c" ]; then SRC="$c"; break; fi; done
[ -n "$SRC" ] || { echo "relay.js not found next to install.sh (or one folder up)." >&2; exit 1; }
command -v apt-get >/dev/null || { echo "This installer is for Debian/Ubuntu (needs apt-get)." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

WEB="${WEB:-}"
if [ -z "$WEB" ]; then
  if systemctl is-active --quiet nginx 2>/dev/null; then WEB=nginx; else WEB=caddy; fi
fi
case "$WEB" in nginx|caddy) ;; *) echo "WEB must be nginx or caddy." >&2; exit 1 ;; esac
echo "==> Web server mode: $WEB"

SITE=aigile-relay
if [ "$WEB" = nginx ]; then
  # Checked before anything is changed: no other site may already answer to this name.
  if grep -RIlE "server_name[^;]*[[:space:]]$DOMAIN([[:space:]]|;)" /etc/nginx/sites-enabled /etc/nginx/conf.d \
       --exclude="$SITE" --exclude="$SITE.conf" 2>/dev/null | grep -q .; then
    echo "An existing nginx site already uses server_name $DOMAIN. Not touching it; use another name." >&2; exit 1
  fi
  if command -v ss >/dev/null && ss -ltnH 'sport = :4500' | grep -q . && ! systemctl is-active --quiet aigile-relay; then
    echo "Something else already listens on port 4500. Not continuing." >&2; exit 1
  fi
fi

echo "==> Packages"
apt-get update -y
if [ "$WEB" = nginx ]; then
  apt-get install -y curl ca-certificates
  command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
else
  apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
fi

echo "==> Node.js (needs 18 or newer; an existing Node is never replaced)"
node_major() { if command -v node >/dev/null; then node -p 'process.versions.node.split(".")[0]'; else echo 0; fi; }
if [ "$(node_major)" -lt 18 ]; then
  if command -v node >/dev/null; then
    echo "Node $(node -v) is installed and other things may rely on it. Upgrade it to 18+ yourself, then re-run." >&2; exit 1
  fi
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
NODE="$(command -v node)"
echo "Using $NODE ($("$NODE" -v))"

echo "==> User and folders"
id aigile-relay >/dev/null 2>&1 || useradd --system --home-dir /var/lib/aigile-relay --shell /usr/sbin/nologin aigile-relay
install -d -o root -g root -m 755 /opt/aigile-relay
install -d -o aigile-relay -g aigile-relay -m 700 /var/lib/aigile-relay
install -o root -g root -m 644 "$SRC" /opt/aigile-relay/relay.js

echo "==> systemd service"
cat > /etc/systemd/system/aigile-relay.service <<UNIT
[Unit]
Description=AI-gile DM relay (passes sealed messages, keeps no logs)
After=network.target

[Service]
User=aigile-relay
Group=aigile-relay
ExecStart=$NODE /opt/aigile-relay/relay.js
Environment=RELAY_HOST=127.0.0.1
Environment=RELAY_PORT=4500
Environment=RELAY_DATA=/var/lib/aigile-relay
Environment=RELAY_TRUST_PROXY=1
Restart=always
RestartSec=3
# Only the startup line reaches the journal; the relay never logs requests.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ReadWritePaths=/var/lib/aigile-relay
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable aigile-relay >/dev/null
systemctl restart aigile-relay

if [ "$WEB" = nginx ]; then
  echo "==> nginx site (only /etc/nginx/sites-available/$SITE is created)"
  if [ ! -f "/etc/nginx/sites-available/$SITE" ]; then
    cat > "/etc/nginx/sites-available/$SITE" <<NGINX
server {
	listen 80;
	listen [::]:80;
	server_name $DOMAIN;
	# No access log: nothing records who connected or when.
	access_log off;
	client_max_body_size 12m;
	location / {
		proxy_pass http://127.0.0.1:4500;
		proxy_http_version 1.1;
		proxy_set_header Host \$host;
		proxy_set_header X-Forwarded-For \$remote_addr;
		proxy_set_header X-Forwarded-Proto \$scheme;
	}
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
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect -d "$DOMAIN" \
    || echo "WARNING: certbot failed. Check the DNS A record for $DOMAIN, then run: sudo certbot --nginx -d $DOMAIN"
else
  echo "==> Caddy (HTTPS with automatic certificates)"
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  fi
  cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	# No access log: nothing records who connected or when.
	log {
		output discard
	}
	request_body {
		max_size 13MB
	}
	reverse_proxy 127.0.0.1:4500
}
CADDY
  systemctl enable caddy >/dev/null
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

echo "==> Checking"
ok=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4500/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ -n "$ok" ] || { echo "The relay did not answer. See: journalctl -u aigile-relay -n 20" >&2; exit 1; }
echo
echo "Relay is running. Certificates can take up to a minute the first time."
echo "Test:   curl https://$DOMAIN/health        (should print {\"ok\":true})"
echo "Address for the board:   https://$DOMAIN"
