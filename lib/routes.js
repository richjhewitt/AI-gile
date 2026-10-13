// The API: each route is [method, regex, handler(params, body, query) -> JSON]. Throw bad() for errors.
// The routes live in lib/routes/*.js (helpers and requires in lib/routes/ctx.js); the order here is the match order.
const groups = [
  require('./routes/meta'),
  require('./routes/projects-cards'),
  require('./routes/allhands'),
  require('./routes/comments'),
  require('./routes/team-dms'),
  require('./routes/docs-inbox'),
  require('./routes/profiles'),
  require('./routes/emojis'),
  require('./routes/stats'),
  require('./routes/risks'),
  require('./routes/problems'),
  require('./routes/changes'),
  require('./routes/retro'),
  require('./routes/firewall'),
  require('./routes/phone'),
];

// meta() supplies the dev flag and build id that the server owns.
module.exports = function makeRoutes(meta) {
  return groups.flatMap(g => g(meta));
};
