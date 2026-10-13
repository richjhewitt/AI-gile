// API routes: retros (AIG-865), see lib/retro.js.
const retro = require('../retro');

module.exports = function routes() {
return [
  // { text, why, section?, card?, author } -> the retro card (🚦 waiting for the owner's Go / Not yet)
  ['POST', /^\/api\/projects\/([^/]+)\/retros$/, ([slug], b) => retro.add(slug, b || {})],
];
};
