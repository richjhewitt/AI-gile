// API routes: releases per project (AIG-1154), see lib/releases.js. Reading is open; creating and rolling back are the owner's and a lead's.
const rel = require('../releases');

// Who asks: no name and not a background run = the owner at the terminal or the page; otherwise the --as name (X-Aigile-As).
function asOf(req) {
  const h = (req && req.headers) || {};
  let as = ''; try { as = decodeURIComponent(String(h['x-aigile-as'] || '')); } catch {}
  if (!as && h['x-aigile-where']) throw require('../store').bad('--as NAME is required', 400);
  return as;
}

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/releases$/, ([slug]) => rel.list(slug)],
  ['POST', /^\/api\/projects\/([^/]+)\/releases$/, ([slug], b, _q, req) => rel.create(slug, b || {}, asOf(req))],
  ['POST', /^\/api\/projects\/([^/]+)\/releases\/([^/]+)\/rollback$/, ([slug, name], _b, _q, req) => rel.rollback(slug, decodeURIComponent(name), asOf(req))],
];
};
