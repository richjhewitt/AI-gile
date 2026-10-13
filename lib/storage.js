// 💾 How much disk AI-gile uses (AIG-718): totals by kind under data/, and one tidy-up: the attachment files of cards
// that were closed (done) more than 30 days ago. Walks asynchronously, never follows a symlink, never leaves data/.
const fs = require('fs');
const path = require('path');
const { DATA, load, save, listSlugs } = require('./store');

const AGE_DAYS = 30, CACHE_MS = 60 * 1000, MAX_DEPTH = 12;
const KINDS = ['board', 'attachments', 'screenshots', 'logs', 'other'];
let cache = null;

// Which kind a path belongs to: its first folder under data/ (files straight in data/ are board data).
const kindOf = top => !top ? 'board' : top === 'attachments' ? 'attachments' : top === 'logs' ? 'logs' : /screenshot/i.test(top) ? 'screenshots' : 'other';

async function walk(dir, kind, sums, depth) {
  let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.isSymbolicLink()) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < MAX_DEPTH) await walk(f, kind || kindOf(e.name), sums, depth + 1); }
    else if (e.isFile()) {
      let st; try { st = await fs.promises.lstat(f); } catch { continue; }
      const k = kind || 'board';
      sums[k].bytes += st.size; sums[k].files++;
    }
  }
}

function candidates() {
  const cut = Date.now() - AGE_DAYS * 86400000, found = [];
  for (const slug of listSlugs()) {
    let p; try { p = load(slug); } catch { continue; }
    if (!p) continue;
    const seen = new Set();
    const live = new Set();   // ids still used by a card that stays
    const idsOf = c => [...(c.attachments || []), ...(c.comments || []).flatMap(m => m.attachments || [])].map(a => String(a && a.id || a || ''));
    for (const c of p.cards || []) {
      const old = c.status === 'done' && Date.parse(c.updated) < cut;
      if (!old) idsOf(c).forEach(i => live.add(i));
    }
    for (const c of p.cards || []) {
      if (!(c.status === 'done' && Date.parse(c.updated) < cut)) continue;
      for (const id of idsOf(c)) {
        if (!/^[a-z0-9]+-[\w.\- ]+$/i.test(id) || seen.has(id) || live.has(id)) continue;
        seen.add(id);
        const f = path.join(DATA, 'attachments', slug, id);
        try { const st = fs.lstatSync(f); if (st.isFile() && !st.isSymbolicLink()) found.push({ slug, id, file: f, size: st.size }); } catch {}
      }
    }
  }
  return found;
}

async function usage(fresh) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.v;
  const sums = Object.fromEntries(KINDS.map(k => [k, { bytes: 0, files: 0 }]));
  await walk(DATA, '', sums, 0);
  const kinds = KINDS.map(k => ({ kind: k, ...sums[k] }));
  const total = kinds.reduce((n, k) => n + k.bytes, 0);
  const biggest = total ? kinds.slice().sort((a, b) => b.bytes - a.bytes)[0].kind : '';
  const c = candidates();
  const v = { kinds, total, biggest, tidy: { days: AGE_DAYS, files: c.length, bytes: c.reduce((n, x) => n + x.size, 0) } };
  cache = { at: Date.now(), v };
  return v;
}

// Deletes exactly those files and their references on the cards; nothing else.
function tidy() {
  const c = candidates(), gone = new Set(c.map(x => x.slug + '/' + x.id));
  let removed = 0, bytes = 0;
  for (const x of c) { try { fs.unlinkSync(x.file); removed++; bytes += x.size; } catch {} }
  for (const slug of new Set(c.map(x => x.slug))) {
    const p = load(slug); if (!p) continue;
    const keep = a => (a || []).filter(f => !gone.has(slug + '/' + String(f && f.id || f)));
    for (const card of p.cards || []) {
      if (!(card.status === 'done' && Date.parse(card.updated) < Date.now() - AGE_DAYS * 86400000)) continue;
      if (card.attachments) card.attachments = keep(card.attachments);
      for (const m of card.comments || []) if (m.attachments) { m.attachments = keep(m.attachments); if (!m.attachments.length) delete m.attachments; }
    }
    save(p);
  }
  cache = null;
  return { removed, bytes };
}

module.exports = { usage, tidy };
