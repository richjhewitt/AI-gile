// API routes: configuration items (AIG-1122), see lib/ci.js. Reading is open; adding, changing and removing are the owner's.
const ci = require('../ci');
const own = req => require('../share').ownerOnly(req);

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/ci$/, ([slug]) => ci.view(slug)],
  ['POST', /^\/api\/projects\/([^/]+)\/ci$/, ([slug], b, _q, req) => { own(req); return ci.add(slug, b); }],
  ['PATCH', /^\/api\/projects\/([^/]+)\/ci\/([^/]+)$/, ([slug, id], b, _q, req) => { own(req); return ci.patch(slug, id, b); }],
  ['POST', /^\/api\/projects\/([^/]+)\/ci\/([^/]+)\/link$/, ([slug, id], b) => ci.link(slug, id, (b || {}).card, (b || {}).on)],
  ['DELETE', /^\/api\/projects\/([^/]+)\/ci\/([^/]+)$/, ([slug, id], _b, _q, req) => { own(req); return ci.remove(slug, id); }],
];
};
