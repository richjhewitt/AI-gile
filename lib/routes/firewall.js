// API routes: the message firewall's catches (AIG-839, lib/firewall.js).
const fw = require('../firewall');
module.exports = function routes() {
  return [
    // Newest first; ?project=slug narrows it.
    ['GET', /^\/api\/firewall$/, (_p, _b, q) => ({ items: fw.list(q && q.get ? q.get('project') || '' : '') })],
  ];
};
