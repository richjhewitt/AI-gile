// API routes: the message firewall's catches (AIG-839, lib/firewall.js) and the Assistant's bin (AIG-840).
const fw = require('../firewall');
const { bad } = require('../store');
// Posts a kept message as it would have been posted, through the real route, with the firewall skipped once.
const URLS = { chat: e => `/api/projects/${e.project}/leadchat`, dm: e => `/api/projects/${e.project}/dm` };
function post(e) {
  const url = (URLS[e.kind] || (x => `/api/projects/${x.project}/cards/${x.card}/comments`))(e);
  const body = { author: e.author, text: e.text, ...(e.mark ? { mark: e.mark } : {}), ...('needsYou' in e ? { needsYou: !!e.needsYou } : {}), ...(e.options ? { options: e.options } : {}), ...(e.attachments ? { attachments: e.attachments } : {}), ...(e.assume ? { assume: e.assume } : {}) };
  const r = require('../routes')(() => ({})).find(x => x[0] === 'POST' && x[1].test(url));
  if (!r) throw bad('cannot post this message any more');
  return fw.bypass(() => r[2](url.match(r[1]).slice(1), body, new URLSearchParams()));
}
module.exports = function routes() {
  return [
    // Newest first; ?project=slug narrows it. kept/today: how hard the firewall works (all catches in the bin, and since midnight).
    ['GET', /^\/api\/firewall$/, (_p, _b, q) => { const items = fw.list(q && q.get ? q.get('project') || '' : ''); return { items, ...fw.counts(items) }; }],
    // Let it through (AIG-840): posts the message once without the firewall, then takes it out of the bin.
    ['POST', /^\/api\/firewall\/([^/]+)\/release$/, ([id], _b, _q, req) => {
      require('../share').ownerOnly(req);   // only the owner lets a caught message through
      const e = fw.find(id); if (!e) throw bad('not in the bin', 404);
      post(e); fw.drop(id); return { released: true, id };
    }],
  ];
};
