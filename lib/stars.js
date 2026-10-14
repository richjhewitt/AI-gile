// ★ Starred messages (AIG-975): kept in step with the phone app (AII-141). One list per project in data/<slug>.stars
// (not .json: every .json in data/ is a project). A star is { chat, key }: chat is the fold in /api/chats/<slug>
// ('_lead' for the Lead chat, else the card id), key is the message's `at` time.
const fs = require('fs');
const path = require('path');
const { DATA, now, writeAtomic } = require('./store');

const file = slug => path.join(DATA, String(slug).replace(/[\/\\]/g, '') + '.stars');
const MAX = 2000, LEN = 100;
const read = slug => { try { const j = JSON.parse(fs.readFileSync(file(slug), 'utf8')); return Array.isArray(j.stars) ? j.stars : []; } catch { return []; } };
const write = (slug, stars) => writeAtomic(file(slug), JSON.stringify({ stars }));
const clean = s => { const chat = String((s && s.chat) || '').trim(), key = String((s && s.key) || '').trim(); return chat && key && chat.length <= LEN && key.length <= LEN ? { chat, key } : null; };
const same = (a, b) => a.chat === b.chat && a.key === b.key;

function list(slug) { return read(slug); }
// Star or unstar one message. Returns the whole list.
function set(slug, star, on = true) {
  const s = clean(star); if (!s) throw new Error('chat and key are required (up to ' + LEN + ' characters each)');
  const stars = read(slug).filter(x => !same(x, s));
  if (on) stars.push({ ...s, at: now() });
  write(slug, stars.slice(-MAX)); return stars.slice(-MAX);
}
// The phone's whole list replaces the board's (its first sync: the phone wins).
function replace(slug, all) {
  if (!Array.isArray(all)) throw new Error('stars must be a list');
  const out = []; for (const x of all.map(clean)) if (x && !out.some(y => same(x, y))) out.push({ ...x, at: now() });
  write(slug, out.slice(-MAX)); return out.slice(-MAX);
}
module.exports = { list, set, replace };
