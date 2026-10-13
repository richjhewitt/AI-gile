// API routes: the risk register (AIG-863), see lib/risks.js.
const { need, load } = require('./ctx');
const risks = require('../risks');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/risks$/, ([slug]) => { need(load(slug)); return { risks: risks.list(slug), overdue: risks.overdueCount(slug) }; }],
  ['POST', /^\/api\/projects\/([^/]+)\/risks$/, ([slug], b) => { need(load(slug)); return risks.add(slug, b || {}); }],
  ['PATCH', /^\/api\/projects\/([^/]+)\/risks\/([^/]+)$/, ([slug, id], b) => { need(load(slug)); return risks.patch(slug, id, b || {}); }],
];
};
