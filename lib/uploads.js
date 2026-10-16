// Resumable uploads with a progress bar and Cancel (AIG-1165), lifted from ChilledChat's chunked upload with its holes closed:
// - the board picks the upload id (32 hex) and the piece size; the file size, the number of pieces and each piece are capped
// - an upload belongs to whoever started it (X-Aigile-Where + X-Aigile-As), for the one project or DM it was started for
// - an unfinished upload expires (AIGILE_UPLOAD_TTL_MS, 2 hours), and only MAX_OPEN can be open at once
// - the pieces live in data/uploads/<id>/ (meta.json + <n>.part) and nowhere else; done joins them into a card attachment
//   (lib/attachments.js, served only to people who can see the project), or for a DM a file the next message takes.
const fs = require('fs');
const path = require('path');
const tr = (k, v) => require('./i18n').t(k, v);
const crypto = require('crypto');
const { DATA, bad } = require('./store');
const A = require('./attachments');

const DIR = path.join(DATA, 'uploads');
const CHUNK = 1024 * 1024;
const MAX = { project: A.MAX, dm: 8 * 1024 * 1024 };   // a DM's files go sealed in one message: lib/dm.js MAX_FILES
const MAX_CHUNKS = Math.ceil(Math.max(...Object.values(MAX)) / CHUNK);
const MAX_OPEN = 20;
const TTL = Number(process.env.AIGILE_UPLOAD_TTL_MS) || 2 * 3600e3;

const idOk = id => /^[0-9a-f]{32}$/.test(String(id));
const dirOf = id => { if (!idOk(id)) throw bad(tr('srv.up.none'), 404); return path.join(DIR, id); };
const metaFile = id => path.join(dirOf(id), 'meta.json');
const partOf = (id, n) => path.join(dirOf(id), n + '.part');
const readMeta = id => { try { return JSON.parse(fs.readFileSync(metaFile(id), 'utf8')); } catch { return null; } };
const writeMeta = (id, m) => { const f = metaFile(id); fs.writeFileSync(f + '.tmp', JSON.stringify(m), { mode: 0o600 }); fs.renameSync(f + '.tmp', f); };
const drop = id => { try { fs.rmSync(dirOf(id), { recursive: true, force: true }); } catch {} };
const stale = m => !m || Date.now() - (m.touched || 0) > TTL;
const sizeOf = (m, n) => n < m.chunks - 1 ? m.chunk : m.size - m.chunk * (m.chunks - 1);

// Expired, broken or stray entries go; returns how many uploads are still open.
function sweep() {
  let names = []; try { names = fs.readdirSync(DIR); } catch { return 0; }
  let open = 0;
  for (const n of names) {
    if (!idOk(n)) { try { fs.rmSync(path.join(DIR, n), { recursive: true, force: true }); } catch {} continue; }
    if (stale(readMeta(n))) drop(n); else open++;
  }
  return open;
}
setInterval(sweep, 10 * 60e3).unref();
sweep();

const whoOf = req => {
  const h = (req && req.headers) || {};
  let as = ''; try { as = decodeURIComponent(String(h['x-aigile-as'] || '')); } catch {}
  return String(h['x-aigile-where'] || '') + '|' + as.trim().toLowerCase();
};
// The caller's own upload for this scope ('project:<slug>' or 'dm:<contact>'); anyone else's is "no such upload".
function mine(scope, id, req) {
  const m = readMeta(id);
  if (!m || m.scope !== scope || m.who !== whoOf(req)) throw bad(tr('srv.up.none'), 404);
  if (stale(m)) { drop(id); throw bad(tr('srv.up.expired'), 404); }
  return m;
}
const received = (id, m) => { const out = []; for (let n = 0; n < m.chunks; n++) { try { if (fs.statSync(partOf(id, n)).size === sizeOf(m, n)) out.push(n); } catch {} } return out; };
const view = (id, m) => ({ id, chunk: m.chunk, chunks: m.chunks, size: m.size, received: received(id, m) });

// { name, type, size } -> { id, chunk, chunks, size, received: [] }
function start(scope, kind, b, req) {
  const size = Number(b && b.size);
  if (!Number.isInteger(size) || size < 1) throw bad(tr('srv.e.fileempty'));
  if (size > MAX[kind]) throw bad(tr('srv.e.filemax', { mb: MAX[kind] / 1048576 }), 413);
  const chunks = Math.ceil(size / CHUNK);
  if (chunks > MAX_CHUNKS) throw bad(tr('srv.up.pieces'), 413);
  if (sweep() >= MAX_OPEN) throw bad(tr('srv.up.many'), 429);
  const id = crypto.randomBytes(16).toString('hex'), t = Date.now();
  const m = { scope, who: whoOf(req), name: A.safe(b.name), type: String(b.type || '').slice(0, 100), size, chunk: CHUNK, chunks, created: t, touched: t };
  fs.mkdirSync(dirOf(id), { recursive: true, mode: 0o700 });
  writeMeta(id, m);
  return view(id, m);
}
const status = (scope, id, req) => view(id, mine(scope, id, req));

// One piece: { data: base64 } of exactly its size (the last one is what is left).
function chunk(scope, id, n, b, req) {
  const m = mine(scope, id, req);
  if (m.done) throw bad(tr('srv.up.done'), 409);
  n = Number(n);
  if (!Number.isInteger(n) || n < 0 || n >= m.chunks) throw bad(tr('srv.up.nopiece'), 400);
  const s = String((b && b.data) || '');
  if (s.length > Math.ceil(m.chunk / 3) * 4) throw bad(tr('srv.up.piecemax'), 413);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw bad('a piece must be base64');
  const buf = Buffer.from(s, 'base64');
  if (buf.length !== sizeOf(m, n)) throw bad(`piece ${n} should be ${sizeOf(m, n)} bytes`);
  const f = partOf(id, n);
  fs.writeFileSync(f + '.tmp', buf, { mode: 0o600 }); fs.renameSync(f + '.tmp', f);
  m.touched = Date.now(); writeMeta(id, m);
  return { received: received(id, m).length, chunks: m.chunks };
}

// All the pieces, joined; a missing one is a 409 (ask status, send it, then done again).
function join(scope, id, req) {
  const m = mine(scope, id, req);
  if (m.done) throw bad(tr('srv.up.done'), 409);
  const have = new Set(received(id, m)), missing = [...Array(m.chunks).keys()].filter(n => !have.has(n));
  if (missing.length) throw bad('pieces missing: ' + missing.slice(0, 10).join(', '), 409);
  const buf = Buffer.concat([...Array(m.chunks).keys()].map(n => fs.readFileSync(partOf(id, n))));
  if (buf.length !== m.size) throw bad(tr('srv.up.addup'), 409);
  return { m, buf };
}
// A card or chat attachment: { thumb?, thumbType? } like /attachments; returns what /attachments returns.
function finishProject(slug, id, b, req) {
  const { m, buf } = join('project:' + slug, id, req);
  const a = A.saveBuffer(slug, m.name, m.type, buf, b);
  drop(id);
  return a;
}
// A DM: the joined file waits here for the message ({ upload: id } in its attachments), then goes (or expires).
function finishDm(cid, id, req) {
  const scope = 'dm:' + cid, { m, buf } = join(scope, id, req);
  fs.writeFileSync(path.join(dirOf(id), 'file'), buf, { mode: 0o600 });
  for (let n = 0; n < m.chunks; n++) try { fs.unlinkSync(partOf(id, n)); } catch {}
  m.done = true; m.touched = Date.now(); writeMeta(id, m);
  return { upload: id, name: m.name, type: m.type, size: m.size };
}
// For the DM send route: { name, type, data: base64 } of a finished DM upload; drop it once the message has gone.
function takeDm(cid, id, req) {
  const m = mine('dm:' + cid, id, req);
  if (!m.done) throw bad(tr('srv.up.notdone'), 409);
  return { name: m.name, type: m.type, data: fs.readFileSync(path.join(dirOf(id), 'file')).toString('base64') };
}
function cancel(scope, id, req) { mine(scope, id, req); drop(id); return { ok: true }; }
const dropDm = (cid, id, req) => { try { mine('dm:' + cid, id, req); drop(id); } catch {} };

module.exports = { start, status, chunk, finishProject, finishDm, takeDm, dropDm, cancel, sweep, CHUNK, MAX, MAX_CHUNKS, MAX_OPEN, DIR };
