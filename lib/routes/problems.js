// API routes: problem cards (AIG-887), see lib/problems.js.
const problems = require('../problems');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/problems$/, ([slug]) => ({ problems: problems.list(slug) })],
  ['POST', /^\/api\/projects\/([^/]+)\/problems$/, ([slug], b) => problems.add(slug, b || {})],
  ['PATCH', /^\/api\/projects\/([^/]+)\/problems\/([^/]+)$/, ([slug, id], b) => problems.patch(slug, id, b || {})],
  ['POST', /^\/api\/projects\/([^/]+)\/problems\/([^/]+)\/link$/, ([slug, id], b) => problems.linkTo(slug, id, b || {})],
];
};
