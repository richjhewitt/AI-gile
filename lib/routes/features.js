// API routes: personal builds, features switched on for one friend (AIG-847), see lib/features.js.
// Owner only, except GET /api/features/mine (this board's own switches, read by the page).
const { share } = require('./ctx');
const Fe = require('../features');

module.exports = function routes() {
  const own = fn => (a, b, q, req) => { share.ownerOnly(req); return fn(a, b, q, req); };
  return [
    ['GET', /^\/api\/features\/mine$/, () => ({ keys: Fe.mine() })],
    ['GET', /^\/api\/features$/, own(() => Fe.list())],
    ['POST', /^\/api\/features$/, own((_, b) => Fe.set(b))],
    ['DELETE', /^\/api\/features\/([a-z0-9-]+)$/, own(([key]) => Fe.remove(key))],
    ['POST', /^\/api\/features\/([a-z0-9-]+)\/friends\/([0-9a-f]{12})$/, own(async ([key, id], b) => { const r = Fe.give(key, id, !(b && b.on === false)); r.pushed = await Fe.push(id); return r; })],
  ];
};
