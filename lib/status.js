// Your status (AIG-983/984/985/986): an owner pref `status`: online | idle | dnd | offline | rest. Teams see it in the brief.
// 🛌 rest (rest day) turns Going quiet on (night watch on every project, a 🛌 card to each team instead of 📣 Going quiet);
// while resting, only urgent cards reach the inbox and a lead's DM is refused: leads ask the 🧭 Lead Scrum Master, who lets
// only showstoppers through. Leaving rest ends quiet the way a wake-up time does, so the page shows the night's summary.
const STATUSES = ['online', 'idle', 'dnd', 'offline', 'rest'];
const quiet = () => require('./quiet');
// Rest only holds while quiet is on: ended from the 🌙 button or a wake-up time, the owner is back online.
const of = s => { const v = STATUSES.includes((s || {}).status) ? s.status : 'online'; return v === 'rest' && !quiet().quietSince() ? 'online' : v; };
// Asked once per card (store.isSnoozed), so the answer is kept for a second; set() clears it.
let memo = null;
const resting = () => { if (memo && Date.now() - memo.at < 1000) return memo.v; let v = false; try { v = of(require('./store').localSettings()) === 'rest'; } catch {} memo = { at: Date.now(), v }; return v; };
// A showstopper (money, the owner's data, all work stopped) is marked urgent: the rest waits until the owner is back.
const critical = c => c.priority === 'urgent';
const REST_MESSAGE = owner => [
  `- 🛌 **${owner} is on a rest day**`,
  `- Don't ask, task or DM ${owner}: send anything you need to the Lead Scrum Master (\`aigile msg <proj> "Scrum Master" "..." --as NAME\`)`,
  `- It passes on only showstoppers: money, ${owner}'s data, or all work stopped`,
  '- Everything else: assume (`aigile assume`), log it and carry on',
  '- Reply with one line (what you will be doing), then move this card to done',
].join('\n\n');
function set(s, v) {
  if (!STATUSES.includes(v)) throw require('./store').bad('status must be ' + STATUSES.join(', '));
  const was = of(s);
  if (v === 'online') delete s.status; else s.status = v;
  if (v === 'rest' && was !== 'rest' && !quiet().quietSince()) quiet().setQuiet(true, null, null, false, { title: '🛌 Rest day', message: REST_MESSAGE(require('./store').owner()) });
  if (v !== 'rest' && was === 'rest') quiet().setQuiet(false, null, null, true);
  memo = { at: Date.now(), v: v === 'rest' };   // the settings file is written after this returns
}
module.exports = { STATUSES, of, set, resting, critical };
