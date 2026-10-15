// API routes: 👁️ expiry watch and backup check (AIG-1124, AIG-1126), see lib/ciwatch.js. Owner only.
const cw = require('../ciwatch');
const share = require('../share');

module.exports = function routes() {
return [
  ['POST', /^\/api\/ciwatch\/check$/, (_a, _b, _q, req) => { share.ownerOnly(req); return cw.check(); }],   // the check on demand (tests set data/ciwatch.stub)
  ['POST', /^\/api\/projects\/([^/]+)\/ci\/([^/]+)\/backed-up$/, ([slug, id], _b, _q, req) => { share.ownerOnly(req); return cw.backedUp(slug, id); }],
];
};
