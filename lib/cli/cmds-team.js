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
      o.push(`${c.id} [${c.status}${c.prevStatus && c.status === 'team' ? ', was ' + c.prevStatus : ''}] ${c.type}/${c.priority}  ${c.title}`);
      for (const it of c.items) o.push(`   ${it.kind === 'new card' ? OWNER + ' raised it' : it.kind === 'poke' ? OWNER + ' POKED (reply with a one-line status comment, leave the card where it is)' : OWNER} (${when(it.at)}): ${it.text.replace(/\n/g, '\n     ') || (it.attachments ? '' : '(no description)')}` + files(it, '     '));
    }
    const waiting = u.forTeam.filter(f => !u.cards.some(c => c.id === f.id));
    if (waiting.length) o.push(`Still in "For the team" (seen before): ${waiting.map(f => f.id + ' ' + f.title).join('; ')}`);
    // Pokes alone get the smallest possible message: one "oi" line per card.
    const onlyPokes = u.cards.length && u.cards.every(c => c.items.every(i => i.kind === 'poke'));
    if (onlyPokes && !flags.json) {
      const msg = u.cards.map(c => `👉 ${OWNER} poked ${c.id}: reply one line (aigile comment ${u.project} ${c.id} "...").`).join('\n');
      if (flags['stop-hook']) console.log(JSON.stringify({ decision: 'block', reason: msg })); else console.log(msg);
      return;
    }
    const news = u.cards.length > 0;
    if (hook && !news) return; // hooks only speak when there's something new (saves tokens)
    if (!news && !waiting.length) return console.log(`Nothing new from ${OWNER}.`);
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
  // The 🧭 Lead Scrum Master's one-line answer to the owner (AIG-262, AIG-359), by day or by night.
  async watchsay({ pos, flags }) {
    const r = await api('POST', '/api/chats/_watchman/say', { text: await text(pos[0], 'text'), ...(flags.options ? { options: String(flags.options) } : {}) });
    out(flags, r, () => 'said it in the Lead Scrum Master chat');
  },
  // 🧭 A Lead Scrum Master session in a window (AIG-359): wait for the owner's next messages in its chat, print them, exit.
  async smwait({ flags }) {
    const since = new Date().toISOString(), every = Math.max(3, Number(flags.every) || 10) * 1000;
    for (;;) {
      try { const r = await api('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(since)); if (r.messages.length) return out(flags, r.messages, ms => ms.map(m => `${OWNER}: ${m.text}`).join('\n')); } catch {}   // board down: keep waiting
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
        if (u.cards.length) return cmds.updates({ pos, flags: {} });
      } catch {} // board down: keep waiting
      await new Promise(r => setTimeout(r, every));
    }
  },

  async inbox({ flags }) {
    const cs = await api('GET', '/api/inbox');
    out(flags, cs, cs => cs.map(c => `${c.project}/${line(c)}` + (lastComment(c) ? `\n     last: ${lastComment(c).author}: ${lastComment(c).text.slice(0, 160).replace(/\n/g, ' ')}` : '')).join('\n') || `Nothing waiting on ${OWNER}.`);
  },
};
module.exports = cmds;
