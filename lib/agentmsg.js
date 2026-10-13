// Agents message each other (AIG-675): `aigile msg <proj> <to> "text" --as NAME`. <to> is a roster name, Lead, or
// Scrum Master. Kept as p.agentMsgs (old projects simply have none) and as a closed 💬 card so the owner sees it in the
// chat, labelled "NAME → TO". It is never the owner's: not news (ownerNews), not an instruction.
const { now, load, save, isRich, bad, need, leadOf } = require('./routes/ctx');
const SM = /^(lead\s+)?scrum\s*master$/i;

function send(slug, b) {
  const p = need(load(slug)), text = String(b.text || '').trim(), from = String(b.from || '').trim(), to = String(b.to || '').trim();
  if (!from) throw bad('who is it from? (--as NAME)');
  if (isRich(from)) throw bad('this is for agents; the owner writes in the chat');
  if (!to) throw bad('who is it to?');
  if (!text) throw bad('text is required');
  const team = (p.team || []).filter(m => !/retired/i.test(m.status || ''));
  let target, sm = false;
  if (SM.test(to)) { target = '🧭 Lead Scrum Master'; sm = true; }
  else if (/^lead$/i.test(to)) target = leadOf(p);
  else { const m = team.find(m => m.name.toLowerCase() === to.toLowerCase()); if (!m) throw bad(`no one called "${to}" on ${p.name}: use ${['Lead', 'Scrum Master', ...team.map(m => m.name)].join(', ')}`); target = m.name; }
  if (from.toLowerCase() === target.toLowerCase()) throw bad('that is you');
  const at = now();
  const c = { id: p.key + '-' + p.nextId++, title: `💬 ${from} → ${target}: ` + text.split('\n')[0].slice(0, 60), description: `(agent to agent: ${from} → ${target})\n${text}`, testSteps: '', type: 'task', priority: 'low', status: 'done',
    assignee: '', sprint: '', blocked: false, needsYou: false, quick: true, dm: true, agentMsg: { from, to: target }, createdBy: from, created: at, updated: at, comments: [] };
  p.cards.push(c);
  if (!sm) (p.agentMsgs = p.agentMsgs || []).push({ id: c.id, at, from, to: target, text });
  save(p);
  const woke = sm ? !!require('./watchman').fromAgent(from, text, p.name) : wakeLead(p.slug);
  return { ok: true, id: c.id, to: target, woke };
}

// The same start as the owner's news gets, but allowed with no owner news: the pending message is the reason.
// Tests stub it: AIGILE_AGENTMSG_WAKE=file gets the slug appended and nothing is started.
function wakeLead(slug) {
  if (process.env.AIGILE_AGENTMSG_WAKE) { try { require('fs').appendFileSync(process.env.AIGILE_AGENTMSG_WAKE, slug + '\n'); } catch {} return true; }
  try { require('./presence').startTeam(load(slug), false, false, undefined, true, false, true); return true; } catch { return false; }
}

// Not yet handed to a lead; `markSeen` moves them on (updates?mark=1).
const pending = p => (p.agentMsgs || []).filter(m => !m.seen);
function markSeen(p) { let n = 0; for (const m of p.agentMsgs || []) if (!m.seen) { m.seen = now(); n++; } return n; }

module.exports = { send, pending, markSeen };
