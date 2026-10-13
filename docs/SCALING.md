# Scaling plan (AIG-661)

A plan only, nothing built. Everything runs on one VPS, "Smizflark Server 2.0": nginx with the aigile.lol site, and `relay/relay.js` (one Node process, DMs, shares, public boards, licences, bug reports).
- The repo doesn't give the box size, so this assumes 2 vCPU / 4 GB / 80 GB with about 20 TB a month of transfer. Check the real plan.
- "Users" means boards that are switched on. Today is taken as about 50, so 10x = 500, 100x = 5,000 and 1000x = 50,000.
- Prices are rough monthly costs in USD. Check current prices.

## What one user costs the server today
- **DMs:** each message is one sealed file, about 1-4 KB (encrypted text plus base64). It is deleted when the friend's board collects it, so it usually lasts seconds to minutes. If the friend is offline it stays up to 7 days (48 h for files over 1 MB).
  - Space held: about 0.1-1 MB per user, mostly waiting for friends who are offline.
- **Shares:** these go over the same mailboxes. A project snapshot is roughly 50-500 KB, and an attachment can be up to 12 MB.
  - Space held: 1-5 MB per share whose friend is offline, then 0.
- **Mailbox checks:** each running board asks for its mail regularly. Each check is one signed request: a signature check, a folder listing and a size check on every waiting file.
  - The polling interval isn't in these files. Assuming every 30 s, 50 users make about 2 requests a second, which is nothing.
- **Public boards:** one snapshot per board name, about 150 bytes per card, so a 300-card board is about 45 KB (256 KB at most).
  - Each viewer tab keeps one live connection (SSE) open. That costs about 20-50 KB of memory in Node and nginx together, plus a keep-alive every 25 s.
  - Every change sends the **whole** snapshot to **every** viewer: 45 KB x 100 viewers = 4.5 MB per change.
- **Site:** static and small; no logs are kept, so traffic is estimated. A visit loads perhaps 0.3-0.5 MB.
  - The teaser then fetches `/b/ai-gile.json` every 30 s for as long as the tab is open. That is about 45 KB x 2 a minute, roughly 5 MB per tab per hour, and the relay reads it from disk every time.
- **How I got these numbers:** from the limits written in `relay.js` (7 days / 48 h, 12 MB, 256 KB, 2 GB, 2,000 viewers, 5,000 names), the snapshot fields in `lib/publicboard.js`, and typical JSON sizes. Nothing was measured on the live box.

## Hard limits in relay.js (these fail before the hardware does)
- **2,000 live viewers in total**, and 20 per IP. After that viewers get "too many viewers".
- **2 GB of waiting mail** in total. After that every send gets "mailbox full".
- **5,000 public names.** Names are never freed: making a board private deletes the snapshot but keeps the name.
- **Slow spots:**
  - `push()` turns the snapshot into text once per viewer, not once per change. With 500 viewers a 45 KB board blocks the relay for a big part of a second on every change.
  - All file work is blocking, so one big mailbox or one big push holds up everyone else's requests.

## What breaks first
- **Public board live viewers.** At about **1,000-2,000 users** (say 1 in 10 have a public board with 5-10 viewers), the 2,000-viewer cap is reached.
- Long before that, a single popular board (a streamer, or the ai-gile board shared on the site) with a few hundred viewers can stall the relay and eat transfer: 45 KB x 500 viewers x one change every 10 s is about 2 MB/s, roughly 5 TB a month.
- Next is the 2 GB mail cap, at about **2,000-5,000 users** (assuming 0.5-1 MB held per user).
- CPU, memory and disk on the box are fine until then.

## 10x (about 500 users): same box, small fixes. About $10-30 a month (today's box)
- Code fixes, all cheap:
  - turn the snapshot into text once per change, not once per viewer;
  - cache the snapshot in memory;
  - send a small "changed" event and let viewers fetch the JSON, or send only what changed;
  - add the live viewer count and the names count to `/stats`.
- Put a 10-30 s cache in nginx on `/b/*.json`, so the site teaser costs one file read, not one per visitor.
- Clean-up: free a public name that has been private (or unused) for 90 days, and sweep empty mailbox folders.

## 100x (about 5,000 users): split it up. About $60-150 a month
- Move the static site to a CDN (Cloudflare free, or Bunny about $1-10 a month at roughly $0.01/GB). Point `/b/*.json` through the CDN with a short cache.
- Give the relay its own box with 4 vCPU / 8 GB (about $25-50) and keep a small box for nginx and the join service (about $5-10).
- Raise the limits by setting `RELAY_MAX_BYTES` to about 10 GB and the viewer cap to about 10,000. Raise the open-files limit (ulimit) for both Node and nginx.
- Put big shares (over 1 MB) in object storage (about $5-10 for the first TB) instead of on the relay's disk.
- A second relay only for mail, if needed (about $25): boards already pick a relay address, so new users can be sent to relay 2.
  - Public boards stay on one relay for now, because the viewer lists live in its memory.

## 1000x (about 50,000 users): several relays. About $300-800 a month
- **Mail:** 3-4 relays behind a load balancer (about $10-20). Each user's mail lives on one relay, chosen from their mailbox id, so no shared database is needed.
- **Live viewers:**
  - move fan-out to a separate SSE layer: 2-3 small Node or nginx push nodes fed by Redis pub/sub (about $15-50), or a hosted push service (about $50-300; check prices per connection);
  - the relay only takes publishes;
  - snapshots are served from the CDN.
- **Storage:** object storage with lifecycle rules (7 days / 48 h, as today), and public names cleared after 90 days. Plan for about 50-100 GB of mail and about 5 GB of snapshots.
- **Transfer:** about 50-100 TB a month if live boards are popular. Budget CDN costs for it, or keep only diffs on SSE.

## What to watch (AIG-660 health warnings) and the trigger for each step
- **CPU:** more than 70% for 15 min, or relay event-loop lag over 100 ms. Do the 10x code fixes; then the relay gets its own box (100x).
- **Memory:** above 75%. Get a bigger box, or move SSE off the box.
- **Disk:** above 70% of 80 GB. Clean up, then move big shares to object storage.
- **Relay storage (`/stats` bytes):** above 1 GB (half of the 2 GB cap). Look for full mailboxes, raise the cap, and at 5 GB move to object storage.
- **Live viewers (add to `/stats`):** above 1,000 (half the cap). Do the 10x fixes; above 5,000, start on the SSE layer (1000x).
- **Public names (add to `/stats`):** above 2,500 of 5,000. Free old names.
- **Monthly transfer:** above 50% of the plan. Put a CDN in front of the site and `/b/*.json`.
- **Errors:** any 507 ("mailbox full", "no names left") or a steady stream of 429 ("too many viewers", "slow down"). Act now: a limit has been hit.
