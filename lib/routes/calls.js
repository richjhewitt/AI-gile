// API routes: 📞 calls in a friend's DM over the owner's LiveKit (AIG-1162), see lib/calls.js.
const C = require('../calls');

module.exports = function routes() {
return [
  ['GET', /^\/api\/calls$/, (_, b, q, req) => { require('../share').ownerOnly(req); return C.status(); }],   // never the secret
  // { url, key, secret? } or { clear: true }, with the secrets page token (like the Gemini key)
  ['POST', /^\/api\/calls$/, (_, b, q, req) => { require('../share').ownerOnly(req); require('../secrets').gate(req, (b || {}).token); return C.save(b || {}); }],
  ['GET', /^\/api\/calls\/dm\/([0-9a-f]{12})$/, ([cid], b, q, req) => C.dmState(req, cid)],
  ['POST', /^\/api\/calls\/dm\/([0-9a-f]{12})\/token$/, ([cid], b, q, req) => C.dmToken(req, cid, b || {})],   // { ring? }
];
};
