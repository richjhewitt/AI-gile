// API routes: project stats (AIG-726/727), see lib/stats.js.
const { bad } = require('./ctx');
const { stats } = require('../stats');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/stats$/, async ([slug]) => { const s = await stats(slug); if (!s) throw bad('no such project', 404); return s; }],
];
};
