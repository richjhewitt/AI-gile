// API routes: life admin without tokens and Start my day (AIG-797/798), see lib/lifeadmin.js. Plain code, nothing here wakes an agent.
module.exports = function routes() {
  const L = () => require('../lifeadmin');
return [
  ['GET', /^\/api\/lifeadmin$/, () => L().view()],
  ['POST', /^\/api\/lifeadmin\/reminders$/, (_, b) => L().addReminder(b)],
  ['POST', /^\/api\/lifeadmin\/lists$/, (_, b) => L().addList(b)],
  ['POST', /^\/api\/lifeadmin\/([a-z]\d+)\/items$/, ([id], b) => L().addItem(id, b)],
  ['POST', /^\/api\/lifeadmin\/([a-z]\d+)\/(tick|snooze)$/, ([id, op], b) => L().act(id, op, b || {})],
  ['DELETE', /^\/api\/lifeadmin\/([a-z]\d+)$/, ([id]) => L().act(id, 'delete')],
  ['GET', /^\/api\/daystart$/, () => L().day()],
  ['POST', /^\/api\/daystart\/seen$/, () => L().seen()],
];
};
