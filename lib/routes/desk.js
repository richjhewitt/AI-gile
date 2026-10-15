// API route: 🛎️ service desk kind on a card (AIG-1104), see lib/desk.js. Owner only.
const { need, load, save, findCard } = require('./ctx');
const desk = require('../desk');

module.exports = function routes() {
return [
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/desk$/, ([slug, id], b, _q, req) => {
    require('../share').ownerOnly(req);
    const p = need(load(slug)), c = findCard(p, id);
    desk.setKind(p, c, (b || {}).kind);
    save(p);
    return { id: c.id, type: c.type, desk: c.desk };
  }],
  // 🔎 Link a card to the one it looks like (AIG-1105)
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/desk-link$/, ([slug, id], _b, _q, req) => {
    require('../share').ownerOnly(req);
    const p = need(load(slug)), c = findCard(p, id);
    const d = desk.link(p, c);
    save(p);
    return { id: c.id, desk: d };
  }],
];
};
