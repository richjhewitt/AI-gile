# AI-gile for iPhone (shell)

A small SwiftUI app: a web view of the board's phone pages over your own Tailscale network. Pairs like the Android app.

## What it does
- First launch: **Scan the pairing QR** (camera) or **Type the address** (board address plus device key).
- QR text is `aigile://pair?url=https://<host>&id=<d>&key=<K>` (Setup, Phone, Pair the app).
- The address and key are kept in the iOS Keychain (this device only).
- Every page request goes through a private `aigile-app://` scheme handler that adds `Authorization: Bearer <key>` (a web view cannot add it to scripts and pictures otherwise) and sends no Origin.
- Pull down to refresh; a plain offline message with Try again and Pair again.
- Not in this shell: the sealed link (`docs/SEALED.md`), push alerts, native screens.

## Sikosis on a Mac
- Install Xcode (App Store) and XcodeGen: `brew install xcodegen`.
- In this folder run `xcodegen generate`; it writes `AIgile.xcodeproj` (not committed).
- `open AIgile.xcodeproj`; in Signing & Capabilities pick your personal team (a free Apple ID is fine for your own phone).
- Plug the iPhone in, enable Developer Mode (Settings, Privacy & Security), choose it as the run target, press Run.
- Pair: on the PC Setup, Phone, Pair the app, then scan the QR in the app.

## App Store signing later (needs the Apple account, AIG-806)
- Paid Apple Developer Program membership.
- Set `DEVELOPMENT_TEAM` and the real bundle id (now the placeholder `lol.aigile.app`) in `project.yml`.
- App icon set, privacy answers, and a review note on how to pair (the app is useless without a board).
- Archive in Xcode, upload to App Store Connect, test with TestFlight first.

## First things to check (untested, no Xcode on the PC)
- It compiles and runs.
- The board page works on a non-https scheme (service worker and clipboard may not).
- Live streams (SSE) pass through the proxy.
