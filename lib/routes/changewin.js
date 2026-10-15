// API routes: change windows (AIG-859), see lib/changewin.js. Reading is open to the board's people; setting is owner only.
const { need, load, save } = require('./ctx');
const cw = require('../changewin');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/change-windows$/, ([slug], _b, q) => {
    const p = need(load(slug)), v = cw.view(p);
    if (q && q.get('card')) {   // can this change card go live now?
      const c = (p.cards || []).find(x => x.id.toLowerCase() === String(q.get('card')).toLowerCase());
      if (!c) throw require('../store').bad('no such card', 404);
      if (c.type !== 'change') throw require('../store').bad(c.id + ' is not a change card');
      v.card = c.id; v.goLive = cw.check(p, c);
    }
    return v;
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/change-windows$/, ([slug], b, _q, req) => {
    require('../share').ownerOnly(req);
    const p = need(load(slug));
    b = b || {};
    cw.set(p, 'windows' in b ? b.windows : b.set);
    save(p);
    return cw.view(p);
  }],
];
};
