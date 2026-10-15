// Files and pasted screenshots attached to replies (AIG-77): stored in data/attachments/<slug>/<id>.
// Comments keep { id, name, type, size, path }; path is absolute so teams can open the file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, bad } = require('./store');
const T = require('./thumbs');

const MAX = 10 * 1024 * 1024;
const dirOf = slug => { if (/[\\/]|^\.\.?$/.test(String(slug))) throw bad('attachment not found', 404); return path.join(DATA, 'attachments', slug); };   // one folder name, never a way out
const safe = n => String(n || 'file').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
const fileOf = (slug, id) => {
  if (!/^[a-z0-9]+-[\w.\- ]+$/i.test(id)) throw bad('bad attachment id', 404);
  const f = path.join(dirOf(slug), id);
  if (!fs.existsSync(f)) throw bad('attachment not found', 404);
  return f;
};

// Upload: { name, type, data: base64 }.
function saveAttachment(slug, b) {
  const buf = Buffer.from(String(b.data || ''), 'base64');
  if (!buf.length) throw bad('the file is empty');
  if (buf.length > MAX) throw bad('files can be up to 10 MB');
  const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + '-' + safe(b.name);
  fs.mkdirSync(dirOf(slug), { recursive: true });
  fs.writeFileSync(path.join(dirOf(slug), id), buf);
  try { T.save(dirOf(slug), id, T.parse(b)); } catch {}   // a small copy for previews (AIG-1101); the upload stands without it
  return describe(slug, id, b.type);
}
function describe(slug, id, type) {
  const f = fileOf(slug, id);
  return { id, name: id.replace(/^[a-z0-9]+-/i, ''), type: String(type || '').slice(0, 100), size: fs.statSync(f).size, path: f.replace(/\\/g, '/'), ...(T.find(dirOf(slug), id) ? { thumb: true } : {}) };
}
// For a comment: the uploaded ids, checked and described.
const attachmentsFor = (slug, list) => (Array.isArray(list) ? list : []).slice(0, 20).map(a => describe(slug, String(a.id || a), a.type));

// The small copy of an attachment, or null (older files have none: the original is shown).
const thumbOf = (slug, id) => { fileOf(slug, id); return T.find(dirOf(slug), id); };

module.exports = { saveAttachment, attachmentsFor, fileOf, thumbOf, MAX };
