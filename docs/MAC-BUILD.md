# Mac build (unsigned)

- Build, on a Mac, from the repo root: `cd desktop && npm ci && npm run mac`
- Output in `desktop/dist/`: AI-gile dmg and zip, for both Intel (x64) and Apple silicon (arm64)
- Mac builds only work on macOS: electron-builder refuses on Windows/Linux ("Build for macOS is supported only on macOS")
- No Mac handy: run the `mac-build` workflow (Actions tab, Run workflow); the dmg and zip arrive as the `aigile-mac` artifact
- First open of an unsigned app: right-click the app, choose Open, confirm. Or `xattr -cr /Applications/AI-gile.app`
- Icon: electron-builder makes the icns from `public/icons/icon-512.png`

## Signing later

- Apple Developer account (paid) and a Developer ID Application certificate
- In `desktop/package.json` `build.mac`: set `identity` to the certificate name (or remove it), set `hardenedRuntime` true, `notarize` true
- Env for notarising: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- For CI: `CSC_LINK` (base64 p12) and `CSC_KEY_PASSWORD` as repo secrets, and drop `CSC_IDENTITY_AUTO_DISCOVERY` from the workflow
- Tracked on AIG-806
