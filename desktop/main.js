// AI-gile desktop (AIG-76): the board in its own window. Starts the board server if it isn't running
// (left running on quit, so teams keep their board), then shows http://localhost:<port>.
const { app, BrowserWindow, shell, nativeTheme, nativeImage, screen, Tray, Menu, session, ipcMain, desktopCapturer, webContents } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const { clampBounds, pickBackground, THEMES, badgeCount, badgeBitmap } = require('./winstate');

// Packaged (AppImage): the board's files sit in resources/aigile and its data goes to the user's own folder (the AppImage is read-only).
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'aigile') : path.resolve(__dirname, '..');
if (app.isPackaged && !process.env.AIGILE_DATA) process.env.AIGILE_DATA = path.join(app.getPath('userData'), 'data');
// AIG-1231 (Windows installer): settings live next to the data too, as an update replaces the install folder (an older
// install that kept them in resources/aigile keeps using that file), and new projects go to Documents/AI-gile projects.
if (app.isPackaged && !process.env.AIGILE_LOCAL && !fs.existsSync(path.join(ROOT, 'aigile.local.json'))) {
  process.env.AIGILE_LOCAL = path.join(app.getPath('userData'), 'aigile.local.json');
  if (!fs.existsSync(process.env.AIGILE_LOCAL)) try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(process.env.AIGILE_LOCAL, JSON.stringify({ projectsFolder: path.join(app.getPath('documents'), 'AI-gile projects') }, null, 2)); } catch {}
}
// The installer writes its own file name ("AI-gile Setup (XXXX-XXXX).exe") next to the app: the board claims that invite
// code on its first start, and asks for the code when there was none (lib/join.js).
if (app.isPackaged && process.platform === 'win32') {
  if (!process.env.AIGILE_SETUP_NAME) process.env.AIGILE_SETUP_NAME = path.join(path.dirname(process.execPath), 'setup-name.txt');
  if (!process.env.AIGILE_CLAIM) process.env.AIGILE_CLAIM = '1';
}
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const BASE = `http://localhost:${PORT}`;   // keep "localhost": saved looks (theme, quick English, drafts) belong to this address (AIG-1092)
// AIG-1091/1092: resolve localhost straight to 127.0.0.1 (the board listens there only), skipping the slow IPv6 try
app.commandLine.appendSwitch('host-resolver-rules', 'MAP localhost 127.0.0.1');
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

async function up(timeout = 1000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try { const r = await fetch(BASE + '/api/meta', { signal: controller.signal }); if (r.body) await r.body.cancel(); return r.ok; }
  catch { return false; }
  finally { clearTimeout(timer); }
}
function portOccupied() {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: PORT });
    let settled = false;
    const finish = occupied => { if (settled) return; settled = true; socket.destroy(); resolve(occupied); };
    socket.setTimeout(3000);
    socket.once('connect', () => finish(true));
    socket.once('error', error => finish(error.code !== 'ECONNREFUSED'));
    socket.once('timeout', () => finish(true)); // uncertain: do not launch a duplicate
  });
}

// Same as start-aigile.bat: node server.js in the AI-gile folder, detached and hidden.
async function ensureServer() {
  const deadline = Date.now() + 10000;
  if (await up()) return true;
  // An unhealthy listener still owns the port; do not start a competing board.
  if (await portOccupied()) return false;
  const node = process.env.AIGILE_NODE || (app.isPackaged ? process.execPath : 'node'), env = { ...process.env };   // dev mode comes from aigile.local.json now (AIG-253)
  delete env.ELECTRON_RUN_AS_NODE;
  // AIG-1231: the installed app needs no Node of its own: the board runs on the Node inside this app.
  if (node === process.execPath) env.ELECTRON_RUN_AS_NODE = '1';
  // AIG-995: an app opened from the macOS Finder gets a bare PATH, so look where Homebrew and the node installer put node
  if (process.platform === 'darwin') env.PATH = [env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(':');
  let failed = false;
  try {
    const child = spawn(node, ['server.js'], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true, env });
    child.once('error', () => { failed = true; });
    child.once('exit', () => {}); // another starter may have won the port; keep probing until the deadline
    child.unref();
  } catch { return false; }
  while (!failed && Date.now() < deadline) {
    await sleep(Math.min(200, Math.max(0, deadline - Date.now())));
    if (failed) return false;
    const left = deadline - Date.now();
    if (left > 0 && await up(Math.min(1000, left))) return true;
  }
  return false;
}

let win = null, twitchWin = null, tray = null;
/* ---------- window memory and start-up colour (AIG-1272, AIG-1273) ---------- */
// The main window's size, spot and maximised state, and the theme pick, are kept in the app's own folder (window-state.json).
// The theme is the page's own pick, sent over with aigile://theme/, so the window can be the right colour before the page loads.
const STATE = () => path.join(app.getPath('userData'), 'window-state.json');
let ui = {};   // read in startLook (the AIGILE_PROFILE folder is only set later in the file)
let uiTimer = null;
function saveUi() { clearTimeout(uiTimer); uiTimer = null; try { fs.writeFileSync(STATE(), JSON.stringify(ui)); } catch {} }
function rememberWindow() {
  try {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    ui.max = win.isMaximized(); ui.bounds = win.getNormalBounds();   // the normal size even while maximised, so un-maximising comes back right
    if (!uiTimer) uiTimer = setTimeout(saveUi, 500);
  } catch {}
}
// Called once the app is ready (screens are only known then). Anything unreadable falls back to the old 1400 x 900.
function startLook() {
  try { ui = JSON.parse(fs.readFileSync(STATE(), 'utf8')) || {}; } catch { ui = {}; }
  if (THEMES.includes(ui.theme)) nativeTheme.themeSource = ui.theme === 'black' ? 'dark' : ui.theme;
  let size = { width: 1400, height: 900 };
  try { size = clampBounds(ui.bounds, screen.getAllDisplays().map(d => d.workArea)) || size; } catch {}
  return { size, max: ui.max === true, backgroundColor: pickBackground(ui.theme, nativeTheme.shouldUseDarkColors) };
}
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
const chrome = () => ({ autoHideMenuBar: true, icon: appIcon(), titleBarStyle: 'hidden', titleBarOverlay: bar(), webPreferences: { preload: path.join(__dirname, 'preload.js') } });   // preload: the share picker (AIG-1163)
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
    if (url.startsWith('aigile://theme/')) { e.preventDefault(); const t = url.slice(15); if (['system', 'light', 'dark', 'black'].includes(t)) { nativeTheme.themeSource = t === 'black' ? 'dark' : t; ui.theme = t; saveUi(); } return; }
    // Goodnight (AIG-228): only the night glance stays on screen.
    if (url === 'aigile://minimize') { e.preventDefault(); w.minimize(); return; }
    // After a native alert/confirm box Windows leaves typing dead until the window is refocused (AIG-84).
    if (url === 'aigile://show') { e.preventDefault(); showMain(); return; }   // a notification was clicked (AIG-1221)
    if (url === 'aigile://refocus') { e.preventDefault(); w.blur(); w.focus(); w.webContents.focus(); return; }
    if (!url.startsWith(BASE)) { e.preventDefault(); shell.openExternal(url); }
  });
}
// Start with Windows (AIG-1250): the login item starts the app with --hidden, so it sits in the tray with no window.
const HIDDEN = process.argv.includes('--hidden');
function open(ok) {
  const look = startLook();
  win = new BrowserWindow({ ...look.size, title: 'AI-gile', backgroundColor: look.backgroundColor, show: !HIDDEN, ...chrome() });
  if (look.max) win.maximize();   // AIG-1272: maximised stays maximised (its normal size is kept for un-maximising)
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) win.on(ev, rememberWindow);
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
  else win.loadURL('data:text/html,' + encodeURIComponent(`<body style="font:15px system-ui;padding:24px"><h2>AI-gile didn't start</h2><p>Couldn't reach ${BASE}. ${app.isPackaged ? 'Quit AI-gile (right-click its icon by the clock, Quit) and open it again.' : `Run <code>start-aigile.bat</code> in ${ROOT.replace(/</g, '')} and reopen this window.`}</p></body>`));
  // Taskbar badge: the page puts what's waiting on the owner in its title, "(3) AI-gile"; then the icon gets a purple diamond.
  // It's the window icon, not an overlay: small taskbar buttons draw overlays as a dot, and a count is unreadable there.
  // A missing or broken icon file must never show an error box (AIG-81): keep the current icon instead.
  win.on('page-title-updated', (e, title) => { try { const i = /^\(\d+\)/.test(title) ? custom('icon-waiting.png') || ICON_WAITING : appIcon(); win.setIcon(i); if (tray) tray.setImage(i); } catch {} });
  // X hides the main window to the tray (AIG-849); pop-outs stay. Quit (tray menu) closes the app, pop-outs too, and remembers them for next time.
  win.on('session-end', () => { quitting = true; savePops(); });
  win.on('close', e => { rememberWindow(); saveUi(); if (!quitting) { e.preventDefault(); win.hide(); return; } quitting = true; savePops(); for (const w of pops.keys()) if (!w.isDestroyed()) w.close(); if (twitchWin && !twitchWin.isDestroyed()) twitchWin.close(); });
  win.on('closed', () => { win = null; });
  makeTray();
}
/* ---------- tray (AIG-849) ---------- */
function showMain() {
  if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus();
  // Still on "AI-gile didn't start" (the board was restarting when the app opened): X only hides to the tray, so opening
  // the app again showed the same page for good. Try the board again and load it once it answers (AIG-920).
  if (win.webContents.getURL().startsWith('data:')) ensureServer().then(ok => { if (ok && win && !win.isDestroyed()) { win.loadURL(BASE); reopenPops(); } }).catch(() => {});
}
function makeTray() {
  if (tray) return;
  try {
    tray = new Tray(appIcon());
    tray.setToolTip('AI-gile');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open', click: showMain }, { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; savePops(); app.quit(); } }]));
    tray.on('click', showMain);
  } catch { tray = null; }
}

/* ---------- screen sharing (AIG-1163, after ChilledChat) ---------- */
// Electron has no picker of its own for getDisplayMedia: the app lists the screens and windows (with thumbnails) and the page
// shows them in its own dialog (desktop/preload.js, public/js/sharepick.js). Only the board itself may ask: exact origin, not a prefix.
const ORIGIN = new URL(BASE).origin;
const originOf = u => { try { return new URL(u).origin; } catch { return ''; } };
const picks = new Map();   // id -> { wc, sources, callback, audio, gone }
let pickSeq = 0;
function endPick(id, sourceId) {
  const p = picks.get(id); if (!p) return;
  picks.delete(id);
  try { p.wc.removeListener('destroyed', p.gone); p.wc.removeListener('did-navigate', p.gone); } catch {}
  const s = typeof sourceId === 'string' && p.sources.find(x => x.id === sourceId);
  try { if (s) p.callback(p.audio ? { video: s, audio: 'loopback' } : { video: s }); else p.callback(); } catch {}   // no arguments = no share
}
function sharePicker() {
  session.defaultSession.setDisplayMediaRequestHandler(async (req, callback) => {
    const frame = req.frame, wc = frame && webContents.fromFrame(frame);
    if (!wc || originOf(req.securityOrigin) !== ORIGIN || originOf(frame.origin) !== ORIGIN) { callback(); return; }
    let sources = [];
    try { sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } }); } catch {}
    if (!sources.length || wc.isDestroyed()) { callback(); return; }
    for (const [id, p] of picks) if (p.wc === wc) endPick(id, null);   // one picker per window: a new ask replaces the old one
    const id = ++pickSeq, gone = () => endPick(id, null);
    // System sound (loopback) only when the page asks for audio, and only on Windows (the only place Electron has it).
    picks.set(id, { wc, sources, callback, audio: !!req.audioRequested && process.platform === 'win32', gone });
    wc.once('destroyed', gone); wc.once('did-navigate', gone);   // the page went away or reloaded: no share
    wc.send('aigile:share-pick', { id, sources: sources.map(s => ({ id: s.id, name: s.name, screen: s.id.startsWith('screen:'), thumb: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '' })) });
  });
  // The page's answer: a source id from the list it was sent, or null for Cancel. Only the window that was asked can answer.
  ipcMain.on('aigile:share-picked', (e, a) => { const id = Number(a && a.id), p = picks.get(id); if (p && p.wc === e.sender) endPick(id, a.source); });
}

/* ---------- start with Windows (AIG-1250) ---------- */
// Opt-in, off by default, and only the board's own page may ask (exact origin). Only an installed app registers: a dev run would
// register electron.exe itself. Windows reads the login item from the registry, so a tick here survives updates and reboots.
function autoStart() {
  const can = app.isPackaged && process.platform === 'win32';
  const state = () => ({ can, on: can ? !!app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin : false });
  ipcMain.handle('aigile:autostart-get', e => originOf(e.senderFrame && e.senderFrame.url) === ORIGIN ? state() : { can: false, on: false });
  ipcMain.handle('aigile:autostart-set', (e, on) => {
    if (originOf(e.senderFrame && e.senderFrame.url) !== ORIGIN || !can) return state();
    try { app.setLoginItemSettings({ openAtLogin: on === true, args: ['--hidden'] }); } catch {}
    return state();
  });
}

/* ---------- unread count on the taskbar icon (AIG-1274) ---------- */
// The page counts what waits on you (For you + unread messages) and tells us through the preload. Windows: a red number as the
// overlay icon (the purple diamond window icon stays); macOS and Linux: the dock/launcher badge. Only the main window may set it.
let lastBadge = -1;
function setBadge(n) {
  n = badgeCount(n); if (n === lastBadge) return; lastBadge = n;
  try {
    if (process.platform === 'win32') {
      const b = badgeBitmap(n);
      if (win && !win.isDestroyed()) win.setOverlayIcon(b ? nativeImage.createFromBitmap(b.buffer, { width: b.width, height: b.height }) : null, n ? n + ' waiting' : '');
    } else app.setBadgeCount(n);
  } catch {}
}
ipcMain.on('aigile:badge', (e, n) => { if (win && !win.isDestroyed() && e.sender === win.webContents) setBadge(n); });

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
  app.whenReady().then(async () => { sharePicker(); autoStart(); open(await ensureServer()); });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => app.quit());
}
