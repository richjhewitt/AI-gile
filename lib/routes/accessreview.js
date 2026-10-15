// API routes: 🔐 access review (AIG-1127), see lib/accessreview.js. Owner only: the page, or the CLI as the owner, never a team or a friend.
const ar = require('../accessreview');
const share = require('../share');

module.exports = function routes() {
return [
  ['POST', /^\/api\/accessreview\/run$/, (_a, _b, _q, req) => { share.ownerOnly(req); return ar.run(); }],
  ['POST', /^\/api\/accessreview\/check$/, (_a, _b, _q, req) => { share.ownerOnly(req); return ar.check(); }],   // the daily check on demand (tests set data/accessreview.stub)
  ['GET', /^\/api\/projects\/([^/]+)\/accessreview\/([^/]+)$/, ([slug, id], _b, _q, req) => { share.ownerOnly(req); return ar.view(slug, id); }],
  ['POST', /^\/api\/projects\/([^/]+)\/accessreview\/([^/]+)$/, ([slug, id], b, _q, req) => { share.ownerOnly(req); return ar.act(slug, id, b); }],   // { item, action: keep|remove }
];
};
