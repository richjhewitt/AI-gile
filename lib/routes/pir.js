// API routes: post-incident review (AIG-1108), see lib/pir.js.
const pir = require('../pir');
const share = require('../share');

module.exports = function routes() {
return [
  // { timeline, helped, actions: [..] | "a | b", author } -> the incident card with its review
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/review$/, ([slug, id], b) => pir.post(slug, id, b || {})],
  // The owner ticks an action item: { i, on }
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/review\/tick$/, ([slug, id], b, _q, req) => { share.ownerOnly(req); return pir.tick(slug, id, Number(b && b.i), !(b && b.on === false)); }],
  // "Make a card" on one action item: { i }
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/review\/card$/, ([slug, id], b, _q, req) => { share.ownerOnly(req); return pir.makeCard(slug, id, Number(b && b.i)); }],
];
};
