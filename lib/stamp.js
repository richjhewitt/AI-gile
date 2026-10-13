// A cheap change stamp (AIG-920): one short string that moves whenever anything a board window draws may have changed,
// so a page asks GET /api/stamp each second and fetches the big /api/projects/<slug> and /api/inbox only when it moved.
// It reads file names, sizes and times in the data folder (projects .json, lead chats .chat, firewall/snooze .conf), so any write
// counts, whoever made it (save(), writeAtomic, a hand edit), plus who is online or working (without the ticking clocks).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, listSlugs } = require('./store');

function stamp() {
  const parts = [];
  try {
    for (const f of fs.readdirSync(DATA)) {
      if (!/\.(json|chat|conf)$/.test(f) || f.endsWith('.tmp')) continue;
      try { const st = fs.statSync(path.join(DATA, f)); parts.push(f + ':' + st.size + ':' + st.mtimeMs); } catch {}
    }
  } catch {}
  try {
    const { presenceOf } = require('./presence');
    for (const s of listSlugs()) {
      const p = presenceOf(s);
      if (!p.online && !p.running && !p.queued && !p.opened && !(p.workers || []).length) continue;
      parts.push(s + JSON.stringify(p, (k, v) => k === 'waitingMs' || k === 'signAt' ? undefined : v));
    }
  } catch {}
  return crypto.createHash('md5').update(parts.join('\n')).digest('hex').slice(0, 12);
}
module.exports = { stamp };
