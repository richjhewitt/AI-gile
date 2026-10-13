// aigile commands: team, avatar, log, standup, updates, bye, wake, watchsay, smwait, wait, inbox (split from aigile.js, AIG-297).
const { OWNER, WHERE, die, text, api, project, hookProject, P, who, line, when, files, out, lastComment } = require('./core');

const cmds = {
  async team({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('member NAME is required');
    const b = { name: pos[1] };
    for (const k of ['role', 'model', 'task', 'status']) if (flags[k] !== undefined) b[k] = flags[k] === true ? '' : flags[k];
    const m = await api('POST', P(slug) + '/team', b);
    out(flags, m, m => `team: ${m.name}${m.role ? ' | ' + m.role : ''}${m.model ? ' | ' + m.model : ''} | ${m.task || '-'} | ${m.status || '-'}${m.avatar ? ' | 🖼️ ' + m.avatar : ''}`);
  },

  // Your profile picture (AIG-150): no PIC lists the owner's picture library (who wears what); PIC (a name or number) takes one.
  async avatar({ pos, flags }) {
    const slug = await project(pos[0]), name = who(flags);
    if (pos[1] === 'badge') {   // the badge maker (AIG-396): aigile avatar <proj> badge fox teal glasses --as NAME
      const m = await api('POST', P(slug) + '/team', { name, avatar: 'badge:' + pos.slice(2, 5).join('/') });
      return out(flags, m, m => `${m.name} now wears ${m.avatar}`);
    }
    if (pos[1]) { const m = await api('POST', P(slug) + '/team', { name, avatar: pos[1] }); return out(flags, m, m => `${m.name} now wears ${m.avatar}`); }
    const [lib, p] = await Promise.all([api('GET', '/api/avatars'), api('GET', P(slug))]);
    const mine = ((p.team || []).find(m => m.name.toLowerCase() === name.toLowerCase()) || {}).avatar;
    const bp = lib.badge, badgeHelp = ['', '🎨 Badge maker (free, drawn by the app): mix an animal, a colour and an accessory.', `  animals: ${bp.animals.join(' ')}`, `  colours: ${bp.colours.map(c => c.name).join(' ')}`, `  accessories: ${bp.accessories.join(' ')}`, `Make one: aigile avatar ${slug} badge fox teal glasses --as ${name}`];
    out(flags, lib, l => !l.pictures.length ? [`The picture library is empty (${l.dir}). Ask ${OWNER} to drop some pictures in it.`, ...badgeHelp].join('\n')
      : [`Picture library: ${l.dir}  (open a file to look at it)`, ...l.pictures.map((x, i) => `${i + 1}. ${x.file}${x.file === mine ? '  <- yours' : ''}${x.usedBy.length ? '  (' + x.usedBy.map(u => u.name + '@' + u.project).join(', ') + ')' : '  (free)'}`),
        `Take one: aigile avatar ${slug} <number or name> --as ${name}`, ...badgeHelp].join('\n'));
  },

  async log({ pos, flags }) {
    const slug = await project(pos[0]);
    const e = await api('POST', P(slug) + '/log', { author: who(flags), text: await text(pos[1], 'log text'), kind: flags.decision ? 'decision' : 'log' });
    out(flags, e, e => `logged ${e.kind}`);
  },

  // Stand-up answer (AIG-134): done / next / blockers go on the project's open 📣 Stand-up card; answering again replaces yours.
  async standup({ pos, flags }) {
    const slug = await project(pos[0]);
    const b = { author: who(flags), done: await text(flags.done, '--done'), next: await text(flags.next, '--next') };
    if (flags.blockers !== undefined) b.blockers = flags.blockers === true ? 'none' : await text(flags.blockers, '--blockers');
    if (flags.needs !== undefined && flags.needs !== true) b.needs = await text(flags.needs, '--needs');   // waits on the owner, other work goes on (AIG-191)
    const r = await api('POST', P(slug) + '/standup', b);
    out(flags, r, r => `stand-up answered on ${r.card}` + (r.waiting.length ? `. Still to answer: ${r.waiting.join(', ')}` : '. Everyone has answered: the lead can move the card to done.'));
  },

  // 💬 Lead chat (AIG-872): the card-free chat with the owner. No text: the recent messages; with text: your reply.
  async chat({ pos, flags }) {
    const slug = await project(pos[0]);
    if (pos[1] !== undefined) { const m = await api('POST', P(slug) + '/leadchat', { author: who(flags), text: await text(pos[1], 'message') }); return out(flags, m, () => `sent to the Lead chat`); }
    const j = await api('GET', P(slug) + '/leadchat');
    out(flags, j, j => (j.messages.slice(-15).map(m => `${when(m.at)} ${m.author}: ${m.text}`).join('\n') || 'No messages yet.') + (j.unanswered ? `\n(${j.unanswered} from ${OWNER} not answered yet)` : ''));
  },

  async updates({ pos, flags }) {
    const hook = flags.hook || flags['stop-hook'];
    let u;
    try {
      const slug = hook ? await hookProject(pos[0]) : await project(pos[0]);
      if (!slug) return;   // a hook in a session that is not the project's lead stays out of it (AIG-455)
      u = await api('GET', P(slug) + '/updates' + (flags.peek ? '' : '?mark=1'));
    } catch (e) { if (hook) return; throw e; } // hooks stay silent if the board is down
    if (flags.json) return console.log(JSON.stringify(u, null, 2));
    const o = [];
    for (const c of u.cards) {
      if (c.chat) { o.push(`💬 Lead chat: ${OWNER} wrote (${when(c.items.at(-1).at)}): ${c.items.map(i => i.text).join(' / ').slice(0, 300)}\n   Read and answer: aigile chat ${u.project} / aigile chat ${u.project} "text" --as NAME. If it becomes work, make a card and post its id in the chat.`); continue; }
      o.push(`${c.id} [${c.status}${c.prevStatus && c.status === 'team' ? ', was ' + c.prevStatus : ''}] ${c.type}/${c.priority}  ${c.title}`);
      for (const it of c.items) o.push(`   ${it.kind === 'new card' ? OWNER + ' raised it' : it.kind === 'poke' ? OWNER + ' POKED (reply with a one-line status comment, leave the card where it is)' : OWNER} (${when(it.at)}): ${it.text.replace(/\n/g, '\n     ') || (it.attachments ? '' : '(no description)')}` + files(it, '     '));
    }
    for (const m of u.msgs || []) o.push(`📨 From ${m.from} to ${m.to} (${when(m.at)}), another agent, NOT ${OWNER}: ${m.text.replace(/\n/g, '\n     ')}`);
    const waiting = u.forTeam.filter(f => !u.cards.some(c => c.id === f.id));
    if (waiting.length) o.push(`Still in "For the team" (seen before): ${waiting.map(f => f.id + ' ' + f.title).join('; ')}`);
    // Pokes alone get the smallest possible message: one "oi" line per card.
    const onlyPokes = u.cards.length && u.cards.every(c => c.items.every(i => i.kind === 'poke'));
    if (onlyPokes && !flags.json) {
      const msg = u.cards.map(c => `👉 ${OWNER} poked ${c.id}: reply one line (aigile comment ${u.project} ${c.id} "...").`).join('\n');
      if (flags['stop-hook']) console.log(JSON.stringify({ decision: 'block', reason: msg })); else console.log(msg);
      return;
    }
    if (u.chat && !u.cards.some(c => c.chat)) o.push(`💬 Lead chat: ${u.chat} message(s) from ${OWNER} not answered yet: aigile chat ${u.project}`);
    const news = u.cards.length > 0 || (u.msgs || []).length > 0;
    if (hook && !news) return; // hooks only speak when there's something new (saves tokens)
    if (!news && !waiting.length && !u.chat) return console.log(`Nothing new from ${OWNER}.` + (u.retro ? '\n' + u.retro : ''));
    if (u.retro) o.push(u.retro);   // 🔁 AIG-865: a sprint go/no-go was answered or an incident closed
    const head = `📬 AI-gile board (${u.project}): ${news ? `new from ${OWNER} since you last looked` : 'cards waiting on your team'}.`;
    // Short (AIG-267): it's read on every hook.
    const tail = `Act now: \`aigile show ${u.project} <id>\`; information only -> \`aigile move ${u.project} <id> done\`; needs work -> doing, fix, then \`aigile test\`. Marked seen.`;
    // Tidy cards is on (AIG-234): neaten what the owner raised before working on it.
    const tidy = u.tidy && u.cards.some(c => c.items.some(i => i.kind === 'new card')) ? `First tidy each card ${OWNER} raised: short title (aigile edit --title), bullet description (--desc), ${OWNER}'s words in a comment starting "Original:".` : '';
    const msg = [head, ...o, tidy, tail].filter(Boolean).join('\n');
    if (flags['stop-hook']) { if (news) console.log(JSON.stringify({ decision: 'block', reason: msg })); return; }
    console.log(msg);
  },

  // PostToolUse hook (AIG-447): a busy session that runs no aigile command still counts as at work. Once a minute at most.
  async ping({ pos }) {
    if (WHERE === 'background') return;
    const fs = require('fs'), os = require('os'), path = require('path'), f = path.join(os.tmpdir(), 'aigile-ping-' + String(pos[0] || '').replace(/[^\w-]/g, '_'));
    try { if (Date.now() - fs.statSync(f).mtimeMs < 60e3) return; } catch {}
    try { fs.writeFileSync(f, ''); await api('GET', P(await project(pos[0])) + '/ping'); } catch {}
  },

  // SessionEnd hook (AIG-219): background runs end too, but must not wake themselves again.
  async bye({ pos }) {
    if (WHERE === 'background') return;
    try { const slug = await hookProject(pos[0]); if (slug) await api('POST', P(slug) + '/bye', {}); } catch {}   // board down: nothing to tell
  },

  // Wake a team (AIG-262): --sprint works through To do, not only the owner's comments.
  async wake({ pos, flags }) {
    const slug = await project(pos[0]);
    const r = await api('POST', P(slug) + '/wake', { sprint: !!flags.sprint });
    out(flags, r, r => r.terminal ? slug + ': a session is already at work there' : slug + ': woke the team' + (flags.sprint ? ' to sprint' : ''));
  },
  // ⛔ No Token Mode (AIG-337): notokens on|off, or just notokens to see.
  async notokens({ pos, flags }) {
    const on = pos[0] === 'on' ? true : pos[0] === 'off' ? false : null;
    const r = on === null ? await api('GET', '/api/notokens') : await api('POST', '/api/notokens', { on });
    out(flags, r, r => r.on ? '⛔ No Token Mode is ON' + (r.reason === 'limit' ? ' (usage limit' + (r.until ? ', back ' + r.until : '') + (r.back ? ', usage is back: turn it off to carry on' : '') + ')' : '') : 'No Token Mode is off');
  },
  // 🚨 All hands on deck (AIG-822): swarm <proj> starts it, swarm off ends it, swarm alone shows it.
  async swarm({ pos, flags }) {
    const r = !pos[0] ? await api('GET', '/api/swarm') : pos[0] === 'off' ? await api('POST', '/api/swarm', { off: true }) : await api('POST', '/api/swarm', { slug: await project(pos[0]), by: flags.as || process.env.AIGILE_AS || '' });
    out(flags, r, r => r.on ? `🚨 Swarm on ${r.name}: other projects' background runs wait until it ends` + (r.paused.length ? ` (waiting: ${r.paused.join(', ')})` : '') : 'No swarm');
  },
  // The 🧭 Lead Scrum Master's one-line answer to the owner (AIG-262, AIG-359), by day or by night.
  async watchsay({ pos, flags }) {
    const r = await api('POST', '/api/chats/_watchman/say', { text: await text(pos[0], 'text'), ...(flags.options ? { options: String(flags.options) } : {}) });
    out(flags, r, () => 'said it in the Lead Scrum Master chat');
  },
  // 🧭 A Lead Scrum Master session in a window (AIG-359): wait for the owner's next messages in its chat, print them, exit.
  async smwait({ flags }) {
    const since = new Date().toISOString(), every = Math.max(3, Number(flags.every) || 10) * 1000;
    for (;;) {
      try { const r = await api('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(since)); if (r.messages.length) return out(flags, r.messages, ms => ms.map(m => `${OWNER}: ${m.text}${require('../watchman').filesNote(m)}`).join('\n')); } catch {}   // board down: keep waiting
      await new Promise(r => setTimeout(r, every));
    }
  },

  // Idle sessions don't fire hooks. A lead runs this as a background command; it costs nothing while
  // waiting and exits (waking the session) with the owner's news as soon as there is any.
  async wait({ pos, flags }) {
    const slug = await project(pos[0]);
    const every = Math.max(5, Number(flags.every) || 15) * 1000;
    for (;;) {
      try {
        const u = await api('GET', P(slug) + '/updates?wait=1');   // wait=1: the board sees the session is idle (AIG-277)
        if (u.cards.length || (u.msgs || []).length) { try { await api('GET', P(slug) + '/updates?wait=0'); } catch {} return cmds.updates({ pos, flags: {} }); }
      } catch {} // board down: keep waiting
      await new Promise(r => setTimeout(r, every));
    }
  },

  async inbox({ flags }) {
    const cs = await api('GET', '/api/inbox');
    out(flags, cs, cs => cs.map(c => `${c.project}/${line(c)}` + (lastComment(c) ? `\n     last: ${lastComment(c).author}: ${lastComment(c).text.slice(0, 160).replace(/\n/g, ' ')}` : '')).join('\n') || `Nothing waiting on ${OWNER}.`);
  },

  // Agent profiles (AIG-421): no ROLE lists the roles on the project; ROLE prints its lines for a helper's prompt.
  // --set tests=4,alone=2 sets this project's numbers (ROLE "owner": steps, go, words); with --all, your own copy for all
  // projects. --reset clears this project's numbers, --reset --all deletes your copy (back to the template).
  async profile({ pos, flags }) {
    const slug = await project(pos[0]), q = pos[1];
    const nums = p => Object.entries(p || {}).map(([k, v]) => k + ' ' + v).join(', ');
    if (!q) {
      const r = await api('GET', P(slug) + '/profiles');
      return out(flags, r, r => [...r.roles.map(x => `${x.id}  ${x.label}${x.mine ? '  (your copy)' : ''}${Object.keys(x.project).length ? '  (this project: ' + nums(x.project) + ')' : ''}`),
        ...(Object.keys(r.owner).length ? [`owner on this project: ${nums(r.owner)}`] : []), `Lines for a helper: aigile profile ${slug} <role>`].join('\n'));
    }
    const R = encodeURIComponent(q);
    if (flags.set || flags.reset) {
      const scales = {};
      if (flags.set) for (const kv of String(flags.set).split(',')) { const [k, v] = kv.split('=').map(x => x.trim()); if (!k || v === undefined) die('--set takes scale=number pairs, e.g. tests=4,alone=2'); scales[k] = v === '' ? null : v; }
      if (flags.all && q === 'owner') die(`${OWNER}'s numbers for all projects are set in ⚙️ Setup`);
      if (flags.all) {
        const id = (await api('GET', `${P(slug)}/profiles/${R}`)).id;
        const r = flags.reset ? await api('DELETE', '/api/profiles/roles/' + id) : await api('PUT', '/api/profiles/roles/' + id, { scales });
        return out(flags, r, r => `${flags.reset ? 'back to the template' : 'your copy saved'} for all projects: ${r.profile.label}\n` + r.profile.lines.join('\n'));
      }
      if (flags.reset) { const cur = q === 'owner' ? (await api('GET', P(slug) + '/profiles')).owner : (await api('GET', `${P(slug)}/profiles/${R}`)).project; for (const k of Object.keys(cur)) scales[k] = null; }
      const r = await api('PUT', `${P(slug)}/profiles/${R}`, { scales });
      return out(flags, r, r => r.lines ? `this project: ${nums(r.project) || 'no numbers of its own'}\n` + r.lines.join('\n') : `${OWNER} on this project: ${nums(r.owner) || 'as in ⚙️ Setup'}`);
    }
    const r = await api('GET', `${P(slug)}/profiles/${R}`);
    out(flags, r, r => r.lines.join('\n'));
  },

  // `aigile release-notes <proj>` (AIG-562): the lead's release step. Done cards not in any earlier notes become a new entry
  // at the top of public/releases.json (bugs under Fixed, the rest under New); the page shows it on ✨ What's new.
  // --since YYYY-MM-DD skips cards last updated before then (default: the last notes, or a week for the first); --title names
  // the build; --dry prints without saving.
  async 'release-notes'({ pos, flags }) {
    const fs = require('fs'), path = require('path');
    const slug = await project(pos[0]);
    const file = process.env.AIGILE_RELEASES || path.join(__dirname, '..', '..', 'public', 'releases.json');
    let all = []; try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    if (!Array.isArray(all)) all = [];
    const listed = new Set(all.flatMap(r => [...(r.features || []), ...(r.fixes || [])].map(i => i.id)));
    if (flags.since && !/^\d{4}-\d{2}-\d{2}$/.test(flags.since)) die('--since must be YYYY-MM-DD');
    const since = flags.since || (all[0] && all[0].at) || new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);   // first notes: the last week
    const p = await api('GET', P(slug));
    const cs = p.cards.filter(c => c.status === 'done' && !listed.has(c.id) && String(c.updated || c.created || '') >= since)
      .sort((a, b) => String(a.updated).localeCompare(String(b.updated)));
    const item = c => ({ id: c.id, title: c.title.replace(/^[^\p{L}\p{N}]+/u, '').trim() || c.title });
    const at = new Date().toISOString();
    // ↩ The build's commit, so What's new can go back to it (AIG-563): the git folder the notes file lives in.
    const head = require('child_process').spawnSync('git', ['rev-parse', 'HEAD'], { cwd: path.dirname(path.dirname(file)), encoding: 'utf8', windowsHide: true });
    const commit = head.status === 0 ? head.stdout.trim() : '';
    const r = { id: at.slice(0, 16).replace(/\D/g, ''), at, title: (flags.title && flags.title !== true) ? String(flags.title) : at.slice(0, 10),
      ...(commit ? { commit } : {}), features: cs.filter(c => c.type !== 'bug').map(item), fixes: cs.filter(c => c.type === 'bug').map(item) };
    if (!r.features.length && !r.fixes.length) return console.log('nothing new: no done cards since the last notes');
    if (!flags.dry) fs.writeFileSync(file, JSON.stringify([r, ...all], null, 2) + '\n');
    out(flags, r, r => `${flags.dry ? 'would add' : 'added'} "${r.title}": ${r.features.length} new, ${r.fixes.length} fixed` + (flags.dry ? '' : ` -> ${path.relative(process.cwd(), file)}`));
  },
};
module.exports = cmds;
