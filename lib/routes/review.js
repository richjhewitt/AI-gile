// API routes: monthly service review (AIG-1155), see lib/review.js. Reading is open; the summary is a single agent call.
const review = require('../review');

module.exports = function routes() {
return [
  ['GET', /^\/api\/projects\/([^/]+)\/review$/, ([slug], _b, q) => review.review(slug, (q && q.get && q.get('month')) || '')],
  ['POST', /^\/api\/projects\/([^/]+)\/review\/summary$/, ([slug], b) => review.summary(slug, (b || {}).month || '')],
];
};
