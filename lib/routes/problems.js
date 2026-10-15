// API routes: problem cards (AIG-887), see lib/problems.js.
const problems = require('../problems');
const improvements = require('../improvements');   // AIG-1157

module.exports = function routes() {
return [
  ['GET', /^\/api\/improvements$/, () => ({ items: improvements.all() })],
  ['GET', /^\/api\/known-errors$/, () => ({ errors: problems.knownAll() })],
  ['GET', /^\/api\/projects\/([^/]+)\/known-errors$/, ([slug]) => ({ errors: problems.known(slug) })],
  ['GET', /^\/api\/projects\/([^/]+)\/problems$/, ([slug]) => ({ problems: problems.list(slug) })],
  ['POST', /^\/api\/projects\/([^/]+)\/problems$/, ([slug], b) => problems.add(slug, b || {})],
  ['PATCH', /^\/api\/projects\/([^/]+)\/problems\/([^/]+)$/, ([slug, id], b) => problems.patch(slug, id, b || {})],
  ['POST', /^\/api\/projects\/([^/]+)\/problems\/([^/]+)\/link$/, ([slug, id], b) => problems.linkTo(slug, id, b || {})],
];
};
