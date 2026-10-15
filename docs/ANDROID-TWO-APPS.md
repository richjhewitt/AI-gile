# Android: two apps (AIG-869)

Plan only, no code. Builds on `docs/android-plan.md` (AIG-735: screens, calm alerts, pairing, risks) and `docs/android-journeys.html` (AIG-753). Read those for the "why"; this file is the "what first".

## In one breath
- **Today, zero install:** the board as a PWA on the phone over Tailscale. Needs one small server change (card 1), nothing on the phone but Chrome.
- **Then:** one Kotlin + Compose project, two flavours: **Messenger** first, **AI-gile** (full board) second.
- The phone is a window. The board at home keeps the cards, the chats and the DM keys.

## 1. Messenger (light, ships first)
- **Chats list, one screen:** 🧭 Lead Scrum Master, team leads, friends 🔒, then Discord and Twitch tabs (only if set up on the board).
- **One chat:** messages, reply box, send. Your own emojis. Photos later.
- **Alerts:** "new message" only. Calm, batched, quiet hours.
- **Not in it:** boards, cards, tests, Setup beyond connection and alerts.
- Board routes it uses (all exist): `GET /api/chats`, `/api/chats/:slug`, `/api/chats/_watchman` (+ `POST`), `/api/dms/contacts[/:id/messages]`, `/api/discord/chats|messages|send`, `/api/twitch/messages|send`, `/api/emojis`.

## 2. AI-gile Android (full board, second)
- Everything in Messenger, plus the AIG-735 screens: Home, For you, Board, Card, To test, Setup.
- Bottom bar: Home, For you, Messages, Setup (max 4, as in AIG-735).
- Alerts: "waits on you" (from `/api/inbox`) plus messages.
- Shortcut for v0: the Board and Card screens can be the board's own phone page in a WebView tab, swapped for native screens one at a time. Ships much sooner; nothing is written twice on day one.

## What they share
- **One codebase, two flavours** (Gradle product flavours `messenger` and `board`), not two projects.
  - Shared module: pairing, API client, Keystore key, push, chat screens, theme, strings.
  - `board` flavour adds the board screens. Different app id and icon, so both can sit on one phone.
- **Sign-in = pairing** (from AIG-735): Setup > Phones > Add a phone shows a QR; phone scans; three check words; phone gets a device key in the Android Keystore; Remove on the PC locks it out.
  - One pairing per app. Messenger's key can be limited to chat routes (smaller risk if lost).
- **API client:** plain HTTPS + JSON to the board, every request carries the device key. No rules on the phone; the board decides.
- **Notifications:** content-free push ("something new"), the app then fetches over Tailscale. Nothing private passes through Google or a push server.
  - First build: no push. Check on open + WorkManager every ~15 min.
  - Then: UnifiedPush via ntfy on our own relay server (no Google, no Firebase project). FCM later only if ntfy is flaky on Rich's phone.
- **Strings:** a build step turns `public/lang/*` into Android strings (AIG-735).

## Reaching the board at home safely
- **Today: Tailscale** (Rich has it on PC and phone).
  - On the PC: `tailscale serve --bg 4321` gives `https://<pc>.<tailnet>.ts.net` with a real certificate, proxied to `127.0.0.1:4321`.
  - Board stays on 127.0.0.1. No open ports, no 0.0.0.0, no router changes.
  - **Never** `tailscale funnel` (that is the public internet).
- **Server change needed** (today the guard in `server.js` refuses any Host but localhost):
  - Setting `remote.host` (the ts.net name), off by default.
  - That Host is let in **only** with a paired device key; no key = 403, even inside the tailnet.
  - Localhost behaviour unchanged (AIG-90 guard stays as is).
  - Remote devices can't use the terminal, secrets, run servers or change Setup > Roles (page-token routes stay local).
- **Later: the relay.** Requests sealed end to end like DMs, through our relay. For people without Tailscale. More work, so only after the apps are used daily.

## Tech choice
- **PWA over Tailscale (now, zero install):** the phone pages, `manifest.webmanifest` and `sw.js` already exist; HTTPS from `tailscale serve` makes Add to home screen work. Good enough to use daily from week one. Weak: background alerts, feels like a web page.
- **TWA wrapper:** a PWA in a Play Store shell. Adds almost nothing over the PWA for a private app. Skip.
- **Capacitor:** reuses the web page, but the page is classic scripts in one global scope (hard to slice a light Messenger out), and push/background still need native plugins. Two worlds to debug. Skip.
- **Kotlin + Jetpack Compose: recommended for both apps.**
  - Best notifications, background work and Keystore, which is the whole point of a messenger.
  - AI writes Compose very well; one language, one toolchain, Google's own docs.
  - Messenger's UI is small (list + chat), so native costs little.
  - The WebView tab covers the big board screens until native ones are worth it.
- **No Android SDK yet:** install Android Studio once (card 2). Or let GitHub Actions build the APK and download it on the phone; useful anyway for builds away from the PC.

## What ships first
- **Week 0: the PWA** (card 1). Learn which chats matter before building.
- **First app: Messenger.** Smallest first build:
  - sideloaded debug APK, signed with our own key;
  - paste or scan the board address + pairing code;
  - chats list (leads, Scrum Master, friends) and one chat with send;
  - pull to refresh, check on open. No push, no Discord/Twitch, no offline outbox yet.
- **Second app: AI-gile Android**, same project, `board` flavour.

## Build cards (each about one session)
1. **Board: phone access over Tailscale.** `remote.host` setting, device keys, pairing QR in Setup > Phones with Remove; guard lets that Host in only with a key; local-only routes stay local. QA area `phones`. Test the PWA on Rich's phone.
2. **Android toolchain + empty app.** Android Studio (or a GitHub Actions build), one project, flavours `messenger` and `board`, app ids and icons, debug signing key kept out of git. Sideload "hello" on the phone.
3. **Shared core: pairing + API client.** Scan/paste screen, three check words, key in Keystore, signed requests, "can't reach the board, is Tailscale on?" message.
4. **Messenger: chats list + one chat.** Leads, Scrum Master, friends 🔒; read and send; own emojis. **First sideloadable Messenger.**
5. **Messenger: alerts v0 + outbox.** WorkManager check, one notification channel per kind, quiet hours, Android 13 permission ask once; unsent messages wait as "waiting to send".
6. **Push: ntfy/UnifiedPush.** Board sends content-free push to ntfy on our relay server; app wakes and fetches. Board batches (one per few minutes).
7. **Messenger: Discord and Twitch tabs.** Only when set up on the board. **Messenger v1.**
8. **AI-gile Android: Home + For you (native) + Board/Card in a WebView tab.** Same pairing, "waits on you" alerts. **First sideloadable full app.**
9. **AI-gile Android: native Card + To test** (Accept, Send back, Pass, reply). Drop the WebView for those.
10. **Release prep:** strings from `public/lang`, check current Play closed-test and sideload verification rules, decide Play vs APK only.

## Open questions for Rich (with my suggested answers)
1. **Push: ntfy on our relay server, or Google FCM?** Suggest ntfy: no Google, no Firebase project, fits self-hosted. FCM only if ntfy proves unreliable on your phone.
2. **Install Android Studio on this PC, or build APKs on GitHub Actions only?** Suggest Android Studio: faster to fix things live; add Actions later.
3. **Messenger for friends too, or just you for now?** Suggest just you first; friends (with their own board) once the relay route exists.
4. **Play Store or sideload only?** Suggest sideload only until both apps are used daily; Play later (the closed test takes about two weeks).
