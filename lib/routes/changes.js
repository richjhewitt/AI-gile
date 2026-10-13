// API routes: change cards (AIG-857), see lib/changes.js.
const changes = require('../changes');
const gn = require('../gonogo');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/changes$/, ([slug]) => ({ changes: changes.list(slug) })],
  ['POST', /^\/api\/projects\/([^/]+)\/changes$/, ([slug], b) => changes.add(slug, b || {})],
  ['POST', /^\/api\/projects\/([^/]+)\/changes\/([^/]+)\/submit$/, ([slug, id], b, _q, req) => gn.submit(slug, id, b || {}, gn.voterOf(req))],   // AIG-858
  ['POST', /^\/api\/projects\/([^/]+)\/changes\/([^/]+)\/vote$/, ([slug, id], b, _q, req) => gn.vote(slug, id, gn.voterOf(req), b || {})],
  ['POST', /^\/api\/projects\/([^/]+)\/changes\/([^/]+)\/go-anyway$/, ([slug, id], b, _q, req) => { require('../share').ownerOnly(req); return gn.goAnyway(slug, id, b || {}); }],
  ['PATCH', /^\/api\/projects\/([^/]+)\/changes\/([^/]+)$/, ([slug, id], b) => changes.patch(slug, id, b || {})],
];
};
