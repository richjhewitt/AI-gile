// AI-gile desktop (AIG-76): the board in its own window. Starts the board server if it isn't running
// (left running on quit, so teams keep their board), then shows http://localhost:<port>.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const BASE = `http://localhost:${PORT}`;
const ICON = path.join(__dirname, 'icon.png');
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
function open(ok) {
  win = new BrowserWindow({ width: 1400, height: 900, title: 'AI-gile', icon: ICON, autoHideMenuBar: true, backgroundColor: '#ffffff' });
  // Board links to other sites open in the normal browser, not in this window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(BASE)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(BASE)) { e.preventDefault(); shell.openExternal(url); } });
  if (ok) win.loadURL(BASE);
  else win.loadURL('data:text/html,' + encodeURIComponent(`<body style="font:15px system-ui;padding:24px"><h2>AI-gile didn't start</h2><p>Couldn't reach ${BASE}. Run <code>start-aigile.bat</code> in ${ROOT.replace(/</g, '')} and reopen this window.</p></body>`));
  win.on('closed', () => { win = null; });
}

// One window only: opening the app again brings the existing window forward.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setAppUserModelId('AI-gile');
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => open(await ensureServer()));
  app.on('window-all-closed', () => app.quit());
}
