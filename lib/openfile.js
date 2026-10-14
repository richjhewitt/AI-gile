// 📝 Open in your editor (AIG-156): opens a file the owner clicked (a path in a card or chat) in the editor
// picked in Setup ("editor": a command such as code, cursor or notepad++), else VS Code if it's installed,
// else the system's default app for that file.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { localSettings, bad } = require('./store');

const win = process.platform === 'win32';
let codeFound = null;   // is VS Code's command on the PATH? (checked once)
const hasCode = () => codeFound ?? (codeFound = spawnSync(win ? 'where' : 'which', ['code'], { windowsHide: true }).status === 0);

function openInEditor(file) {
  const f = path.resolve(String(file || '').trim().replace(/^["']|["']$/g, ''));
  // Quotes and % could break out of the quoted path in the shell; Windows file names can't contain quotes anyway.
  if (/["%`$]/.test(f)) throw bad('that path has characters I will not pass to a shell');
  if (!fs.existsSync(f)) throw bad('file not found: ' + f, 404);
  // A folder (AIG-240): open it in Explorer / Finder, not the editor.
  if (fs.statSync(f).isDirectory()) {
    if (process.env.AIGILE_NO_WINDOWS) return { ok: true, file: f.replace(/\\/g, '/'), with: 'folder' };   // tests: nothing pops up
    // Explorer wants Windows slashes (AIG-398): with C:/ paths it can open somewhere else.
    require('./platform').openPath(f, { folder: true });
    return { ok: true, file: f.replace(/\\/g, '/'), with: 'folder' };
  }
  // A web page (AIG-294) opens with the system default, i.e. the browser, not the editor.
  const page = /\.html?$/i.test(f);
  const editor = page ? '' : String(localSettings().editor || '').trim() || (hasCode() ? 'code' : '');
  const quiet = { detached: true, stdio: 'ignore', windowsHide: true };
  if (editor) spawn(`${editor} "${f}"`, { ...quiet, shell: true }).unref();
  else if (process.env.AIGILE_NO_WINDOWS) {}   // tests: nothing pops up on the owner's screen
  else require('./platform').openPath(f);
  return { ok: true, file: f.replace(/\\/g, '/'), with: editor || (page ? 'browser' : 'system default') };
}

module.exports = { openInEditor };
