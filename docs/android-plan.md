# Android app plan (AIG-735)

Plan only. No app code yet. Builds on AIG-412 (first plan), AIG-410 (phone pages, PWA) and AIG-411 (reach the board from outside).

## Goals
- Your board, your AI teams and your friends in your pocket, in one calm app.
- Tell you only what needs you; everything else waits until you look.
- Short, plain, low-clutter screens, same words as the board.
- Your data stays on your own board at home. The phone is a window onto it, not a second copy of the truth.

## What we do better than Discord (honest)
- **Calm by default.** Discord pings for many things unless you mute them. We send one kind of alert by default: "something waits on you". The rest is opt-in.
- **Fewer, grouped alerts.** One alert per batch ("3 cards to test"), not one per message. Quiet hours on by default.
- **No dark patterns.** No upsell banners, no streaks, no "people you may know", no ads, no red badges for things that are not yours to do.
- **AuDHD-friendly.** One job per screen, big tap targets, plain words, no animations you can't turn off, focus mode, same layout every time.
- **Cards and chat in one place.** A chat about a card sits on the card. Discord threads are not tasks; ours are.
- **AI team built in.** Your leads and testers are in the chat list; "DM me about this" from any card.
- **Private DMs.** Friend DMs are end-to-end encrypted by the board (see `docs/DMS-DESIGN.md`). Discord text messages are not end-to-end encrypted (as far as we know; recheck before saying it in public).
- **Self-hosted.** Your board and the relay run on your own machines. No account with us needed to use it.
- Where Discord is better, and we won't pretend otherwise: voice and video, big communities, huge bot ecosystem, polish. We don't try to beat those in v1.

## Screens (v1)
- **Connect:** scan a QR code from the board's Setup, or type an address. One screen, one button.
- **Home:** your projects in your order (AIG-189), a dot only where something waits on you.
- **Board:** one column at a time, swipe sideways; tap a card to open it.
- **Card:** title, short description, checklist, conversation, reply box. Buttons: Accept, Send back, Answer questions (Topic quiz).
- **For you to test:** one card at a time, steps as a checklist, Pass / Send back (like the inbox AI-passed view, AIG-192).
- **Messages:** team leads and friends in one list; friends marked 🔒.
- **Setup:** connection, alerts, quiet hours, language, text size, theme. Nothing else.
- Bottom bar with 4 items at most: Home, For you, Messages, Setup.

## Chat
- Team chats: the existing card comments and DM cards (`aigile comment`, `/dmme`).
- Friend DMs: the phone asks the home board, which holds the keys and talks to the relay (`/api/dms/*`). The phone never holds the DM keys in v1.
- Send works offline: the message waits in an outbox and goes when the link is back. Shown as "waiting to send", never lost silently.
- Emojis: system emoji plus your own (`/api/emojis`).
- Not in v1: group chats, reactions, typing dots, read receipts (calmer without them).

## Notifications
- Who decides: the home board. It already knows what waits on Rich (`/api/inbox`). It sends a push when that list grows, batched (at most one per few minutes).
- Content-free push: the push only says "something new"; the app then fetches the details over the safe link. Nothing private passes through Google or a push server.
- Android notification channels (Android 8+): "Waits on you" (on), "Messages from friends" (on), "Team news" (off). You can change each in Android settings.
- Android 13+ asks for permission to show notifications; we ask once, at the moment you turn alerts on, with one plain sentence why.
- **Option A: FCM (Firebase Cloud Messaging).** Works out of the box, battery-friendly, reliable. Needs Google Play services (no de-Googled phones). The sending key would live on our relay, so the board asks the relay to push. Google sees that a push happened, not what it says.
- **Option B: UnifiedPush (e.g. ntfy, self-hostable).** No Google; the board can push straight to your own ntfy server. You must install a second app (the distributor) and keep it allowed in the background; some phone brands kill it to save battery.
- **Pick:** support both, FCM default for ease, UnifiedPush in Setup for people who want no Google. Start with UnifiedPush/ntfy if Rich prefers fully self-hosted; it needs no Firebase project.
- Fallback with neither: check every 15 minutes or so with WorkManager (Android may delay it), plus a fresh check when you open the app.

## Offline and sync
- The board today is polled (the page asks every second). The phone should not do that: it drains battery.
- On open and on push: fetch `/api/inbox`, the projects list, and the open project. Cache it in a small local database (Room).
- Show cached data at once, with "last updated 2 min ago" when offline.
- Writes (comment, accept, send back, DM) go in an outbox, sent in order when online; on a clash, the board wins and the phone shows what happened.
- Later (needs server work): a "what changed since X" route so the phone downloads less. Today `GET /api/projects/:slug/updates` is per team, not per device.

## Auth and connecting
- Today the board only answers on this computer: it listens on 127.0.0.1 and refuses any other Host (`server.js` guard, AIG-90). There is no login, because there was no need. **Nothing here may weaken that for the PC.**
- So the app needs new server work first:
  - **Pairing:** Setup shows a QR code with a one-off code; the phone trades it for a device key. Each phone is listed in Setup with "Remove".
  - **Every phone request is signed** with that key; unsigned requests from outside get nothing.
  - **At home:** an optional second listener for the LAN, off by default, only for paired phones, over https (self-signed cert pinned at pairing).
  - **Out and about (AIG-411):** a private network such as Tailscale/WireGuard (simplest, no open ports), or a tunnel through our relay with requests sealed end to end like DMs (no extra app, more work, slower).
- Phone keys live in the Android Keystore. Lost phone: remove it in Setup on the PC.
- Friends' boards are never reachable from your phone; only your own board.

## Voice (later)
- Not in v1. Voice notes on cards first (record, attach, the board can transcribe), then maybe calls between friends.
- Live voice needs a media server or peer-to-peer (WebRTC) and is a big job; Discord is strong here. Revisit after v1 is used daily.

## Tech choice
- **Kotlin + Jetpack Compose** (recommended): native look and speed, best notification and background support, Room for the cache, WorkManager for background checks, Keystore for keys. One platform, so no cross-platform tax.
- Not React Native / Flutter: we have no iOS plan yet, and they add a second toolchain for no gain now. Revisit if iOS becomes a goal.
- Not a WebView wrapper: cheapest, but weak at background push and offline, and it would feel like the web page.
- **PWA first (AIG-410)** as the stepping stone: the phone pages and Add to home screen already exist (`manifest.webmanifest`, `sw.js`). Use it daily to learn which screens matter before writing native ones.
- Languages: reuse the board's `public/lang/*` strings where possible (a build step that turns them into Android strings).

## Risks
- **Security:** opening the board to a phone is the biggest risk. Pairing and signing must be designed and reviewed before any build (AIG-411 first).
- **Push:** FCM needs a Firebase project and key on our relay; UnifiedPush is less reliable on some phone brands.
- **Play Store:** new personal developer accounts must run a closed test with a set number of testers for about two weeks before going public, and must target a recent Android version. Check the current rules when we get there; they change yearly.
- **Sideloading:** Google has announced developer verification for apps installed outside the Play Store on certified phones. Check status before planning an F-Droid or APK-only release.
- **Two clients drift:** web and Android can get out of step. Keep the API the single source; the phone has no rules of its own.
- **Scope creep:** "beat Discord" can swallow everything. v1 is board, cards, testing, messages, alerts. Nothing else.
- **Battery:** no 1-second polling, ever.

## Milestones
- **M0 Groundwork (existing cards):** AIG-410 PWA tested on a real phone; AIG-411 safe reach design agreed.
- **M1 Pair and look:** pairing on the board, app skeleton, connect screen, home, board, card (read only). Same Wi-Fi or private network.
- **M2 Act:** reply, accept, send back, answer questions, For you to test, Messages (team and friends).
- **M3 Alerts:** board-side "waits on you" push, channels, quiet hours, FCM and UnifiedPush.
- **M4 Offline and release:** cache and outbox, closed test on Play, then public.
- **Later:** voice notes, outside access over the relay, sharing `.aigile` files, tablet layout.
