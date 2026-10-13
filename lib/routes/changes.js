// API routes: change cards (AIG-857), see lib/changes.js.
const changes = require('../changes');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/changes$/, ([slug]) => ({ changes: changes.list(slug) })],
  ['POST', /^\/api\/projects\/([^/]+)\/changes$/, ([slug], b) => changes.add(slug, b || {})],
  ['PATCH', /^\/api\/projects\/([^/]+)\/changes\/([^/]+)$/, ([slug, id], b) => changes.patch(slug, id, b || {})],
];
};
