// API routes: change roles (AIG-856), see lib/changeroles.js. Owner only: the page, or the CLI as the owner, never a team or a friend.
const roles = require('../changeroles');
const share = require('../share');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/change-roles$/, ([slug], _b, _q, req) => { share.ownerOnly(req); return roles.viewOf(slug); }],
  ['POST', /^\/api\/projects\/([^/]+)\/change-roles$/, ([slug], b, _q, req) => { share.ownerOnly(req); return roles.set(slug, b || {}); }],
];
};
