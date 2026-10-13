// aigile open <proj> <id> --as NAME (AIG-758): an agent asks the board to pop a card open for the owner.
// In memory only (a restart forgets them). The page polls GET /api/opencard?front=1|0.
// With the app in front, new requests come back in `auto` (the page opens the card's pop-out) and leave the list.
// Without it they stay and come back in `chips` (the page shows a chip to click later); a request that was shown as a
// chip is never auto-opened later. A chip is cleared with DELETE /api/opencard/:n (clicked or dismissed).
const S = require('./store');
const MAX = 20, TTL = 6 * 3600e3;
let seq = 0, list = [];
const fresh = () => { const t = Date.now() - TTL; list = list.filter(e => e.ms > t); };
const view = ({ ms, chipped, ...e }) => e;

function add(slug, id, by) {
  const p = S.need(S.load(slug)), c = S.findCard(p, id);
  fresh();
  list = list.filter(e => !(e.slug === p.slug && e.id === c.id));   // one entry per card
  const e = { n: ++seq, slug: p.slug, id: c.id, title: c.title, by: String(by || '').slice(0, 60), at: S.now(), ms: Date.now(), chipped: false };
  list.push(e); if (list.length > MAX) list.shift();
  return view(e);
}
function poll(front) {
  fresh();
  if (!front) { list.forEach(e => { e.chipped = true; }); return { front: false, auto: [], chips: list.map(view) }; }
  const auto = list.filter(e => !e.chipped);
  list = list.filter(e => e.chipped);
  return { front: true, auto: auto.map(view), chips: list.map(view) };
}
function drop(n) { const was = list.length; list = list.filter(e => e.n !== Number(n)); return { ok: true, removed: was - list.length }; }

module.exports = { add, poll, drop };
