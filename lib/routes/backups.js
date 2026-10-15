// API routes: 🗄️ daily backups and putting a board back (AIG-1258, AIG-1259), see lib/backup.js. Owner only.
const { share } = require('./ctx');
const B = require('../backup');

module.exports = function routes() {
  const own = fn => (a, b, q, req) => { share.ownerOnly(req); return fn(a, b, q, req); };
  return [
    ['GET', /^\/api\/backups$/, own(() => B.status())],
    ['POST', /^\/api\/backups\/run$/, own(() => ({ ...B.daily(), ...B.status() }))],
    ['POST', /^\/api\/backups\/restore$/, own((_, b) => B.restore(b))],
  ];
};
