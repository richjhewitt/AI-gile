// API routes: 📱 your phone over your own network (AIG-868), see lib/phone.js. All but /pair answer on this computer only
// (server.js guard: a paired phone is refused /api/phone/*; /pair is the one call allowed on a phone host without a cookie).
const { bad } = require('./ctx');
const P = require('../phone');

module.exports = function routes() {
return [
  ['GET', /^\/api\/phone$/, () => P.shown()],
  ['GET', /^\/api\/phone\/tailscale$/, () => P.tailscale()],
  ['POST', /^\/api\/phone\/start$/, (_, b) => P.start(b)],
  ['DELETE', /^\/api\/phone\/devices\/([a-f0-9]+)$/, ([id]) => P.remove(id)],
  ['POST', /^\/api\/phone\/pair$/, (_, b, q, req) => { if (!req.aigilePair) throw bad('open the pairing link on your phone', 403); return P.pair(b, req.aigilePair); }],
];
};
