// 🚨 Major incident (AIG-1049, docs/SERVICE-MGMT-PLAN.md phase 1): the owner or lead presses 🚨 Major on an incident card.
// c.major = { at, by, swarm (this card turned the swarm on), alerted, nudged? }. Pressing it turns the project's 🚨 swarm on,
// orders the on-call agent (lib/service.js onCall, else the lead) with a card comment and wakes them, sends the owner ONE
// Discord DM when a bot is linked, and a plain-code timer asks for a "Status:" line every 30 min (AIGILE_MAJOR_MS) while open.
// Pressing again or the card going done ends it (swarm off only when this card turned it on). No AI in the timer.
const { load, peek, save, now, bad, listSlugs, owner } = require('./store');
const { t: tr } = require('./i18n');

const MS = () => Number(process.env.AIGILE_MAJOR_MS) || 30 * 60 * 1000;
const find = (p, id) => (p.cards || []).find(c => c.id.toLowerCase() === String(id).toLowerCase());
const say = (c, text, extra) => { c.comments = c.comments || []; c.comments.push({ author: 'AI-gile', at: now(), text, ...extra }); c.updated = now(); };
const onCallOf = p => { try { return require('./service').onCall(p); } catch { return require('./dispatch').leadOf(p).name; } };

// Wake the on-call agent through the normal start path; the order rides on the next run's prompt.
function wake(p, c, name, text) {
  try { require('./dispatch').setHint(p.slug, `Major incident ${c.id}: ${name} is on call. ${text}`); } catch {}
  try { require('./presence').startTeam(p, true, false, false, true, true); } catch {}
}
// One Discord DM to the first user of the first linked bot; nothing when none is linked or Discord fails.
async function alert(p, c) {
  try {
    const d = require('./discord'), bot = d.bots().find(b => (b.users || []).length);
    if (bot) await d.dmUser(bot, bot.users[0], tr('srv.major.dm', { project: p.name, title: c.title }));
  } catch {}
}

// Press: on when off, off when on. `by` is the caller's name. Returns the card's major (or null once ended).
function toggle(p, c, by) {
  if (c.type !== 'incident') throw bad(c.id + ' is not an incident card');
  if (c.status === 'done') throw bad('the incident is already done');
  if (c.major) { end(p, c, by); save(p); return null; }
  // AIG-1327: the sample project's practice incident: no swarm, no wake, no Discord note, just the plain steps.
  if (p.sample) { c.major = { at: now(), by: by || owner(), swarm: false, alerted: false }; say(c, tr('sample.inc.major'), { major: true }); save(p); return c.major; }
  const sw = require('./swarm'), st = sw.status(), name = onCallOf(p);
  c.major = { at: now(), by: by || owner(), swarm: !st.on, alerted: true };
  if (!st.on) sw.set({ slug: p.slug, by: 'Major incident ' + c.id });
  say(c, tr('srv.major.order', { name, by: c.major.by }), { major: true });
  save(p);
  wake(p, c, name, tr('srv.major.hint', { id: c.id }));
  alert(p, c);   // exactly once: the flag above is set before this runs and only a new press makes a new major
  return c.major;
}
// End it (second press, or the card going done). The caller saves.
function end(p, c, by) {
  const m = c.major; if (!m) return;
  delete c.major;
  if (m.swarm) { const st = require('./swarm').status(); if (st.on && st.slug === p.slug) require('./swarm').set({ off: true }); }
  say(c, tr('srv.major.ended', { by: by || owner() }), { major: true });
}

// Timer: a status line is due when no "Status:" comment, nudge or the start is within the interval.
function tick(at = Date.now()) {
  for (const slug of listSlugs()) {
    let p; try { p = peek(slug); } catch { continue; }
    if (p && p.sample) continue;   // AIG-1327: no nudges or wakes on the practice incident   // read-only scan (AIG-1103): load() only for a project with a due incident
    if (!(p && p.cards || []).some(c => c.major && c.status !== 'done' && c.type === 'incident')) continue;
    try { p = load(slug); } catch { continue; }
    const due = (p && p.cards || []).filter(c => c.major && c.status !== 'done' && c.type === 'incident');
    for (const c of due) {
      const last = Math.max(Date.parse(c.major.at), Date.parse(c.major.nudged || 0) || 0, ...(c.comments || []).filter(m => /^\s*Status:/i.test(m.text || '')).map(m => Date.parse(m.at) || 0));
      if (at - last < MS()) continue;
      const name = onCallOf(p);
      c.major.nudged = new Date(at).toISOString();
      say(c, tr('srv.major.nudge', { name, mins: Math.round(MS() / 60000) || 1 }), { major: true });
      save(p);
      wake(p, c, name, tr('srv.major.nudgehint', { id: c.id }));
    }
  }
}
let timer = null;
function start() { if (!timer) { timer = setInterval(() => { try { tick(); } catch {} }, Math.max(200, Math.min(30000, MS() / 4))); timer.unref(); } }

module.exports = { toggle, end, tick, start, find };
