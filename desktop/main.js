// AI-gile desktop (AIG-76): the board in its own window. Starts the board server if it isn't running
// (left running on quit, so teams keep their board), then shows http://localhost:<port>.
const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const BASE = `http://localhost:${PORT}`;
const ICON = path.join(__dirname, 'icon.png'), ICON_WAITING = path.join(__dirname, 'icon-waiting.png');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function up() { try { return (await fetch(BASE + '/api/meta')).ok; } catch { return false; } }

// Same as start-aigile.bat: node server.js in the AI-gile folder, detached and hidden.
async function ensureServer() {
  if (await up()) return true;
  const node = process.env.AIGILE_NODE || 'node', env = { ...process.env, AIGILE_DEV: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(node, ['server.js'], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true, env }).unref();
  for (let i = 0; i < 50; i++) { await sleep(200); if (await up()) return true; }
  return false;
}

let win = null;
// Link and navigation rules for any of our windows (the main one and popped-out cards).
function wire(w) {
  // Board links to other sites open in the normal browser; the board's own open in a new app window.
  // A popped-out card stays on top, so its steps stay visible while you work in another app (AIG-122).
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICON, alwaysOnTop: url.includes('#/pop/') } };
    shell.openExternal(url); return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (url === 'aigile://restart') { e.preventDefault(); app.relaunch(); app.exit(0); return; }   // the 🔄 Restart app pill (AIG-83)
    // After a native alert/confirm box Windows leaves typing dead until the window is refocused (AIG-84).
    if (url === 'aigile://refocus') { e.preventDefault(); w.blur(); w.focus(); w.webContents.focus(); return; }
    if (!url.startsWith(BASE)) { e.preventDefault(); shell.openExternal(url); }
  });
}
function open(ok) {
  win = new BrowserWindow({ width: 1400, height: 900, title: 'AI-gile', icon: ICON, autoHideMenuBar: true, backgroundColor: '#ffffff' });
  wire(win);
  // Popped-out cards (AIG-122) get the same handling as the main window.
  win.webContents.on('did-create-window', child => wire(child));
  if (ok) win.loadURL(BASE);
  else win.loadURL('data:text/html,' + encodeURIComponent(`<body style="font:15px system-ui;padding:24px"><h2>AI-gile didn't start</h2><p>Couldn't reach ${BASE}. Run <code>start-aigile.bat</code> in ${ROOT.replace(/</g, '')} and reopen this window.</p></body>`));
  // Taskbar badge: the page puts what's waiting on Rich in its title, "(3) AI-gile"; then the icon gets a purple diamond.
  // It's the window icon, not an overlay: small taskbar buttons draw overlays as a dot, and a count is unreadable there.
  // A missing or broken icon file must never show an error box (AIG-81): keep the current icon instead.
  win.on('page-title-updated', (e, title) => { try { win.setIcon(/^\(\d+\)/.test(title) ? ICON_WAITING : ICON); } catch {} });
  win.on('closed', () => { win = null; });
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
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => open(await ensureServer()));
  app.on('window-all-closed', () => app.quit());
}
