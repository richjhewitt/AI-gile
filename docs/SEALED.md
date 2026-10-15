# Sealed phone link v1

The AI-gile Android app talks to the board through `tailscale serve` (HTTPS over the owner's own Tailscale network). Sealing wraps every call end to end as well, so the proxy in between sees nothing, and the device key never travels again after pairing. The board side is `lib/phone-seal.js` with `runSealed` in `server.js`. The QA area `phonesealed` checks it against the vectors below. The app keeps an identical copy of this file.

## Keys
- **Pair the app** (Setup, 📱 Phone) gives the app the board url, a device id `d` (hex) and a device key `K` (base64url, 32 random bytes). The QR text is `aigile://pair?url=<https url>&id=<d>&key=<K>`.
- The seal key is `S = HKDF-SHA256(ikm = K bytes, salt = UTF-8 "aigile-seal-v1", info = UTF-8 "phone " + d, length 32)`.
- For each device, the board keeps these in `aigile.local.json` (git-ignored), under `phone.devices`:
  - `id`, `host` and `name`;
  - `hash = sha256(K)`, for the plain `Authorization: Bearer` path;
  - `seal = S` (base64url).

## Request
- `POST /api/phone/sealed` on the phone host, with header `X-Aigile-Device: <d>`, `Content-Type: application/json` and **no** Authorization header.
- The body is `{"n": base64url(12-byte random nonce), "c": base64url(ciphertext || 16-byte GCM tag)}`.
- The plaintext is UTF-8 JSON: `{"t": <ms since epoch>, "m": "GET"|"POST"|..., "p": "/api/chats", "b": <JSON body or null>}`.
- It is sealed with AES-256-GCM, key `S`, nonce `n`, AAD = UTF-8 `"aigile-seal-v1|req|" + d`.
- The board answers 403 `{"error":"sealed: ..."}` for any of these:
  - an unknown device, a removed device, or a device paired on another host;
  - a bad tag;
  - `|now - t| > 120000` ms;
  - a nonce already seen from that device in the last 10 minutes;
  - `p` not starting with `/api/`;
  - `p` (or its body) on the phone deny list: `/api/phone/*`, terminal, secrets, editor, `POST /api/setup`, `runCmd`/`runIn`.
- The board runs the inner request through the same route handlers, as that device, with the same Host binding.

## Response
- The board answers `200 {"n": ..., "c": ...}` with a fresh nonce. The plaintext is `{"s": <inner HTTP status>, "b": <inner JSON body>}`, and the AAD is `"aigile-seal-v1|res|" + d`.
- For a non-JSON inner response (pictures, attachments), `b` is `{"ct": "<content-type>", "data": base64}`.
- An inner error is sealed too, as `{"s": 404, "b": {"error": "..."}}`. Only the refusals listed under Request are plain.

## Feature flag
`GET /api/meta` includes `"sealed": 1`. The app asks for `/api/meta` through the sealed route first. It falls back to Bearer on 404/405, which is what an older board answers.

## Test vectors
All values are base64url without padding. The JSON key order is exactly as written, with no spaces.

| | |
|---|---|
| K | bytes 0x00..0x1f = `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8` |
| d | `a1b2c3d4e5f6` |
| S | `b8A3-7OMQrGQV8qPfAkIm40ylw_x7R7MS7xdpHM0ups` |
| n (both) | bytes 0x00..0x0b = `AAECAwQFBgcICQoL` |
| request plaintext | `{"t":1700000000000,"m":"GET","p":"/api/chats","b":null}` |
| request body | `{"n":"AAECAwQFBgcICQoL","c":"C-rMPhBge0WYfeqf1OqyeWA2CmLnmtGeNQtNEWbw8REEkdGFukqxDT2RcAu8Ik1K7ChJ1XsR44LY5CDa2EY7npuTGoY_kxQ"}` |
| response plaintext | `{"s":200,"b":{"ok":true}}` |
| response body | `{"n":"AAECAwQFBgcICQoL","c":"C-rLPhBjfEWEb7iN3qGgJjskHDT4zY7BD6Bp_BG4--LDx5YkHkk7gEs"}` |

These were computed with node `crypto.hkdfSync` and `aes-256-gcm`. A real response always uses a fresh random nonce; the fixed nonce is only for the vectors.
