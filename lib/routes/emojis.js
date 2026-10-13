// API routes: custom emojis (AIG-648), see lib/emojis.js.
const { bad } = require('./ctx');
const E = require('../emojis');

module.exports = function routes() {
return [
  ['GET', /^\/api\/emojis$/, () => E.list()],
  ['POST', /^\/api\/emojis$/, (_, b) => E.add(b)],
  ['GET', /^\/api\/emojis\/([a-z0-9_]+)$/, ([name]) => { const f = E.fileOf(name); if (!f) throw bad('no such emoji', 404); return { __file: f }; }],
  ['DELETE', /^\/api\/emojis\/([a-z0-9_]+)$/, ([name]) => E.remove(name)],
];
};
