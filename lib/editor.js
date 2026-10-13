// ✏️ Small code editor inside a card (AIG-536): open, edit and save a text file without leaving the board, for small
// code changes and the permission files an agent can't edit itself (.claude/settings*.json).
// Fence: the board page only (the terminal's token), and only files INSIDE a connected project folder (the owner's pick
// "A": any file in a connected folder, its .claude files included). Real paths are compared, so a link or ".." can't
// leave the folder. Every save keeps the previous version in data/editor-backups, and a .json file must parse first.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, bad } = require('./store');

const MAX_BYTES = 512 * 1024;
const BACKUPS = path.join(DATA, 'editor-backups');
const SKIP_DIR = /(^|[\\/])(\.git|node_modules)([\\/]|$)/i;

// The real file for { project, path }, or a refusal. path is relative to the project folder.
function resolveFile(slug, rel) {
  const p = load(String(slug || ''));
  if (!p || !p.path) throw bad('connect a folder to this project first (🔌 Connect folder)', 404);
  const root = fs.realpathSync(p.path);
  const r = String(rel || '').trim().replace(/^["']|["']$/g, '');
  if (!r) throw bad('which file?');
  if (path.isAbsolute(r) && path.relative(root, path.resolve(r)).startsWith('..')) throw bad('that file is outside the project folder', 403);
  const abs = path.resolve(root, r);
  const inside = f => { const x = path.relative(root, f); return x === '' || (!x.startsWith('..') && !path.isAbsolute(x)); };
  if (!inside(abs)) throw bad('that file is outside the project folder', 403);
  if (SKIP_DIR.test(path.relative(root, abs))) throw bad('.git and node_modules are not for editing here', 403);
  // The real location must be inside too (a link pointing out is refused); a new file checks its folder.
  // (a new file in a new folder: the nearest folder that exists is the one to check.)
  let real = abs;
  if (fs.existsSync(abs)) real = fs.realpathSync(abs);
  else {
    let up = path.dirname(abs); const tail = [path.basename(abs)];
    while (!fs.existsSync(up) && up !== path.dirname(up)) { tail.unshift(path.basename(up)); up = path.dirname(up); }
    real = path.join(fs.realpathSync(up), ...tail);
  }
  if (!inside(real)) throw bad('that file is outside the project folder', 403);
  return { abs: real, root, rel: path.relative(root, real).replace(/\\/g, '/'), slug: p.slug };
}

function read(b) {
  const f = resolveFile(b.project, b.path);
  if (!fs.existsSync(f.abs)) return { path: f.rel, exists: false, content: '', mtime: 0 };
  const st = fs.statSync(f.abs);
  if (!st.isFile()) throw bad('that is a folder', 400);
  if (st.size > MAX_BYTES) throw bad('that file is too big for the small editor (over 512 KB)', 413);
  const buf = fs.readFileSync(f.abs);
  if (buf.includes(0)) throw bad('that looks like a binary file', 415);
  return { path: f.rel, exists: true, content: buf.toString('utf8'), mtime: st.mtimeMs };
}

function save(b) {
  const f = resolveFile(b.project, b.path);
  require('./safefolder').guard(f.abs, 'save a file');   // AIG-944
  const content = String(b.content ?? '');
  if (Buffer.byteLength(content) > MAX_BYTES) throw bad('too big for the small editor (over 512 KB)', 413);
  if (/\.json$/i.test(f.abs)) { try { JSON.parse(content); } catch (e) { throw bad('not saved: this is not valid JSON (' + e.message + ')', 422); } }
  let backup = '';
  if (fs.existsSync(f.abs)) {
    const st = fs.statSync(f.abs);
    if (!st.isFile()) throw bad('that is a folder', 400);
    // Changed on disk since it was opened: refuse, so a team's edit is not silently overwritten.
    if (b.mtime && Math.abs(st.mtimeMs - Number(b.mtime)) > 1) throw bad('the file changed on disk since you opened it: reopen it first', 409);
    const dir = path.join(BACKUPS, f.slug);
    fs.mkdirSync(dir, { recursive: true });
    backup = path.join(dir, now().replace(/[:.]/g, '-') + '-' + path.basename(f.abs));
    fs.copyFileSync(f.abs, backup);
  } else fs.mkdirSync(path.dirname(f.abs), { recursive: true });
  fs.writeFileSync(f.abs, content);
  return { ok: true, path: f.rel, mtime: fs.statSync(f.abs).mtimeMs, backedUp: !!backup };
}

// The permission files worth a quick button: the project's own .claude settings.
function quick(slug) {
  const p = load(String(slug || ''));
  if (!p || !p.path) throw bad('connect a folder to this project first', 404);
  return ['.claude/settings.local.json', '.claude/settings.json', 'CLAUDE.md'].map(rel => ({ path: rel, exists: fs.existsSync(path.join(p.path, rel)) }));
}

module.exports = { read, save, quick, resolveFile };
