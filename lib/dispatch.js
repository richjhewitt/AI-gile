// 🛎️ Dispatcher (AIG-364): who answers the owner's new card or comment. Waking the wrong agent costs a whole start-up
// (its context) just to hear "not me", so: plain rules first (free), one tiny Haiku call only when the rules cannot
// decide (it picks once, never climbs to a bigger model), or just "the lead decides everything". ⚙️ Setup: dispatch =
// 'rules' | 'haiku' (default) | 'lead' (aigile.local.json "dispatch"). Every decision goes in the project log.
const os = require('os');
const { load, save, now, localSettings } = require('./store');

const MODES = ['rules', 'haiku', 'lead'];
const modeOf = () => { const m = localSettings().dispatch; return MODES.includes(m) ? m : 'haiku'; };

const active = p => (p.team || []).filter(m => !/retired/i.test(m.status || ''));
const leadOf = p => { const t = active(p); return t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0] || { name: 'Lead' }; };
const isTester = m => /test|qa\b|quality/i.test(m.name + ' ' + (m.role || ''));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BUILD = /\b(build|built|implement|fix|bug|broken|change|add|make|code|refactor|rewrite|style|css|layout|endpoint|api|button|rename|remove|update|should|needs? to|doesn'?t work|not working)\b/i;
const effStatus = c => (c.status === 'team' && c.prevStatus) || c.status;

// Team members the text names: "@Pixel" anywhere, or "Pixel, ..." / "Pixel: ..." at the start of a line.
function named(p, text) {
  return active(p).filter(m => new RegExp('(^|[^\\w@])@' + esc(m.name) + '\\b|(^|\\n)\\s*' + esc(m.name) + '\\s*[,:]', 'i').test(text));
}

// Rules only. { role, why } when decided, { unclear: true, why } when they cannot say (a cheap guess is in role).
function dispatch(p, c, m) {
  const text = String((m && m.text) || '') || [c.title, c.description].filter(Boolean).join('\n');
  const lead = leadOf(p), st = effStatus(c), mem = active(p);
  if (/^💬/.test(c.title || '') || c.kind === 'dm') return { role: lead.name, why: 'rule dm-to-lead' };
  const hit = named(p, text);
  if (hit.length === 1) return { role: hit[0].name, why: 'rule named-member' };
  if (hit.length > 1) return { role: lead.name, unclear: true, why: 'several members named' };
  const testers = mem.filter(isTester), a = String(c.assignee || '').trim();
  const asg = mem.filter(x => a && a.toLowerCase().split(/[,&/+]| and /).map(s => s.trim()).includes(x.name.toLowerCase()));
  if (testers.length && (st === 'verify' || (c.testSteps && asg.some(isTester) && st !== 'done'))) return { role: (asg.find(isTester) || testers[0]).name, why: 'rule test-card-to-tester' };
  if (asg.length > 1) return { role: lead.name, unclear: true, why: 'several assignees' };
  const one = asg[0];
  if (one && one.name !== lead.name && !isTester(one)) {
    if (BUILD.test(text)) return { role: one.name, why: 'rule building-to-assignee' };
    if (text.length > 160 && !/\?/.test(text)) return { role: lead.name, unclear: true, why: 'assigned card, ambiguous comment' };
  }
  return { role: lead.name, why: 'rule default-lead' };
}

// Haiku, once: the minimal prompt, one turn, no tools, user settings only, from a neutral folder (no project notes).
function askHaiku(p, c, m) {
  const { agentCommand, spawnAgent } = require('./presence');
  return new Promise(resolve => {
    const names = active(p).map(x => x.name + (x.role ? ' (' + x.role + ')' : '')), text = String((m && m.text) || c.description || c.title || '').slice(0, 300);
    const prompt = `Team roles: ${names.join(', ') || 'Lead'}. The project owner wrote on card "${String(c.title).slice(0, 80)}" (assigned to ${c.assignee || 'nobody'}, status ${effStatus(c)}): "${text}". Which ONE role should answer? Reply with only the role name.`;
    let out = '', done = false;
    const end = v => { if (done) return; done = true; clearTimeout(t); resolve(v); };
    let child, t;
    try {
      child = spawnAgent(agentCommand(), ['-p', prompt, '--model', 'haiku', '--max-turns', '1', '--tools', '', '--setting-sources', 'user'], { cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { return resolve(null); }
    t = setTimeout(() => { try { child.kill(); } catch {} end(null); }, 45e3);
    child.stdout.on('data', d => out += d);
    child.on('error', () => end(null));
    child.on('exit', () => { const lo = out.toLowerCase(); end(active(p).find(x => lo.includes(x.name.toLowerCase())) || null); });
  });
}

// ⛔ No Token Mode / budget guard (when this board has one): no AI calls at all, rules only.
function aiAllowed() {
  try { if (require('./budget').overBudget()) return false; } catch {}
  try { if (require('./notokens').isOn()) return false; } catch {}
  return true;
}

// The decision for one card, according to the Setup mode. Async only because of the Haiku call.
async function decide(p, c, m) {
  const mode = modeOf(), lead = leadOf(p);
  if (mode === 'lead') return { role: lead.name, why: 'lead decides everything' };
  const r = dispatch(p, c, m);
  if (!r.unclear) return r;
  if (mode === 'rules' || !aiAllowed()) return { role: lead.name, why: r.why + ', rules only: lead' };
  const pick = await askHaiku(p, c, m);
  return pick ? { role: pick.name, why: 'haiku (' + r.why + ')' } : { role: lead.name, why: 'haiku gave no answer (' + r.why + '): lead' };
}

const hints = new Map();   // slug -> text for the next run's prompt
const hint = slug => { const h = hints.get(slug); hints.delete(slug); return h ? ' ' + h : ''; };

// Called by presence.nudge with the owner's unseen news ([{ c, items }]): decide, log, then start the team.
const deciding = new Set();   // slugs with a decision under way: another nudge adds nothing, start re-reads the news (AIG-465)
async function wake(p, news, start) {
  if (deciding.has(p.slug)) return;
  deciding.add(p.slug);
  try { return await decideAndStart(p, news, start); } finally { deciding.delete(p.slug); }
}
async function decideAndStart(p, news, start) {
  let picks = [];
  try { picks = await Promise.all(news.map(async ({ c, items }) => ({ c, d: await decide(p, c, items[items.length - 1]) }))); } catch {}
  try {
    const q = load(p.slug);
    if (q && picks.length) {
      (q.log = q.log || []).push(...picks.map(({ c, d }) => ({ at: now(), author: 'Dispatcher', kind: 'log', text: `${c.id} -> ${d.role} (${d.why})` })));
      save(q);
    }
  } catch {}
  const lead = leadOf(p).name, other = picks.filter(x => x.d.role !== lead);
  if (other.length) hints.set(p.slug, 'Dispatcher: ' + other.map(x => `${x.c.id} is for ${x.d.role}`).join('; ') + ". Answer those as that role (or hand them to that team member); everything else is yours as lead. Don't tell the owner you can't do it.");
  return start(p);
}

module.exports = { dispatch, decide, wake, hint, modeOf, MODES };
