// Pretend team for the 🧪 new-user trial (AIG-205): the trial board starts this instead of an AI, so a new user sees
// the whole loop (ideas → cards → Go → work → hand-over → stand-ups) without a real AI or any cost.
// The board runs it in the project's folder, like a real agent; it talks to the trial board over its API.
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
  await say(slug, c.id, 'Ready for you to test. Steps are on the card.', { needsYou: false });
}

// First look at a new project: a lead on the roster and a few cards in every column, so the board isn't empty.
async function seed(slug) {
  await api('POST', `/api/projects/${slug}/team`, { name: ME, role: 'Lead', model: 'pretend', status: '🔄 working', task: 'Getting started' });
  const add = (title, status, description) => api('POST', `/api/projects/${slug}/cards`, { title, status, type: 'feature', description, createdBy: ME });
  await add('Dark mode', 'backlog', '- A dark theme for evenings');
  await add('Share on social media', 'backlog', '- Buttons to share a page');
  await add('Sign-up form for the newsletter', 'todo', '- Name and email, with a thank-you message');
  await add('Faster loading on phones', 'doing', '- Smaller pictures, load the rest later');
  const t = await add('A contact page', 'todo', '- A form that emails the owner');
  await handOver(slug, t, '- Open the **Contact** page\n- Fill in the form and press **Send**\n- You see "Thanks, we’ll be in touch"');
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
      await api('POST', `/api/projects/${slug}/standup`, { author: ME, done: 'Set up the board and handed you a contact page to test', next: 'Faster loading on phones', blockers: 'none' }).catch(() => {});
      await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
      continue;
    }
    // 📣 Going quiet: one line, then done.
    if (c.title === '📣 Going quiet' && c.status === 'team') {
      await say(slug, c.id, 'Sleep well! I’ll carry on with the sign-up form.');
      await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
      continue;
    }
    if (c.status !== 'team' && !(c.quick && c.status === 'team')) continue;
    // 💬 A new idea: two cards and a short plan, with Go buttons.
    if (c.quick && !c.comments.some(m => m.author === ME)) {
      const idea = c.title.replace(/^💬\s*/, '').slice(0, 60);
      const a = await api('POST', `/api/projects/${slug}/cards`, { title: idea + ': first version', status: 'backlog', type: 'feature', description: '- The simplest version of: ' + idea, createdBy: ME });
      const b = await api('POST', `/api/projects/${slug}/cards`, { title: idea + ': polish', status: 'backlog', type: 'feature', description: '- Make it look and feel finished', createdBy: ME });
      await say(slug, c.id, `Nice idea! Plan:\n- **${a.id}** a first version you can try\n- **${b.id}** polish it once you like it\n\nGO?`, { needsYou: true });
      continue;
    }
    // ✅ Go on an idea: build the first card and hand it over.
    if (c.quick && last && isOwner(last.author) && /^go\b/i.test(last.text)) {
      const mine = c.comments.filter(m => m.author === ME).map(m => m.text).join(' ').match(/[A-Z]+-\d+/g) || [];
      const first = mine[0] && p.cards.find(x => x.id === mine[0]);
      if (first) await handOver(slug, first, `- Try **${first.title.replace(/: first version$/, '')}**\n- It should do the basics; the polish comes next`);
      await say(slug, c.id, `On it! **${first ? first.id : 'The first card'}** is in your For you to test.`);
      await api('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
      continue;
    }
    // Any other comment from the owner: an answer, and the work handed back.
    if (last && isOwner(last.author)) {
      const back = last.verdict === 'sendback';
      await say(slug, c.id, back ? 'Fixed that, sorry! Have another look.' : 'On it 👍 Done: steps are on the card.');
      await handOver(slug, c, `- Check: ${last.text.replace(/^🔁 Sent back:?\s*/, '').slice(0, 200) || 'it works the way you asked'}`);
    }
  }
}
run().catch(e => { console.error('pretend team: ' + e.message); process.exitCode = 1; });
