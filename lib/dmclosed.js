// AIG-917: chats the owner closed in the Messages list (hidden, never deleted). data/dmclosed.conf: { "<chat key>": "<closed at>" }.
// The page shows a chat again when its latest message is newer than the close time. Not .json: every .json in data/ is a project.
const fs = require('fs');
const path = require('path');
const { DATA, now } = require('./store');
const FILE = path.join(DATA, 'dmclosed.conf');
const read = () => { try { const o = JSON.parse(fs.readFileSync(FILE, 'utf8')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
const set = (key, closed) => {
  key = String(key || '').slice(0, 300); if (!key || key === '_allhands') return read();
  const o = read(); if (closed) o[key] = now(); else delete o[key];
  try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(o)); } catch {}
  return o;
};
module.exports = { read, set };
