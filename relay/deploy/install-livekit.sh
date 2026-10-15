#!/usr/bin/env bash
# AI-gile calls (AIG-1218): installs a LiveKit server next to the DM relay, so calls work for every board with no setup.
#   sudo bash install-livekit.sh call.example.com
# Safe to re-run: it updates the binary, keeps the key and secret it made the first time, and keeps an existing nginx site.
#
# What it does: downloads the official livekit-server release binary (LK_VERSION=1.x.y to pin one; default the latest release),
# writes /etc/livekit.yaml with a generated API key and secret, a systemd unit (livekit), ONE new nginx site for the domain that
# proxies wss:// to 127.0.0.1:7880 with a certbot certificate, and opens UDP 50000-60000 and TCP 7881 when ufw is active.
# At the end it prints the three RELAY_LIVEKIT_* values for the relay's systemd drop-in. It never touches the relay itself.
set -euo pipefail

DOMAIN="${1:-}"
if [ "$(id -u)" -ne 0 ]; then echo "Run this as root: sudo bash install-livekit.sh call.your.domain" >&2; exit 1; fi
if ! printf '%s' "$DOMAIN" | grep -Eq '^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'; then
  echo "Give the domain name as the one argument, e.g.: sudo bash install-livekit.sh call.example.com" >&2; exit 1
fi
command -v apt-get >/dev/null || { echo "This installer is for Debian/Ubuntu (needs apt-get)." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

SITE=aigile-livekit
CONF=/etc/livekit.yaml
BIN=/usr/local/bin/livekit-server

if ! command -v nginx >/dev/null || ! systemctl is-active --quiet nginx; then
  echo "This needs nginx running (as the relay's nginx mode sets up). Not continuing." >&2; exit 1
fi
# Checked before anything is changed: no other site may already answer to this name, and nothing else may hold the ports.
if grep -RIlE "server_name[^;]*[[:space:]]$DOMAIN([[:space:]]|;)" /etc/nginx/sites-enabled /etc/nginx/conf.d \
     --exclude="$SITE" --exclude="$SITE.conf" 2>/dev/null | grep -q .; then
  echo "An existing nginx site already uses server_name $DOMAIN. Not touching it; use another name." >&2; exit 1
fi
if command -v ss >/dev/null && ! systemctl is-active --quiet livekit; then
  for p in 7880 7881; do
    if ss -ltnH "sport = :$p" | grep -q .; then echo "Something else already listens on port $p. Not continuing." >&2; exit 1; fi
  done
fi

echo "==> Packages"
apt-get update -y
apt-get install -y curl ca-certificates tar openssl
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx

echo "==> livekit-server (official release binary)"
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  armv7l) ARCH=armv7 ;;
  *) echo "Unknown CPU type $(uname -m)." >&2; exit 1 ;;
esac
VER="${LK_VERSION:-}"
if [ -z "$VER" ]; then
  VER="$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/livekit/livekit/releases/latest | sed -E 's#.*/tag/v?##')"
fi
printf '%s' "$VER" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "Could not find the latest LiveKit version (got '$VER'). Set LK_VERSION=1.x.y and re-run." >&2; exit 1; }
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT
BASE="https://github.com/livekit/livekit/releases/download/v$VER"
TGZ="livekit_${VER}_linux_${ARCH}.tar.gz"
curl -fsSL -o "$TMPD/$TGZ" "$BASE/$TGZ"
if { curl -fsSL -o "$TMPD/sums.txt" "$BASE/checksums.txt" 2>/dev/null || curl -fsSL -o "$TMPD/sums.txt" "$BASE/livekit_${VER}_checksums.txt" 2>/dev/null; } \
   && grep -q " $TGZ\$" "$TMPD/sums.txt"; then
  ( cd "$TMPD" && grep " $TGZ\$" sums.txt | sha256sum -c - ) || { echo "The download does not match the release checksum. Not installing." >&2; exit 1; }
else
  echo "    (no checksum file in this release: only https protects the download)"
fi
tar -xzf "$TMPD/$TGZ" -C "$TMPD" livekit-server
install -o root -g root -m 755 "$TMPD/livekit-server" "$BIN"
echo "Installed livekit-server $VER ($ARCH)"

echo "==> User and config"
id livekit >/dev/null 2>&1 || useradd --system --home-dir /var/lib/livekit --shell /usr/sbin/nologin livekit
KEY=""; SECRET=""
if [ -f "$CONF" ]; then
  # Keep the key the boards' passes are signed with: the first "  KEY: SECRET" line under keys:
  read -r KEY SECRET < <(awk '/^keys:/{k=1;next} k&&/^[^ ]/{k=0} k&&/^  [A-Za-z0-9_]+: /{sub(/^  /,"");sub(/:/,"");print;exit}' "$CONF") || true
fi
if [ -z "$KEY" ] || [ -z "$SECRET" ]; then
  KEY="API$(openssl rand -hex 6)"
  SECRET="$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48)"
  echo "    made a new API key and secret"
else
  echo "    keeping the API key and secret in $CONF"
fi
umask 027
cat > "$CONF" <<YAML
# LiveKit for AI-gile calls (written by install-livekit.sh). The relay signs call passes with the key below.
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  $KEY: $SECRET
room:
  empty_timeout: 300
logging:
  level: warn
YAML
chown root:livekit "$CONF"; chmod 640 "$CONF"
umask 022

echo "==> systemd service"
cat > /etc/systemd/system/livekit.service <<UNIT
[Unit]
Description=LiveKit server for AI-gile calls
After=network-online.target
Wants=network-online.target

[Service]
User=livekit
Group=livekit
ExecStart=$BIN --config $CONF
Restart=always
RestartSec=3
LimitNOFILE=500000
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable livekit >/dev/null
systemctl restart livekit

echo "==> nginx site (only /etc/nginx/sites-available/$SITE is created)"
if [ ! -f "/etc/nginx/sites-available/$SITE" ]; then
  cat > "/etc/nginx/sites-available/$SITE" <<NGINX
server {
	listen 80;
	listen [::]:80;
	server_name $DOMAIN;
	# No access log: nothing records who called or when.
	access_log off;
	location / {
		proxy_pass http://127.0.0.1:7880;
		proxy_http_version 1.1;
		proxy_set_header Upgrade \$http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_set_header Host \$host;
		proxy_set_header X-Forwarded-For \$remote_addr;
		proxy_set_header X-Forwarded-Proto \$scheme;
		proxy_read_timeout 86400s;
		proxy_send_timeout 86400s;
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

echo "==> Firewall"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 7881/tcp >/dev/null
  ufw allow 50000:60000/udp >/dev/null
  echo "    ufw: opened TCP 80, 443, 7881 and UDP 50000-60000"
else
  echo "    ufw is not active. If your host has its own firewall, open TCP 7881 and UDP 50000-60000 there."
fi

echo "==> Checking"
ok=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:7880/ >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ -n "$ok" ] || { echo "LiveKit did not answer. See: journalctl -u livekit -n 30" >&2; exit 1; }

DROP=/etc/systemd/system/aigile-relay.service.d/livekit.conf
echo
echo "LiveKit is running on wss://$DOMAIN (certificates can take up to a minute the first time)."
echo "Test:   curl https://$DOMAIN/        (should print OK)"
echo
echo "Now give the relay these three values (keep them secret):"
echo "  RELAY_LIVEKIT_URL=wss://$DOMAIN"
echo "  RELAY_LIVEKIT_KEY=$KEY"
echo "  RELAY_LIVEKIT_SECRET=$SECRET"
echo
echo "For example:"
echo "  sudo install -d -m 755 $(dirname "$DROP")"
echo "  sudo install -m 600 /dev/null $DROP"
echo "  printf '[Service]\\nEnvironment=RELAY_LIVEKIT_URL=wss://$DOMAIN\\nEnvironment=RELAY_LIVEKIT_KEY=$KEY\\nEnvironment=RELAY_LIVEKIT_SECRET=$SECRET\\n' | sudo tee $DROP >/dev/null"
echo "  sudo systemctl daemon-reload && sudo systemctl restart aigile-relay"
echo "  curl https://<your relay>/call      (should print {\"ok\":true,\"url\":\"wss://$DOMAIN\"})"
