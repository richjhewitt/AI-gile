# Running the DM relay on your own server

The relay passes sealed (already encrypted) messages between boards. It sees scrambled data only and keeps no request logs. This sets it up on a small Linux server in a few copy-paste steps, with HTTPS handled automatically.

## What you need
- A VPS running **Debian or Ubuntu** (the cheapest size is plenty), and its IP address. A server that already runs nginx and certbot for other sites is fine: the installer detects that and adds one new site beside them, leaving the others alone. On a bare server it installs Caddy instead.
- A **domain name** (or subdomain, e.g. `relay.yourname.com`) with an **A record pointing at the VPS IP**. Do this before step 3, or the certificate cannot be issued.
- **Ports 80 and 443 open** on the VPS (the default on most providers; if there is a firewall panel, allow both).
- **SSH** access, as root or a user with `sudo`.

In the commands below, replace `relay.example.com` with your domain and `you@YOUR-VPS-IP` with your login.

## Steps

1. On your computer, in the AI-gile folder, copy the relay and installer to the server.

```
scp relay/relay.js relay/deploy/install.sh you@YOUR-VPS-IP:~
```

You should see both files listed at 100%, with no error.

2. Log in to the server.

```
ssh you@YOUR-VPS-IP
```

You should get a prompt on the server.

3. Run the installer with your domain (a minute or two; it installs Node only if missing, and never replaces an existing Node).

```
sudo bash install.sh relay.example.com
```

You should see `==> Web server mode: nginx` (or `caddy` on a bare server), then `==> ...` headings, ending with `Relay is running.` and the address to use. It stops before changing anything if another nginx site already uses your domain. If it stops with an error, fix what it says and run the same command again.

4. Check it from anywhere (your own computer is fine). The first time, the certificate can take up to a minute.

```
curl https://relay.example.com/health
```

You should see `{"ok":true}`.

5. Point the board at it: in AI-gile open **Setup**, find **DMs**, and put `https://relay.example.com` in **Relay address**. Save.

You should see the relay address kept after a refresh. Press **Check** to see ✅ when the board can reach the relay.


6. Check it end to end: add a friend with an invite code (or use two boards), send a message, and see it arrive. In Messages, **see what the relay sees** shows the scrambled version.

## Updating later
Copy the new `relay.js` across (step 1) and run step 3 again. It is safe to re-run, and messages waiting in mailboxes are kept.

## Looking after it
- Is it running: `sudo systemctl status aigile-relay`
- Logs: `sudo journalctl -u aigile-relay` shows only startup lines. The web server access log is off for this site.
- Where messages wait: `/var/lib/aigile-relay` (readable only by the relay's own user). They are deleted once collected, or after 7 days.
- Restart: `sudo systemctl restart aigile-relay`

## What gets installed
- `/opt/aigile-relay/relay.js`, run by systemd as the `aigile-relay` user (no login, no shell), starting on boot and restarting if it stops.
- The relay listens on `127.0.0.1:4500` only; the outside world reaches it through nginx (or Caddy) on port 443.
- Behind nginx (when it was already running): one new file `/etc/nginx/sites-available/aigile-relay` plus its symlink in `sites-enabled`, with no access log and bodies up to 12 MB, and a certificate from `certbot --nginx` with HTTP redirected to HTTPS. Other sites are never edited; `nginx -t` runs before each reload. certbot is installed only if missing.
- On a bare server instead: Caddy (from its official package repository) with a Caddyfile that proxies your domain to the relay.
