// AI-gile desktop (AIG-76): the board in its own window. Starts the board server if it isn't running
// (left running on quit, so teams keep their board), then shows http://localhost:<port>.
const { app, BrowserWindow, shell, nativeTheme, nativeImage, screen, Tray, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const BASE = `http://localhost:${PORT}`;
const ICON = path.join(__dirname, 'icon.png'), ICON_WAITING = path.join(__dirname, 'icon-waiting.png');
// App logo (AIG-175): if one is set in Setup (png, jpg or ico), it is the window icon; else the default.
const DATA = path.resolve(process.env.AIGILE_DATA || path.join(ROOT, 'data'));
function appIcon() {
  try {
    const f = fs.readdirSync(path.join(DATA, 'logos')).find(n => /^_app\.(png|jpe?g|ico)$/i.test(n));
    const img = f && nativeImage.createFromPath(path.join(DATA, 'logos', f));
    if (img && !img.isEmpty()) return img;
  } catch {}
  return custom('icon.png') || ICON;
}
// Icon colours (AIG-400): Setup draws tinted copies of the icon into data/appicon/ (lib/appicon.js); used when present.
function custom(name) {
  const f = path.join(DATA, 'appicon', name);
  try { if (fs.existsSync(f)) { const img = nativeImage.createFromPath(f); if (!img.isEmpty()) return img; } } catch {}
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function up() { try { return (await fetch(BASE + '/api/meta')).ok; } catch { return false; } }

// Same as start-aigile.bat: node server.js in the AI-gile folder, detached and hidden.
async function ensureServer() {
  if (await up()) return true;
  const node = process.env.AIGILE_NODE || 'node', env = { ...process.env };   // dev mode comes from aigile.local.json now (AIG-253)
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(node, ['server.js'], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true, env }).unref();
  for (let i = 0; i < 50; i++) { await sleep(200); if (await up()) return true; }
  return false;
}

let win = null, twitchWin = null, tray = null;
/* ---------- popped-out cards survive a restart (AIG-144) ---------- */
// Open pop-outs (address and position) are kept in the app's own folder; closing one yourself forgets it.
const POPS = () => path.join(app.getPath('userData'), 'popouts.json');
const pops = new Map();   // window -> address
let quitting = false;
function savePops() {
  const list = [...pops].filter(([w]) => !w.isDestroyed()).map(([w, url]) => ({ url, bounds: w.getBounds() }));
  try { fs.writeFileSync(POPS(), JSON.stringify(list)); } catch {}
}
// Where each card's window last was (AIG-188), so one that opens again (AIG-183) comes back on the same screen and spot.
const PLACES = () => path.join(app.getPath('userData'), 'popout-places.json');
const places = () => { try { return JSON.parse(fs.readFileSync(PLACES(), 'utf8')); } catch { return {}; } };
const cardOf = url => (String(url).match(/#\/pop[^?#]*/) || [''])[0];   // a card (#/pop/…) or an inbox list (#/pop-inbox/…)
function rememberPlace(url, bounds) {
  const all = places(), k = cardOf(url); if (!k) return;
  delete all[k]; all[k] = bounds;
  const keys = Object.keys(all); for (const old of keys.slice(0, Math.max(0, keys.length - 100))) delete all[old];   // keep the last 100
  try { fs.writeFileSync(PLACES(), JSON.stringify(all)); } catch {}
}
// The saved spot for a card, if it is still on a connected screen (a screen that was unplugged would hide it).
function placeFor(url) {
  const b = places()[cardOf(url)]; if (!b) return null;
  const on = screen.getAllDisplays().some(d => { const a = d.workArea; return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40; });
  return on ? b : null;
}
function trackPop(w, url) {
  if (!url.includes('#/pop')) return;
  pops.set(w, url); savePops();
  const keep = () => { try { if (!w.isDestroyed()) rememberPlace(url, w.getBounds()); } catch {} };
  w.on('moved', () => { savePops(); keep(); }); w.on('resized', () => { savePops(); keep(); });
  w.on('close', keep);
  w.on('closed', () => { pops.delete(w); if (!quitting) savePops(); });
}
function reopenPops() {
  let list = []; try { list = JSON.parse(fs.readFileSync(POPS(), 'utf8')); } catch {}
  for (const p of list) if (String(p.url).startsWith(BASE + '/#/pop')) {
    const w = new BrowserWindow({ ...chrome(), ...(p.bounds || { width: 560, height: 780 }), alwaysOnTop: true });
    wire(w); trackPop(w, p.url); w.loadURL(p.url);
  }
}
// No Windows title bar (AIG-128): just the window buttons, in the board's own colours, over the page's top bar.
const bar = () => nativeTheme.shouldUseDarkColors ? { color: '#1b2029', symbolColor: '#e6e9ef', height: 36 } : { color: '#ffffff', symbolColor: '#1d2330', height: 36 };
const chrome = () => ({ autoHideMenuBar: true, icon: appIcon(), titleBarStyle: 'hidden', titleBarOverlay: bar() });
nativeTheme.on('updated', () => BrowserWindow.getAllWindows().forEach(w => { try { w.setTitleBarOverlay(bar()); } catch {} }));
// Link and navigation rules for any of our windows (the main one and popped-out cards).
function wire(w) {
  // Board links to other sites open in the normal browser; the board's own open in a new app window.
  // A popped-out card stays on top, so its steps stay visible while you work in another app (AIG-122).
  w.webContents.setWindowOpenHandler(({ url, frameName, features }) => {
    // The pretend friend's board (AIG-323) opens in a window of its own: a localhost address named aigile-pretend.
    // The Setup picker's phone size (AIG-468) comes as width/height in the features, about 412 by 860.
    if (frameName === 'aigile-pretend' && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url)) {
      const n = k => Number((String(features).match(new RegExp('(?:^|,)\\s*' + k + '=(\\d+)')) || [])[1]) || undefined;
      return { action: 'allow', overrideBrowserWindowOptions: { ...chrome(), width: n('width') || 1200, height: n('height') || 800 } };
    }
    // Twitch chat (AIG-666): its own window that stays on top, so clicking in AI-gile never hides it; same spot next time.
    if (frameName === 'aigile-twitch' && /^https:\/\/www\.twitch\.tv\//.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: appIcon(), width: 380, height: 720, ...(placeFor('#/pop-twitch') || {}), alwaysOnTop: true } };
    }
    if (url.startsWith(BASE)) return { action: 'allow', overrideBrowserWindowOptions: { ...chrome(), alwaysOnTop: url.includes('#/pop'), ...(url.includes('#/pop') ? placeFor(url) || {} : {}) } };
    shell.openExternal(url); return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (url === 'aigile://restart') { e.preventDefault(); quitting = true; savePops(); app.relaunch(); app.exit(0); return; }   // the 🔄 Restart app pill (AIG-83)
    // The page's theme pick (AIG-143): the window buttons and every window follow it.
    if (url.startsWith('aigile://theme/')) { e.preventDefault(); const t = url.slice(15); if (['system', 'light', 'dark'].includes(t)) nativeTheme.themeSource = t; return; }
    // Goodnight (AIG-228): only the night glance stays on screen.
    if (url === 'aigile://minimize') { e.preventDefault(); w.minimize(); return; }
    // After a native alert/confirm box Windows leaves typing dead until the window is refocused (AIG-84).
    if (url === 'aigile://refocus') { e.preventDefault(); w.blur(); w.focus(); w.webContents.focus(); return; }
    if (!url.startsWith(BASE)) { e.preventDefault(); shell.openExternal(url); }
  });
}
function open(ok) {
  win = new BrowserWindow({ width: 1400, height: 900, title: 'AI-gile', backgroundColor: '#ffffff', ...chrome() });
  wire(win);
  // Popped-out cards (AIG-122) get the same handling as the main window.
  win.webContents.on('did-create-window', (child, d) => {
    // Twitch chat keeps Twitch's own pages (sign-in too); other links open in the normal browser.
    if (d.frameName === 'aigile-twitch') {
      const twitch = u => /^https:\/\/([\w-]+\.)*twitch\.tv\//.test(u);
      child.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
      child.webContents.on('will-navigate', (e, url) => { if (!twitch(url)) { e.preventDefault(); shell.openExternal(url); } });
      const keep = () => { try { if (!child.isDestroyed()) rememberPlace('#/pop-twitch', child.getBounds()); } catch {} };
      child.on('moved', keep); child.on('resized', keep); child.on('close', keep);
      return;
    }
    wire(child); trackPop(child, d.url);
  });
  if (ok) { win.loadURL(BASE); reopenPops(); }
  else win.loadURL('data:text/html,' + encodeURIComponent(`<body style="font:15px system-ui;padding:24px"><h2>AI-gile didn't start</h2><p>Couldn't reach ${BASE}. Run <code>start-aigile.bat</code> in ${ROOT.replace(/</g, '')} and reopen this window.</p></body>`));
  // Taskbar badge: the page puts what's waiting on the owner in its title, "(3) AI-gile"; then the icon gets a purple diamond.
  // It's the window icon, not an overlay: small taskbar buttons draw overlays as a dot, and a count is unreadable there.
  // A missing or broken icon file must never show an error box (AIG-81): keep the current icon instead.
  win.on('page-title-updated', (e, title) => { try { const i = /^\(\d+\)/.test(title) ? custom('icon-waiting.png') || ICON_WAITING : appIcon(); win.setIcon(i); if (tray) tray.setImage(i); } catch {} });
  // X hides the main window to the tray (AIG-849); pop-outs stay. Quit (tray menu) closes the app, pop-outs too, and remembers them for next time.
  win.on('session-end', () => { quitting = true; savePops(); });
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); return; } quitting = true; savePops(); for (const w of pops.keys()) if (!w.isDestroyed()) w.close(); if (twitchWin && !twitchWin.isDestroyed()) twitchWin.close(); });
  win.on('closed', () => { win = null; });
  makeTray();
}
/* ---------- tray (AIG-849) ---------- */
function showMain() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function makeTray() {
  if (tray) return;
  try {
    tray = new Tray(appIcon());
    tray.setToolTip('AI-gile');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open', click: showMain }, { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; savePops(); app.quit(); } }]));
    tray.on('click', showMain);
  } catch { tray = null; }
}

// New build of the app itself (AIG-83): when any of its own files is newer than at start, the page shows a
// 🔄 Restart app pill (asked again every few seconds, so it survives a page refresh).
const OWN = () => fs.readdirSync(__dirname).filter(f => /\.(js|json|png|ico)$/.test(f)).map(f => fs.statSync(path.join(__dirname, f)).mtimeMs);
const STARTED_FILES = Math.max(...OWN());
setInterval(() => {
  try { if (win && Math.max(...OWN()) > STARTED_FILES) win.webContents.executeJavaScript('window.showRestartApp && window.showRestartApp()').catch(() => {}); } catch {}
}, 5000);

// A separate profile (for testing next to the real app) gets its own single-instance lock.
if (process.env.AIGILE_PROFILE) app.setPath('userData', process.env.AIGILE_PROFILE);
// One window only: opening the app again brings the existing window forward.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setAppUserModelId('AI-gile');
  app.on('second-instance', showMain);
  app.whenReady().then(async () => open(await ensureServer()));
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => app.quit());
}
