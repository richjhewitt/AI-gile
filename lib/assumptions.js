// 🌙 Assumptions log (AIG-477): every guess a lead makes while the owner rests, across all projects, newest first.
// A comment counts when it has mark 'assume' (aigile assume) or starts with "Assumption:" (older comments are picked up too).
// The owner's answer sits on the comment itself: assumeState 'ok' (👍 fine) | 'plug' (✋ plug this).
const { listSlugs, load, save, now, bad } = require('./store');
const IS = m => m.mark === 'assume' || /^[\s>*_-]*Assumption:/i.test(m.text || '');

function list() {
  const out = [];
  for (const slug of listSlugs()) {
    let p; try { p = load(slug); } catch { continue; }
    if (!p) continue;
    for (const c of p.cards || []) for (const m of c.comments || []) {
      if (!IS(m)) continue;
      out.push({ project: p.name || slug, slug, id: c.id, title: c.title, summary: String(c.description || '').split('\n').map(s => s.trim()).find(Boolean) || '', ...(m.assume ? { assume: m.assume } : {}), author: m.author, at: m.at, text: m.text, state: m.assumeState || '' });
    }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// { slug, id, at, state } -> remembers the owner's answer ('' clears it).
function resolve(b) {
  if (!['ok', 'plug', ''].includes(b.state)) throw bad('state must be ok or plug');
  const p = load(b.slug), c = p && (p.cards || []).find(x => x.id === b.id);
  const m = c && c.comments.find(x => x.at === b.at && IS(x));
  if (!m) throw bad('assumption not found', 404);
  if (b.state) m.assumeState = b.state; else delete m.assumeState;
  c.updated = now(); save(p);
  return { ok: true };
}

// 📋 Summarise (AIG-781): the ones still to review, one bullet per card. Plain code always; with ai, one tiny Haiku call
// boils them down further (no tools, neutral folder), falling back to the plain text when AI is off or it fails.
function plain(todo) {
  const by = new Map();
  for (const a of todo) { const k = a.slug + '|' + a.id; if (!by.has(k)) by.set(k, { a, picks: [] }); by.get(k).picks.push(a.assume ? a.assume.chose || a.assume.decided : String(a.text || '').replace(/^[\s>*_-]*Assumption:\s*/i, '')); }
  return [...by.values()].map(({ a, picks }) => `- ${a.id} ${a.title}: ${picks.map(s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160)).join('; ')}`).join('\n');
}
function askHaiku(text) {
  const os = require('os'), { agentCommand, spawnAgent } = require('./presence');
  const prompt = `These are guesses an AI team made while the owner was away, one line per card. Summarise them for the owner in at most 6 short "- " bullets, plain words, card ids kept, the riskiest first. Reply with only the bullets.\n\n${text.slice(0, 6000)}`;
  return new Promise(resolve => {
    let out = '', done = false, child, t;
    const end = v => { if (done) return; done = true; clearTimeout(t); resolve(v); };
    try { child = spawnAgent(agentCommand(), ['-p', prompt.replace(/\s*\n+\s*/g, ' '), '--model', 'haiku', '--max-turns', '1', '--tools', '', '--setting-sources', 'user'], { cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return resolve(''); }
    t = setTimeout(() => { try { child.kill(); } catch {} end(''); }, 60e3);
    child.stdout.on('data', d => out += d);
    child.on('error', () => end(''));
    child.on('exit', () => end(out.trim()));
  });
}
async function summary(ai) {
  const todo = list().filter(a => !a.state), text = plain(todo);
  if (!todo.length) return { n: 0, text: '', ai: false };
  if (ai && !require('./notokens').isOn() && !require('./noai').isOn()) { const s = await askHaiku(text); if (s) return { n: todo.length, text: s, ai: true }; }
  return { n: todo.length, text, ai: false };
}
module.exports = { list, resolve, summary, plain };
