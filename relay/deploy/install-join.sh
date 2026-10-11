#!/usr/bin/env bash
# AI-gile join service (AIG-347): installer for a Debian/Ubuntu server that already serves your site with nginx.
# Safe to re-run (it updates in place).
#   sudo JOIN_OWNER_KEY=<your key> bash install-join.sh aigile.lol [path/to/AI-gile-x.y.zip]
# Run it from a folder that holds join.js next to it (or one folder up, as in the repo).
#
# It never edits or replaces any nginx site. It runs join.js on 127.0.0.1:4600 and writes ONE snippet file,
# /etc/nginx/snippets/aigile-join.conf, which you include inside your site's server block with one line (the last
# message says which). Nothing is exposed until you do that.
set -euo pipefail

DOMAIN="${1:-}"
ZIPSRC="${2:-}"
KEY="${JOIN_OWNER_KEY:-}"
if [ "$(id -u)" -ne 0 ]; then echo "Run this as root: sudo JOIN_OWNER_KEY=... bash install-join.sh your.domain" >&2; exit 1; fi
if ! printf '%s' "$DOMAIN" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'; then
  echo "Give the domain name as the first argument, e.g.: sudo JOIN_OWNER_KEY=... bash install-join.sh aigile.lol" >&2; exit 1
fi
if ! printf '%s' "$KEY" | grep -Eq '^[A-Za-z0-9_-]{43}$'; then
  echo "Set JOIN_OWNER_KEY to your key (43 characters), shown in AI-gile Setup under Invite a friend to AI-gile, Join service address and key." >&2; exit 1
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC=""
for c in "$HERE/join.js" "$HERE/../join.js"; do if [ -f "$c" ]; then SRC="$c"; break; fi; done
[ -n "$SRC" ] || { echo "join.js not found next to install-join.sh (or one folder up)." >&2; exit 1; }
if [ -n "$ZIPSRC" ]; then
  [ -f "$ZIPSRC" ] || { echo "Zip not found: $ZIPSRC" >&2; exit 1; }
  case "$ZIPSRC" in *.zip) ;; *) echo "The release file must be a .zip" >&2; exit 1 ;; esac
fi
command -v apt-get >/dev/null || { echo "This installer is for Debian/Ubuntu (needs apt-get)." >&2; exit 1; }

# Checked before anything is changed.
systemctl is-active --quiet nginx 2>/dev/null || { echo "nginx is not running. This installer adds the join service beside an existing nginx site." >&2; exit 1; }
if ! grep -RIlE "server_name[^;]*[[:space:]]$DOMAIN([[:space:]]|;)" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -q .; then
  echo "No nginx site answers to $DOMAIN yet. Set that site up first (this installer never creates or edits sites)." >&2; exit 1
fi
if command -v ss >/dev/null && ss -ltnH 'sport = :4600' | grep -q . && ! systemctl is-active --quiet aigile-join; then
  echo "Something else already listens on port 4600. Not continuing." >&2; exit 1
fi

echo "==> Node.js (needs 18 or newer; an existing Node is never replaced)"
node_major() { if command -v node >/dev/null; then node -p 'process.versions.node.split(".")[0]'; else echo 0; fi; }
if [ "$(node_major)" -lt 18 ]; then
  if command -v node >/dev/null; then
    echo "Node $(node -v) is installed and other things may rely on it. Upgrade it to 18+ yourself, then re-run." >&2; exit 1
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
NODE="$(command -v node)"
echo "Using $NODE ($("$NODE" -v))"

echo "==> User and folders"
id aigile-join >/dev/null 2>&1 || useradd --system --home-dir /var/lib/aigile-join --shell /usr/sbin/nologin aigile-join
install -d -o root -g root -m 755 /opt/aigile-join
install -d -o aigile-join -g aigile-join -m 700 /var/lib/aigile-join
install -d -o aigile-join -g aigile-join -m 700 /var/lib/aigile-join/data
install -o root -g root -m 644 "$SRC" /opt/aigile-join/join.js
if [ -n "$ZIPSRC" ]; then install -o aigile-join -g aigile-join -m 600 "$ZIPSRC" /var/lib/aigile-join/AI-gile.zip; fi
[ -f /var/lib/aigile-join/AI-gile.zip ] || echo "Note: no release zip yet. Re-run with the zip as the second argument before sharing links."
# Only your key may add links. Readable by root only.
umask 077
printf 'JOIN_OWNER_KEY=%s\n' "$KEY" > /etc/aigile-join.env
chmod 600 /etc/aigile-join.env
umask 022

echo "==> systemd service"
cat > /etc/systemd/system/aigile-join.service <<UNIT
[Unit]
Description=AI-gile join service (one-use download links, keeps no logs)
After=network.target

[Service]
User=aigile-join
Group=aigile-join
ExecStart=$NODE /opt/aigile-join/join.js
EnvironmentFile=/etc/aigile-join.env
Environment=JOIN_HOST=127.0.0.1
Environment=JOIN_PORT=4600
Environment=JOIN_DATA=/var/lib/aigile-join/data
Environment=JOIN_ZIP=/var/lib/aigile-join/AI-gile.zip
Environment=JOIN_TRUST_PROXY=1
Restart=always
RestartSec=3
# Only the startup line reaches the journal; the service never logs requests.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ReadWritePaths=/var/lib/aigile-join
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable aigile-join >/dev/null
systemctl restart aigile-join

echo "==> nginx snippet (only /etc/nginx/snippets/aigile-join.conf is written; no site is edited)"
install -d /etc/nginx/snippets
cat > /etc/nginx/snippets/aigile-join.conf <<'NGINX'
# AI-gile join service: include this inside the server block of your site (see install-join.sh).
location /join {
	# No access log: nothing records who connected or when.
	access_log off;
	client_max_body_size 16k;
	proxy_pass http://127.0.0.1:4600;
	proxy_http_version 1.1;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-For $remote_addr;
	proxy_set_header X-Forwarded-Proto $scheme;
}
NGINX
nginx -t

echo "==> Checking"
ok=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4600/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ -n "$ok" ] || { echo "The join service did not answer. See: journalctl -u aigile-join -n 20" >&2; exit 1; }
echo
echo "The join service is running on this server, but not reachable from outside yet."
if grep -RIlE 'include[[:space:]]+(/etc/nginx/)?snippets/aigile-join\.conf' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -q .; then
  echo "Your nginx already includes the snippet. If you changed it, run: sudo nginx -t && sudo systemctl reload nginx"
else
  echo "Last step, by hand: in the server { } block of your $DOMAIN site (HTTPS one), add this line:"
  echo "    include snippets/aigile-join.conf;"
  echo "then:  sudo nginx -t && sudo systemctl reload nginx"
fi
echo "Test:   curl https://$DOMAIN/join/health        (should print {\"ok\":true})"
echo "Then in AI-gile Setup, Invite a friend to AI-gile, the address is https://$DOMAIN (the default is https://aigile.lol)."
