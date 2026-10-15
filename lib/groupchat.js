// 👥 Group chats (AIG-1027): the owner and two or more agents from any project's roster (e.g. a Codex designer and a Claude
// designer). One file per group, data/groups/<id>.chat = { id, name, members: [{ project, name }], created, msgs }.
// The owner's message wakes each member once: a one-shot hidden run with that member's own engine and model, in its project
// folder, under the presence key "<slug>#grp-<id>-<name>" (so the log, 👁 watch, Stop and In flight see it like a 🐝 worker).
// A member already running for this group gets "again" (one more run when it ends) instead of a second process. The member
// answers once with `aigile group say <id> "text" --as NAME`; members' answers never wake anyone.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, bad, isRich, owner, slugify, writeAtomic } = require('./store');

const DIR = path.join(DATA, 'groups');
const KEEP = 500;   // the newest messages kept per group
const okId = id => /^[a-z0-9-]{1,60}$/.test(String(id || ''));
const file = id => path.join(DIR, id + '.chat');
const tr = (k, v) => require('./i18n').t(k, v);

function read(id) {
  if (!okId(id)) return null;
  let raw; try { raw = fs.readFileSync(file(id), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  const g = JSON.parse(raw); if (!g || !Array.isArray(g.msgs) || !Array.isArray(g.members)) throw new Error('group file ' + id + '.chat is damaged');
  return g;
}
const need = id => { const g = read(id); if (!g) throw bad('no such group', 404); return g; };
const write = g => { fs.mkdirSync(DIR, { recursive: true }); writeAtomic(file(g.id), JSON.stringify(g)); };
function all() {
  let names = []; try { names = fs.readdirSync(DIR).filter(f => f.endsWith('.chat')); } catch {}
  return names.map(f => { try { return read(f.slice(0, -5)); } catch { return null; } }).filter(Boolean);
}

/* ---------- members ---------- */
const E = () => require('./engines');
const live = m => m && m.kind !== 'person' && !/retired/i.test(m.status || '');
// The roster entry behind a member, and its project (null when the project or the agent is gone).
function entry(mb) { const p = load(mb.project), m = p && (p.team || []).find(x => live(x) && x.name.toLowerCase() === String(mb.name).toLowerCase()); return m ? { p, m } : null; }
const engineOf = m => E().engineName(m);
const labelOf = e => (E().ENGINES[e] || {}).label || 'Claude';
// Everyone who can be picked: every agent on every active project's roster.
function candidates() {
  const S = require('./store');
  const isLead = m => /lead/i.test(m.name + ' ' + (m.role || ''));
  // AIG-1131: grouped by project (A to Z), each project's lead first
  return S.listSlugs().map(S.peek).filter(p => p && !p.archived).sort((a, b) => String(a.name).localeCompare(String(b.name))).flatMap(p => {
    const t = (p.team || []).filter(live), lead = t.find(isLead) || t[0];
    return t.map(m => { const e = engineOf(m); return { project: p.slug, projectName: p.name, name: m.name, role: m.role || '', engine: e, engineLabel: labelOf(e), lead: m === lead }; })
      .sort((a, b) => (b.lead - a.lead) || a.name.localeCompare(b.name));
  });
}

/* ---------- the chat ---------- */
function create(b) {
  const name = String((b && b.name) || '').trim().slice(0, 80);
  if (!name) throw bad('give the group a name');
  const seen = new Set(), members = [];
  for (const x of (b && Array.isArray(b.members) ? b.members : [])) {
    const project = String((x && x.project) || ''), who = String((x && x.name) || '').trim(), k = project + '|' + who.toLowerCase();
    if (!project || !who || seen.has(k)) continue;
    const hit = entry({ project, name: who }); if (!hit) throw bad(`no agent called "${who}" on ${project}`);
    seen.add(k); members.push({ project: hit.p.slug, name: hit.m.name });
  }
  if (members.length < 2) throw bad('pick at least two agents');
  let id; do { id = (slugify(name).slice(0, 30) || 'group') + '-' + require('crypto').randomBytes(2).toString('hex'); } while (fs.existsSync(file(id)));
  const g = { id, name, members, created: now(), msgs: [] };
  write(g); return view(g);
}
function add(g, m) { g.msgs.push(m); if (g.msgs.length > KEEP) g.msgs = g.msgs.slice(-KEEP); write(g); return m; }
// "Pixel (Codex)": the engine the message was said with, else the member's engine now.
const shown = (g, m) => m.mine || m.board ? m.author : `${m.author} (${labelOf(m.engine || 'claude')})`;
function view(g) {
  const members = g.members.map(mb => { const h = entry(mb), e = h ? engineOf(h.m) : 'claude'; return { ...mb, engine: e, engineLabel: labelOf(e), gone: !h, projectName: h ? h.p.name : mb.project }; });
  return { id: g.id, name: g.name, created: g.created, members };
}
// For the Messages list: each group with its last message.
function list() {
  return all().map(g => { const last = g.msgs.at(-1); return { ...view(g), last: last ? last.at : g.created, lastText: last ? shown(g, last) + ': ' + String(last.text || '').replace(/\s+/g, ' ').slice(0, 120) : '', lastMine: !!(last && last.mine) }; })
    .sort((a, b) => String(b.last).localeCompare(String(a.last)));
}
// The page's thread, in the shape of the other chats (one fold, like the 💚 assistant's).
function thread(id) {
  const g = need(id), v = view(g), CARD = '_group';
  return { slug: 'grp:' + g.id, group: true, groupId: g.id, name: v.members.map(m => m.name + ' (' + m.engineLabel + ')').join(', '), lead: g.name, emoji: '👥', members: v.members,
    open: [], cards: { [CARD]: { title: g.name, kind: 'other' } }, team: [], unread: 0,
    messages: g.msgs.map(m => ({ card: CARD, title: g.name, author: shown(g, m), text: m.text, at: m.at, mine: !!m.mine, project: m.project })) };
}
// The owner writes: saved, then each member is woken once.
function post(id, text) {
  const g = need(id); text = String(text || '').trim();
  if (!text) throw bad('text is required');
  add(g, { at: now(), author: owner(), text, mine: true });
  const woke = wake(g);
  return { ok: true, woke };
}
// A member answers. Matched by name (and project when two members share a name).
function say(id, b) {
  const g = need(id), as = String((b && b.as) || '').trim(), text = String((b && b.text) || '').trim(), proj = String((b && b.project) || '').trim().toLowerCase();
  if (!as) throw bad('who is it from? (--as NAME)');
  if (isRich(as)) throw bad('this is for the agents in the group; the owner writes in Messages');
  if (!text) throw bad('text is required');
  let hits = g.members.filter(mb => mb.name.toLowerCase() === as.toLowerCase());
  if (hits.length > 1 && proj) hits = hits.filter(mb => mb.project === proj || (load(mb.project) || {}).name === proj);
  if (!hits.length) throw bad(`${as} is not in the group "${g.name}": ${g.members.map(mb => mb.name).join(', ')}`);
  if (hits.length > 1) throw bad(`two members are called ${as}: add --project <slug>`);
  const mb = hits[0], h = entry(mb);
  return add(g, { at: now(), author: mb.name, project: mb.project, engine: h ? engineOf(h.m) : 'claude', text });
}
// The last n messages as text (for `aigile group show`).
function show(id, n) { const g = need(id), k = Math.max(1, Math.min(200, +n || 30)); return { ...view(g), messages: g.msgs.slice(-k).map(m => ({ at: m.at, author: shown(g, m), text: m.text, mine: !!m.mine })) }; }

/* ---------- waking the members ---------- */
const runKey = (g, mb) => mb.project + '#grp-' + g.id + '-' + (slugify(mb.name) || 'agent');
// No double quotes, %, angle brackets or newlines: spawnHidden runs the line through cmd.exe (as swarmworkers' PROMPT).
const clean = s => String(s || '').replace(/["%<>|&^]/g, ' ').replace(/\s*\r?\n\s*/g, ' / ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
function promptFor(g, mb, h) {
  const others = g.members.filter(x => x !== mb).map(x => { const o = entry(x); return `${x.name} (${labelOf(o ? engineOf(o.m) : 'claude')}, project ${x.project})`; }).join(', ');
  const clash = g.members.filter(x => x.name.toLowerCase() === mb.name.toLowerCase()).length > 1;
  // The last ~30 messages, newest kept first when the line gets long (a Windows command line has a limit).
  const lines = []; let size = 0;
  for (const m of g.msgs.slice(-30).reverse()) { const l = `[${String(m.at).slice(5, 16).replace('T', ' ')}] ${clean(shown(g, m))}: ${cut(clean(m.text), 400)}`; if (size + l.length > 3500) break; lines.unshift(l); size += l.length + 3; }
  return `You are ${clean(mb.name)}${h.m.role ? ' (' + clean(h.m.role) + ')' : ''} from project ${mb.project} on the AI-gile board, in a group chat called '${clean(g.name)}' (id ${g.id}) with ${owner()} and ${clean(others)}. ` +
    `${owner()} just wrote in the group. The latest messages, oldest first: ${lines.join(' -- ')} . The whole thread: aigile group show ${g.id} . ` +
    `Do what ${owner()} asks of you, then reply ONCE in the group: aigile group say ${g.id} 'your reply' --as '${clean(mb.name)}'${clash ? ' --project ' + mb.project : ''} . ` +
    `To share a file, save it in your project folder and give its full path in the reply. Speak for yourself only; the others answer on their own. ` +
    `Then stop. Do not start the wait command, do not work on board cards, never push.`;
}
// One member: guards like presence.startTeam (No Token Mode, AI off, swarm, budget, saver), then the run. Returns what happened.
function wakeOne(g, mb) {
  const P = require('./presence'), h = entry(mb), who = { project: mb.project, name: mb.name };
  if (!h) return { ...who, skipped: 'no longer on the roster' };
  const { p, m } = h, key = runKey(g, mb), run = P.runOf(key);
  if (run) { run.again = true; hook(g.id, mb, run); return { ...who, again: true, key }; }
  try {
    require('./notokens').guard();
    require('./today').aiOffGuard(p);
    if (!p.path) throw bad('connect a folder to this project first');
    if (!fs.existsSync(p.path)) throw bad(tr('srv.folder.missing', { path: p.path }));
    const sw = require('./swarm').status(); if (sw.on && sw.slug !== p.slug) throw bad('🚨 swarm on ' + sw.name);
    require('./budget').mayRun();
    require('./budget').saverGuard(p);
  } catch (e) { return { ...who, skipped: e.message || String(e) }; }
  // The max parallel runs setting (AIG-353) holds here too (AIG-1121): over it the member waits in line, one place per member.
  const cap = require('./budget').budget().parallel;
  if (cap && P.runCount() >= cap) { waitq.set(key, { id: g.id, project: mb.project, name: mb.name }); return { ...who, queued: true, key }; }
  waitq.delete(key);
  const En = E(), e = engineOf(m), model = e === 'claude' ? String(m.model || '').trim() : String(m[En.modelField(e)] || '').trim();
  let exe; try { exe = e === 'claude' ? P.agentCommand() : En.engineExe(e); } catch (x) { return { ...who, skipped: x.message }; }
  if (!exe) return { ...who, skipped: tr('srv.engine.no' + e) };
  if (e === 'gemini' && !En.geminiKeySet()) return { ...who, skipped: tr('srv.engine.nogeminikey') };
  const prompt = promptFor(g, mb, h);
  const args = e !== 'claude' ? En.ENGINES[e].args({ prompt: En.preambleFor(e) + prompt, model })
    : ['-p', prompt, '--session-id', require('crypto').randomUUID(), ...require('./swarmworkers').noPushArgs(), '--output-format', 'stream-json', '--verbose', ...(/^[a-z0-9.\-[\]]+$/i.test(model) ? ['--model', model] : [])];
  let r;
  try { r = P.startWorker(key, exe, args, { cwd: p.path, engine: e, branch: '', label: 'group ' + g.name, env: e === 'gemini' ? En.geminiEnv() : {} }); }
  catch (x) { return { ...who, skipped: x.message }; }
  hook(g.id, mb, r);
  return { ...who, started: true, engine: e, key };
}
// When a member's run ends with "again" set (the owner wrote while it ran): one more run, with the thread as it is now.
function hook(id, mb, run) {
  if (run.onEnd) return;
  run.onEnd = () => { if (!run.again) return; setImmediate(() => { try { const g = read(id), m = g && g.members.find(x => x.project === mb.project && x.name === mb.name); if (m) { const r = wakeOne(g, m); if (r.skipped) note(g, r); } } catch {} }); };
}
const note = (g, r) => { try { add(read(g.id) || g, { at: now(), author: 'Board', board: true, text: tr('srv.grp.skip', { name: r.name, why: r.skipped }) }); } catch {} };
const waitq = new Map();   // runKey -> { id, project, name }: members waiting for a free run place
// A run ended (presence.js): start queued members while places are free.
function drain() {
  const P = require('./presence');
  for (const [key, w] of [...waitq]) {
    const cap = require('./budget').budget().parallel;
    if (cap && P.runCount() >= cap) break;
    waitq.delete(key);
    try { const g = read(w.id), mb = g && g.members.find(x => x.project === w.project && x.name === w.name); if (mb) { const r = wakeOne(g, mb); if (r.skipped) note(g, r); } } catch {}
  }
}
function wake(g) {
  const out = g.members.map(mb => wakeOne(g, mb));
  for (const r of out) if (r.skipped) note(g, r);
  return out;
}

module.exports = { drain, candidates, create, list, thread, post, say, show, promptFor, runKey };
