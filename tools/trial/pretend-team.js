// Pretend team for the 🧪 new-user trial (AIG-205): the trial board starts this instead of an AI, so a new user sees
// the whole loop (ideas → cards → Go → work → hand-over → stand-ups) without a real AI or any cost.
// The board runs it in the project's folder, like a real agent; it talks to the trial board over its API.
const { t } = require('../../lib/i18n');   // the owner's language, from AIGILE_LOCAL (AIG-488)
const BASE = (process.env.AIGILE_URL || 'http://localhost:4400').replace(/\/$/, '');
const ME = 'Lead (pretend)';
const api = async (method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'background' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
};
const norm = d => String(d || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const say = (slug, id, text, extra = {}) => api('POST', `/api/projects/${slug}/cards/${id}/comments`, { author: ME, text, ...extra });
async function handOver(slug, c, steps) {
  await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'verify', testSteps: steps, needsYou: false, assignee: ME });
  await say(slug, c.id, t('pt.ready'), { needsYou: false });
}

// First look at a new project: a lead on the roster and a few cards in every column, so the board isn't empty.
async function seed(slug) {
  await api('POST', `/api/projects/${slug}/team`, { name: ME, role: 'Lead', model: 'pretend', status: '🔄 working', task: t('pt.task') });
  const add = (title, status, description) => api('POST', `/api/projects/${slug}/cards`, { title, status, type: 'feature', description, createdBy: ME });
  await add(t('pt.c1.t'), 'backlog', t('pt.c1.d'));
  await add(t('pt.c2.t'), 'backlog', t('pt.c2.d'));
  await add(t('pt.c3.t'), 'todo', t('pt.c3.d'));
  await add(t('pt.c4.t'), 'doing', t('pt.c4.d'));
  const contact = await add(t('pt.c5.t'), 'todo', t('pt.c5.d'));
  await handOver(slug, contact, t('pt.c5.steps'));
}

async function run() {
  const cwd = norm(process.cwd()), projects = await api('GET', '/api/projects'), meta = await api('GET', '/api/meta');
  const sum = projects.find(p => norm(p.path) === cwd); if (!sum) return;
  const slug = sum.slug, owner = meta.owner, isOwner = a => String(a || '').toLowerCase() === String(owner).toLowerCase();
  let p = await api('GET', '/api/projects/' + slug);
  if (!(p.team || []).some(m => m.name === ME)) { await seed(slug); p = await api('GET', '/api/projects/' + slug); }
  for (const c of p.cards.filter(c => c.status !== 'done')) {
    const last = c.comments.at(-1);
    // 📣 Stand-up: answer once, then close it.
    if (c.standup && c.status === 'team') {
      await api('POST', `/api/projects/${slug}/standup`, { author: ME, done: t('pt.sa.done'), next: t('pt.c4.t'), blockers: t('pt.sa.none') }).catch(() => {});
      await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
      continue;
    }
    // 📣 Going quiet: one line, then done.
    if (c.title === '📣 Going quiet' && c.status === 'team') {
      await say(slug, c.id, t('pt.quiet'));
      await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
      continue;
    }
    // ✅ Go answered by rule (AIG-609): the board moved the idea's first card to To do itself, so build that one and hand it over.
    if (c.status === 'todo' && c.createdBy === ME && c.title.endsWith(t('pt.first.sfx'))) {
      await handOver(slug, c, t('pt.go.steps', { title: c.title.slice(0, -t('pt.first.sfx').length) }));
      continue;
    }
    if (c.status !== 'team' && !(c.quick && c.status === 'team')) continue;
    // 💬 A new idea: two cards and a short plan, with Go buttons.
    if (c.quick && !c.comments.some(m => m.author === ME)) {
      const idea = c.title.replace(/^💬\s*/, '').slice(0, 60);
      const a = await api('POST', `/api/projects/${slug}/cards`, { title: idea + t('pt.first.sfx'), status: 'backlog', type: 'feature', description: t('pt.first.d', { idea }), createdBy: ME });
      const b = await api('POST', `/api/projects/${slug}/cards`, { title: idea + t('pt.polish.sfx'), status: 'backlog', type: 'feature', description: t('pt.polish.d'), createdBy: ME });
      await say(slug, c.id, t('pt.plan', { a: a.id, b: b.id }), { needsYou: true });
      continue;
    }
    // ✅ Go on an idea: build the first card and hand it over.
    if (c.quick && last && isOwner(last.author) && /^(go|ga)\b/i.test(last.text)) {
      const mine = c.comments.filter(m => m.author === ME).map(m => m.text).join(' ').match(/[A-Z]+-\d+/g) || [];
      const first = mine[0] && p.cards.find(x => x.id === mine[0]);
      if (first) await handOver(slug, first, t('pt.go.steps', { title: first.title.endsWith(t('pt.first.sfx')) ? first.title.slice(0, -t('pt.first.sfx').length) : first.title }));
      await say(slug, c.id, t('pt.go.reply', { id: first ? first.id : t('pt.go.firstcard') }));
      await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
      continue;
    }
    // Any other comment from the owner: an answer, and the work handed back.
    if (last && isOwner(last.author)) {
      const back = last.verdict === 'sendback';
      await say(slug, c.id, back ? t('pt.back') : t('pt.ok'));
      await handOver(slug, c, t('pt.check', { what: last.text.replace(/^🔁 Sent back:?\s*/, '').slice(0, 200) || t('pt.check.default') }));
    }
  }
}
// 🙋 Ask a mate (AIG-384): the board runs this same program for a friend's question, with the question on stdin and
// AIGILE_ASK=1. Answer with a short canned reply in the agent's json shape, so the journey works with no tokens.
async function answerAsk() {
  process.stdin.resume(); await new Promise(r => { process.stdin.on('end', r); process.stdin.on('error', r); process.stdin.on('close', r); });
  console.log(JSON.stringify({ type: 'result', is_error: false, result: t('pt.ask') }));
}
(process.env.AIGILE_ASK ? answerAsk() : run()).catch(e => { console.error('pretend team: ' + e.message); process.exitCode = 1; });
