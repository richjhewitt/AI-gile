// 🐞 Bug reports from Live testers (AIG-561). A tester on the 🧪 Live channel raises a bug as usual; with "Also send it to the
// AI-gile team" ticked, the board posts it to the relay (POST /bug: title, text, build, channel; no names, no files).
// The owner's board collects them: with "feedback": { "project": "<slug>" } in aigile.local.json it fetches every 15 minutes
// (GET /bug, signed with this board's relay key, which must be the relay's RELAY_STATS_KEY like for Business licences), files each
// as a bug card in that project's To do, then acks them so the relay deletes them.
// The relay: "feedback": { "relay": "https://..." }, else the relay set for DMs.
const { spawnSync } = require('child_process');
const { ROOT, bad, load, save, now, localSettings } = require('./store');

const EVERY_MS = 15 * 60e3;
const dm = () => require('./dm');
const conf = () => ({ ...(localSettings().feedback || {}), ...(process.env.AIGILE_FEEDBACK_PROJECT ? { project: process.env.AIGILE_FEEDBACK_PROJECT } : {}) });   // the env one is for tests
const relay = () => String(conf().relay || dm().relayAddress() || '').replace(/\/+$/, '');
let build = null;
const buildOf = () => build !== null ? build : (build = (() => { const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }); return r.status === 0 ? r.stdout.trim() : ''; })());

async function send(b) {
  const base = relay();
  if (!base) throw bad('no relay to send it to: set one in Setup (DMs)', 409);
  const title = String((b && b.title) || '').trim().slice(0, 140), text = String((b && b.text) || '').slice(0, 4000);
  if (!title && !text.trim()) throw bad('a title or some text is needed');
  let channel = '';
  try { channel = require('./channel').status().channel || ''; } catch {}
  const r = await fetch(base + '/bug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, text, build: buildOf(), channel }), signal: AbortSignal.timeout(15000) })
    .catch(e => { throw bad('could not reach the relay: ' + e.message, 502); });
  if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch {} throw bad(m || 'the relay said ' + r.status, r.status === 429 ? 429 : 502); }
  return { ok: true };
}

// The owner's side: file new reports as cards, then ack them. Returns how many were filed.
async function collect() {
  const slug = conf().project, base = relay();
  if (!slug || !base) return { filed: 0, off: true };
  const p = load(slug);
  if (!p) throw bad('feedback project "' + slug + '" not found', 404);
  const got = (await dm().relayCall(base, 'GET', '/bug')).bugs || [];
  const ids = [];
  for (const g of got) {
    const at = now();
    p.cards.push({ id: p.key + '-' + p.nextId++, title: '🐞 ' + (g.title || String(g.text).split('\n')[0].slice(0, 80) || 'Bug report'),
      description: (g.text ? g.text + '\n\n' : '') + `- From a ${({ live: '🧪 Live', stable: '📦 Stable' })[g.channel] || 'Live'} tester, build ${g.build || '?'} (${String(g.at || '').slice(0, 10)})`,
      testSteps: '', type: 'bug', priority: 'normal', status: 'todo', assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: 'Live tester',
      from: 'bug report', created: at, updated: at, comments: [] });
    ids.push(g.id);
  }
  if (ids.length) { save(p); await dm().relayCall(base, 'POST', '/bug/ack', { ids }); }
  return { filed: ids.length };
}

function start() {
  if (process.env.AIGILE_NO_BUG_FETCH) return;
  setTimeout(function tick() { collect().catch(() => {}); setTimeout(tick, EVERY_MS).unref(); }, 90e3).unref();
}

module.exports = { send, collect, start };
