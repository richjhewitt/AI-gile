// Files and pasted screenshots attached to replies (AIG-77): stored in data/attachments/<slug>/<id>.
// Comments keep { id, name, type, size, path }; path is absolute so teams can open the file.
const fs = require('fs');
const path = require('path');
const tr = (k, v) => require('./i18n').t(k, v);
const crypto = require('crypto');
const { DATA, bad, load, isRich } = require('./store');
const T = require('./thumbs');

const MAX = 10 * 1024 * 1024;
const dirOf = slug => { if (/[\\/]|^\.\.?$/.test(String(slug))) throw bad(tr('srv.e.att404'), 404); return path.join(DATA, 'attachments', slug); };   // one folder name, never a way out
const safe = n => String(n || 'file').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
const fileOf = (slug, id) => {
  if (!/^[a-z0-9]+-[\w.\- ]+$/i.test(id)) throw bad(tr('srv.e.attid'), 404);
  const f = path.join(dirOf(slug), id);
  if (!fs.existsSync(f)) throw bad(tr('srv.e.att404'), 404);
  return f;
};

// Upload: { name, type, data: base64 }.
const saveAttachment = (slug, b) => saveBuffer(slug, b.name, b.type, Buffer.from(String(b.data || ''), 'base64'), b);
// The file itself, from the upload above or a finished resumable upload (lib/uploads.js); t: { thumb?, thumbType? }.
function saveBuffer(slug, name, type, buf, t) {
  if (!buf.length) throw bad(tr('srv.e.fileempty'));
  if (buf.length > MAX) throw bad(tr('srv.e.filemax', { mb: 10 }));
  const id = Date.now().toString(36) + crypto.randomBytes(8).toString('hex') + '-' + safe(name);   // AIG-1165: 64 random bits, not 24
  fs.mkdirSync(dirOf(slug), { recursive: true });
  fs.writeFileSync(path.join(dirOf(slug), id), buf);
  try { T.save(dirOf(slug), id, T.parse(t)); } catch {}   // a small copy for previews (AIG-1101); the upload stands without it
  return describe(slug, id, type);
}
// AIG-1165: a project's files are shown to people who can see the project: the page, a paired phone, the owner's own terminal,
// and the people on its team. Another project's team (a named caller not on this one) is refused. Uploading stays open to a
// team's hand-back (its --as name need not be on the team list); an upload in progress is its starter's only (lib/uploads.js).
function seeProject(req, slug) {
  if (slug !== '_watchman' && !load(slug)) throw bad(tr('srv.e.noproject'), 404);
  const h = (req && req.headers) || {}, where = h['x-aigile-where'];
  let as = ''; try { as = decodeURIComponent(String(h['x-aigile-as'] || '')).trim(); } catch {}
  if (!where || !as || (isRich(as) && where !== 'background')) return;
  const p = slug !== '_watchman' && load(slug);
  if (p && (p.team || []).some(m => m && String(m.name || '').trim().toLowerCase() === as.toLowerCase())) return;
  throw bad(tr('srv.at.team'), 403);
}
function describe(slug, id, type) {
  const f = fileOf(slug, id);
  return { id, name: id.replace(/^[a-z0-9]+-/i, ''), type: String(type || '').slice(0, 100), size: fs.statSync(f).size, path: f.replace(/\\/g, '/'), ...(T.find(dirOf(slug), id) ? { thumb: true } : {}) };
}
// For a comment: the uploaded ids, checked and described.
const attachmentsFor = (slug, list) => (Array.isArray(list) ? list : []).slice(0, 20).map(a => describe(slug, String(a.id || a), a.type));

// The small copy of an attachment, or null (older files have none: the original is shown).
const thumbOf = (slug, id) => { fileOf(slug, id); return T.find(dirOf(slug), id); };

module.exports = { saveAttachment, saveBuffer, seeProject, safe, attachmentsFor, fileOf, thumbOf, MAX };
