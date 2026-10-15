// API routes: runbooks (AIG-1107), see lib/runbooks.js.
const runbooks = require('../runbooks');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/runbooks$/, ([slug]) => runbooks.list(slug)],
  ['GET', /^\/api\/projects\/([^/]+)\/runbooks\/(.+)$/, ([slug, name]) => runbooks.read(slug, name)],
  ['GET', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/runbooks$/, ([slug, id]) => runbooks.ofCard(slug, id)],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/runbook$/, ([slug, id], b) => runbooks.link(slug, id, b)],
];
};
