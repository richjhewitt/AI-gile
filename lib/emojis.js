// Custom emojis (AIG-648): your own picture + :name:, kept on this PC only in data/emojis/<name>.<ext> with an index.json.
// The page shrinks the picture to 64x64 first; the server still refuses anything over 32 KB or that is not a real image.
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');

const MAX = 32 * 1024;
const dir = () => path.join(DATA, 'emojis');
const indexFile = () => path.join(dir(), 'index.json');

function readIndex() {
  try { const j = JSON.parse(fs.readFileSync(indexFile(), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; }
}
function writeIndex(ix) {
  fs.mkdirSync(dir(), { recursive: true });
  const tmp = indexFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ix, null, 2));
  fs.renameSync(tmp, indexFile());
}
// The real type from the first bytes, so a renamed text file is not stored as a picture.
function sniff(b) {
  if (b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (b.length > 6 && /^GIF8[79]a$/.test(b.slice(0, 6).toString('latin1'))) return '.gif';
  if (b.length > 12 && b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  return '';
}
const list = () => Object.entries(readIndex()).map(([name, e]) => ({ name, ext: e.ext, url: `/api/emojis/${name}?v=${e.at}` })).sort((a, b) => a.name.localeCompare(b.name));

// { name, data: base64 }
function add(b) {
  b = b || {};
  const name = String(b.name || '').trim().replace(/^:|:$/g, '');
  if (!/^[a-z0-9_]{1,32}$/.test(name)) throw bad('the name can use lowercase letters, digits and _ (up to 32)');
  const ix = readIndex();
  if (ix[name]) throw bad(`:${name}: is already one of yours`, 409);
  const buf = Buffer.from(String(b.data || ''), 'base64');
  if (!buf.length) throw bad('the file is empty');
  if (buf.length > MAX) throw bad('the picture is still over 32 KB after shrinking; try a simpler one');
  const ext = sniff(buf);
  if (!ext) throw bad('the picture must be a png, gif, webp or jpg file');
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), name + ext), buf);
  ix[name] = { ext, at: Date.now() };
  writeIndex(ix);
  return list();
}
function remove(name) {
  const ix = readIndex(), e = ix[name];
  if (!e) throw bad('no such emoji', 404);
  try { fs.unlinkSync(path.join(dir(), name + e.ext)); } catch {}
  delete ix[name];
  writeIndex(ix);
  return list();
}
function fileOf(name) {
  const e = /^[a-z0-9_]{1,32}$/.test(name) && readIndex()[name];
  return e ? path.join(dir(), name + e.ext) : null;
}

/* ---------- from friends (AIG-650) ---------- */
// A DM that uses :name: of one of your emojis carries the small picture once (payload.emojis = { name: base64 }), the first
// time you use that name with that friend. What a friend sent is kept apart in data/emojis-from/<contact>/ and only shows in
// that friend's chat; "Save" copies one into your own list. Pictures are checked exactly like uploads.
const MAX_FROM = 200, MAX_PER_MSG = 16;
const safeId = id => /^[\w-]{1,64}$/.test(String(id));
const fromDir = cid => { if (!safeId(cid)) throw bad('bad contact', 404); return path.join(DATA, 'emojis-from', String(cid)); };
const fromIndex = cid => { try { const j = JSON.parse(fs.readFileSync(path.join(fromDir(cid), 'index.json'), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
const sentFile = cid => { if (!safeId(cid)) throw bad('bad contact', 404); return path.join(DATA, 'emojis-to', cid + '.json'); };
const sentIndex = cid => { try { const j = JSON.parse(fs.readFileSync(sentFile(cid), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
// For a message to a friend: the pictures of my emojis named in text that they have not had yet. Returns { emojis, mark }.
function forSend(cid, text) {
  const out = {}, ix = readIndex(), sent = sentIndex(cid), mark = {};
  for (const m of String(text || '').matchAll(/:([a-z0-9_]{1,32}):/g)) {
    const n = m[1], e = ix[n];
    if (!e || out[n] || sent[n] === e.at || Object.keys(out).length >= MAX_PER_MSG) continue;
    try { const b = fs.readFileSync(path.join(dir(), n + e.ext)); if (b.length && b.length <= MAX && sniff(b)) { out[n] = b.toString('base64'); mark[n] = e.at; } } catch {}
  }
  return { emojis: out, mark };
}
function markSent(cid, mark) {
  if (!mark || !Object.keys(mark).length) return;
  const f = sentFile(cid), sent = { ...sentIndex(cid), ...mark };
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(sent));
}
// What a friend sent: each one checked on its own (safe name, real image, at most 32 KB); a bad one is dropped, the rest kept.
function receive(cid, map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;
  const ix = fromIndex(cid); let n = 0;
  for (const [name, data] of Object.entries(map).slice(0, MAX_PER_MSG)) {
    if (!/^[a-z0-9_]{1,32}$/.test(name) || typeof data !== 'string' || data.length > MAX * 4 / 3 + 8) continue;
    const buf = Buffer.from(data, 'base64');
    if (!buf.length || buf.length > MAX) continue;
    const ext = sniff(buf); if (!ext) continue;
    if (!ix[name] && Object.keys(ix).length >= MAX_FROM) continue;
    const d = fromDir(cid);
    fs.mkdirSync(d, { recursive: true });
    if (ix[name] && ix[name].ext !== ext) { try { fs.unlinkSync(path.join(d, name + ix[name].ext)); } catch {} }
    fs.writeFileSync(path.join(d, name + ext), buf);
    ix[name] = { ext, at: Date.now() }; n++;
  }
  if (n) fs.writeFileSync(path.join(fromDir(cid), 'index.json'), JSON.stringify(ix, null, 2));
  return n;
}
const listFrom = cid => Object.entries(fromIndex(cid)).map(([name, e]) => ({ name, url: `/api/dms/contacts/${cid}/emojis/${name}?v=${e.at}` })).sort((a, b) => a.name.localeCompare(b.name));
function fileFrom(cid, name) {
  const e = /^[a-z0-9_]{1,32}$/.test(name) && fromIndex(cid)[name];
  return e ? path.join(fromDir(cid), name + e.ext) : null;
}
// Save one into my own list (under a new name when asked): the same checks as an upload.
function saveFrom(cid, name, b) {
  const f = fileFrom(cid, name);
  if (!f) throw bad('no such emoji from this friend', 404);
  return add({ name: (b && b.as) || name, data: fs.readFileSync(f).toString('base64') });
}
function removeFrom(cid) { try { fs.rmSync(fromDir(cid), { recursive: true, force: true }); } catch {} try { fs.unlinkSync(sentFile(cid)); } catch {} }
module.exports = { list, add, remove, fileOf, MAX, sniff, forSend, markSent, receive, listFrom, fileFrom, saveFrom, removeFrom };
