// API routes: 💾 storage use and the tidy-up (AIG-718), see lib/storage.js. Owner only.
const { share } = require('./ctx');
const St = require('../storage');

module.exports = function routes() {
  const own = fn => (a, b, q, req) => { share.ownerOnly(req); return fn(a, b, q, req); };
  return [
    ['GET', /^\/api\/storage$/, own(() => St.usage())],
    ['POST', /^\/api\/storage\/tidy$/, own(async () => { const r = St.tidy(); return { ...r, ...(await St.usage(true)) }; })],
  ];
};
