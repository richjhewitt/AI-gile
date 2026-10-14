// API route: 🚨 Major incident button (AIG-1049), see lib/major.js. The owner (the board's page or terminal) or the project's lead
// / on-call agent / the card's assignee may press it; pressing again ends it.
const { need, load } = require('./ctx');
const major = require('../major');

module.exports = function routes() {
return [
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/major$/, ([slug, id], b, _q, req) => {
    const p = need(load(slug)), c = major.find(p, id);
    if (!c) throw require('../store').bad('no such card', 404);
    let as = ''; try { as = decodeURIComponent(String(((req && req.headers) || {})['x-aigile-as'] || '')); } catch {}
    const S = require('../store');
    if (as && !S.isRich(as)) {
      const ok = [require('../dispatch').leadOf(p).name, require('../service').onCall(p), c.assignee].some(n => n && String(n).toLowerCase() === as.toLowerCase());
      if (!ok) throw S.bad('only the owner or the lead can press Major', 403);
    }
    const m = major.toggle(p, c, as);
    return { id: c.id, major: m };
  }],
];
};
