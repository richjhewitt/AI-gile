// aigile commands: add, edit, move, start, assign, comment, dm, ask, tests, checked, fold, test, task, block, unblock (split from aigile.js, AIG-297).
const { STATUSES, queueInfo, uploadShots, OWNER, die, text, api, project, P, C, who, line, when, out } = require('./core');

// The groups on a board (AIG-386): a group lives as long as it has cards; done cards don't count.
const groupsOf = cards => {
  const m = new Map();
  for (const c of cards) if (c.group && c.status !== 'done') (m.get(c.group) || m.set(c.group, []).get(c.group)).push(c);
  return [...m].map(([name, cs]) => ({ name, cards: cs })).sort((a, b) => a.name.localeCompare(b.name));
};
const ALREADY = `Already waiting on the owner: bumped it to the top instead`;
const cmds = {
  async add({ pos, flags }) {
    const slug = await project(pos[0]);
    const title = await text(pos[1], 'title');
    const b = { title };
    for (const [f, k] of [['type', 'type'], ['priority', 'priority'], ['status', 'status'], ['desc', 'description'], ['sprint', 'sprint'], ['group', 'group'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = flags[f] === true ? '' : (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (flags['needs-you']) b.needsYou = true;
    if (flags.life) {   // 🏡 AIG-394: a real-life task, the owner's own
      b.lifeType = flags.life;
      if (flags.at) { const w = require('../timed').parseWhen(flags.at); if (!w) die('--at: use "2026-10-12 14:00", "tomorrow 9:00", "+2h"'); b.apptAt = w; }
      if (flags.remind !== undefined) b.remindMins = Number(flags.remind);
    }
    const c = await api('POST', P(slug) + '/cards', b);
    out(flags, c, c => 'added ' + line(c));
  },

  async edit({ pos, flags }) {
    const slug = await project(pos[0]);
    const b = {};
    for (const [f, k] of [['title', 'title'], ['type', 'type'], ['priority', 'priority'], ['desc', 'description'], ['sprint', 'sprint'], ['group', 'group'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (!Object.keys(b).length) die('nothing to change; give at least one of --title --desc --type --priority --sprint --group --assignee --test-steps');
    const c = await api('PATCH', C(slug, pos[1]), b);
    out(flags, c, c => 'updated ' + line(c));
  },

  async move({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!STATUSES.includes(pos[2])) die('status must be one of ' + STATUSES.join(', '));
    if (pos[2] === 'done' && !process.env.AIGILE_ALLOW_DONE) {
      // Teams may close a card once they've read the owner's comment on it ('For the team'); otherwise the owner accepts.
      const card = (await api('GET', P(slug))).cards.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase());
      if (card && card.status !== 'team') die(`only ${OWNER} moves cards to done (they accept them in 'verify'). Use: aigile test ...  (cards in 'team' you may move to done once you've read ${OWNER}'s comment)`);
    }
    const c = await api('PATCH', C(slug, pos[1]), { status: pos[2] });
    out(flags, c, c => 'moved ' + line(c));
  },

  // Timed card (AIG-385): out of the way until a time. Local time: "2026-10-12 14:00", "+2h", "tomorrow 9:00".
  async snooze({ pos, flags }) {
    const slug = await project(pos[0]);
    if (flags.clear) { const c = await api('DELETE', C(slug, pos[1]) + '/timer'); return out(flags, c, c => 'cleared the timer on ' + line(c)); }
    if (!pos[2]) die('give a time (local): "2026-10-12 14:00", "+2h", "tomorrow 9:00"; or --clear');
    const iso = require('../timed').parseWhen(pos[2]);
    if (!iso) die('cannot read that time; try "2026-10-12 14:00", "+2h" or "tomorrow 9:00"');
    const c = await api('POST', C(slug, pos[1]) + '/timer', { until: iso });
    out(flags, c, c => `${c.id} is out of the way until ${new Date(c.timedUntil).toLocaleString()}`);
  },

  // ☑ Checklist (AIG-406): check <proj> <id> "Windows,Mac,Android" sets it (ticks of same-named items stay); --tick 1,3 / --untick 2 (1-based);
  // check <proj> <id> shows it; --clear removes it. Ticking wakes nobody.
  async check({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('usage: check <proj> <id> "Windows,Mac,Android"  |  --tick N  |  --untick N  |  --clear');
    const nums = v => String(v).split(',').map(s => s.trim()).filter(Boolean).map(Number);
    let c;
    if (flags.clear) c = await api('PATCH', C(slug, pos[1]), { checklist: [] });
    else if (pos[2]) c = await api('PATCH', C(slug, pos[1]), { checklist: pos[2] });
    if (flags.tick || flags.untick) c = await api('POST', C(slug, pos[1]) + '/check', { tick: flags.tick && flags.tick !== true ? nums(flags.tick) : [], untick: flags.untick && flags.untick !== true ? nums(flags.untick) : [], by: who(flags) });
    if (!c) c = (await api('GET', P(slug))).cards.find(x => x.id.toLowerCase() === String(pos[1]).toLowerCase()) || die('card not found');
    out(flags, c, c => (c.checklist || []).length ? `${c.id} checklist ${c.checklist.filter(x => x.done).length}/${c.checklist.length}:\n` + c.checklist.map((x, i) => `  ${i + 1}. [${x.done ? 'x' : ' '}] ${x.text}`).join('\n') : `${c.id} has no checklist`);
  },

  // ⏳ Waits for (AIG-406): wait-for <proj> <id> AIG-12 [AIG-13]  (same project); --clear to stop waiting. The card is greyed and out of `next` until they are done.
  async 'wait-for'({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('usage: wait-for <proj> <id> AIG-12[,AIG-13]  |  --clear');
    const ids = pos.slice(2).join(',');
    if (!flags.clear && !ids) die('give the card(s) it waits for, or --clear');
    const c = await api('PATCH', C(slug, pos[1]), { waitsFor: flags.clear ? [] : ids });
    out(flags, c, c => (c.waitsFor || []).length ? `${c.id} waits for ${c.waitsFor.join(', ')}${(c.waiting || []).length ? '' : ' (all done already)'}` : `${c.id} waits for nothing`);
  },

  async start({ pos, flags }) {
    const slug = await project(pos[0]);
    const name = who(flags);
    const c = await api('PATCH', C(slug, pos[1]), { status: 'doing', assignee: name, clearStale: true });
    await api('POST', P(slug) + '/team', { name, task: c.id + ' ' + c.title, status: '🔄 working' });
    out(flags, c, c => 'started ' + line(c));
  },

  async assign({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('PATCH', C(slug, pos[1]), { assignee: pos[2] === undefined ? die('NAME is required (use "" to unassign)') : pos[2] });
    out(flags, c, c => 'assigned ' + line(c));
  },

  async comment({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: await text(pos[2], 'comment text') });
    out(flags, c, c => `commented on ${c.id} (${c.comments.length} comments)`);
  },

  async dm({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('POST', `/api/projects/${slug}/dm`, { author: who(flags), text: await text(pos[1], 'message') });
    out(flags, c, c => `sent to ${OWNER}'s chat (${c.id})`);
  },

  async ask({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: await text(pos[2], 'question'), needsYou: true, mark: 'ask', options: flags.options });
    out(flags, c, c => c.bumped ? ALREADY : `asked ${OWNER} on ${c.id}; card now flagged NEEDS-OWNER. Move on to other work (aigile next ${slug}).`);
  },

  // 🗂️ Topic (AIG-361): several quick questions on one card, answered in one go in the owner's ⚡ Decide pile.
  async quiz({ pos, flags }) {
    const slug = await project(pos[0]);
    const topic = flags.topic === true ? '' : flags.topic;
    const items = pos.slice(2).map(s => { const [q, o] = String(s).split('|'); return { q: (q || '').trim(), options: (o || '').trim() }; });
    if (!topic || !items.length) die('usage: quiz <proj> <id> --topic "Sharing" "Question one?|Opt A,Opt B" "Question two?|Yes,No" --as NAME  (one line each, up to 4 options)');
    await queueInfo(slug, pos[1], flags);
    const c = await api('POST', C(slug, pos[1]) + '/quiz', { author: who(flags), topic, items });
    out(flags, c, c => `sent topic "${topic}" (${items.length} questions) on ${c.id}; card now flagged NEEDS-OWNER. The answers come back as one comment. Move on to other work.`);
  },

  // AI tester (AIG-163): the tests waiting for the owner that nobody has checked yet, steps included, compact.
  async tests({ pos, flags }) {
    const slug = await project(pos[0]);
    const list = (await api('GET', '/api/projects/' + slug)).cards.filter(c => c.status === 'verify' && !c.info && (flags.all || !c.aiCheck));   // 📖 info-only hand-overs have nothing to check (AIG-392)
    out(flags, list, l => l.map(c => `${c.id}  ${c.title}${c.openUrl ? '\n  open: ' + c.openUrl : ''}\n  ${String(c.testSteps || '(no steps)').replace(/\*\*/g, '').replace(/\n+/g, '\n  ')}`).join('\n\n') || 'no tests left to check');
  },
  async checked({ pos, flags }) {
    const slug = await project(pos[0]), result = pos[2];
    if (!['pass', 'fail', 'skip'].includes(result)) die('usage: checked <proj> <id> pass|fail|skip "what you saw" [--shot a.png] --as NAME');
    const note = await text(pos[3], 'what you saw');
    const attachments = await uploadShots(slug, flags.shot);
    const c = await api('POST', C(slug, pos[1]) + '/aicheck', { result, note, by: who(flags), attachments });
    out(flags, c, c => '🤖 ' + result + ': ' + line(c));
  },

  // Fold (AIG-190/193): cards about the same feature join one card; their test steps move across and they close.
  async fold({ pos, flags }) {
    const slug = await project(pos[0]), into = pos[1], ids = pos.slice(2);
    if (!into || !ids.length) die('usage: fold <proj> <target id> <id> [<id>...] --as NAME');
    let c;
    for (const id of ids) c = await api('POST', C(slug, id) + '/fold', { into, author: who(flags) });
    out(flags, c, c => `folded ${ids.join(', ')} into ` + line(c));
  },

  // 🗂️ Card groups (AIG-386): related cards dealt with together.
  //   group <proj> "name" AIG-1 AIG-2     add cards         group <proj> "name" --remove AIG-3     take cards out
  //   group <proj> "name" --move verify   move them all     group <proj> --list                    the groups
  async group({ pos, flags }) {
    const slug = await project(pos[0]);
    const cards = (await api('GET', P(slug))).cards;
    if (flags.list || !pos[1]) {
      const g = groupsOf(cards);
      return out(flags, g, g => g.map(x => `${x.name} (${x.cards.length}): ` + x.cards.map(c => `${c.id} [${c.status}]`).join(', ')).join('\n') || 'no groups yet: aigile group <proj> "name" AIG-1 AIG-2');
    }
    const name = (groupsOf(cards).find(x => x.name.toLowerCase() === pos[1].toLowerCase()) || { name: pos[1] }).name;
    const ids = x => String(x).split(',').map(s => s.trim()).filter(Boolean);
    const add = pos.slice(2).flatMap(ids), rem = [...(typeof flags.remove === 'string' ? ids(flags.remove) : []), ...(flags.remove ? pos.slice(2) : [])];
    const done = [];
    if (flags.remove) { for (const id of rem) { await api('PATCH', C(slug, id), { group: '' }); } done.push('took out ' + rem.join(', ')); }
    else for (const id of add) { await api('PATCH', C(slug, id), { group: name }); done.push(id); }
    if (flags.move) {
      if (!STATUSES.includes(flags.move)) die('status must be one of ' + STATUSES.join(', '));
      const members = (await api('GET', P(slug))).cards.filter(c => c.group === name);
      if (flags.move === 'done' && !process.env.AIGILE_ALLOW_DONE && members.some(c => c.status !== 'team')) die(`only ${OWNER} moves cards to done (they accept them in 'verify')`);
      for (const c of members) await api('PATCH', C(slug, c.id), { status: flags.move });
      done.push(`moved ${members.length} to ${flags.move}`);
    }
    const g = groupsOf((await api('GET', P(slug))).cards).find(x => x.name === name);
    out(flags, g || { name, cards: [] }, () => `group "${name}": ${done.join('; ') || 'nothing changed'}. Now ${g ? g.cards.length : 0} card(s)${g ? ': ' + g.cards.map(c => c.id).join(', ') : ''}`);
  },

  async test({ pos, flags }) {
    const slug = await project(pos[0]);
    // A whole group (AIG-386): test <proj> "Addon testing" ["steps"]  or  --group "name": every card goes to verify; each keeps its own steps unless you give shared ones.
    const gname = typeof flags.group === 'string' ? flags.group : '';
    const all = (await api('GET', P(slug))).cards, members = all.filter(c => c.group && c.group.toLowerCase() === String(gname || pos[1] || '').toLowerCase());
    if (members.length && (gname || !all.some(c => c.id.toLowerCase() === String(pos[1]).toLowerCase()))) {
      const author = who(flags), shared = gname ? pos[1] : pos[2];
      if (!shared && members.some(c => !c.testSteps)) die('give the test steps (shared by the whole group), or give every card in the group its own first');
      for (const c of members) {
        await queueInfo(slug, c.id, flags);
        await api('PATCH', C(slug, c.id), { status: 'verify', ...(typeof flags.check === 'string' ? { checklist: flags.check } : {}), ...(shared ? { testSteps: await text(shared, 'test steps') } : {}), needsYou: false, ...(flags.open ? { openUrl: flags.open, startCmd: flags.start || '' } : {}) });
        if (flags.commit) await api('POST', C(slug, c.id) + '/proof', { commit: flags.commit });
        await api('POST', C(slug, c.id) + '/comments', { author, text: `Ready for you to test, with the group "${members[0].group}". Steps are on the card.`, needsYou: false, attachments: await uploadShots(slug, flags.shot) });
      }
      return out(flags, members, () => `handed ${members.length} cards of group "${members[0].group}" to ${OWNER}: ${members.map(c => c.id).join(', ')}`);
    }
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    const steps = await text(pos[2], 'test steps');
    // --open URL [--start "command"]: the card gets a ▶ Open it button (AIG-146).
    await api('PATCH', C(slug, pos[1]), { status: 'verify', testSteps: steps, needsYou: false, ...(typeof flags.check === 'string' ? { checklist: flags.check } : {}), info: !!flags.info || require('../store').isInfoSteps(steps), ...(flags.open ? { openUrl: flags.open, startCmd: flags.start || '' } : {}) });
    // Proof on hand-back (AIG-166): --commit <sha> lets the board attach what changed; --shot a.png,b.png adds screenshots.
    if (flags.commit) await api('POST', C(slug, pos[1]) + '/proof', { commit: flags.commit });
    const attachments = await uploadShots(slug, flags.shot);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author, text: 'Ready for you to test. Steps are on the card.', needsYou: false, attachments });
    out(flags, c, c => `handed to ${OWNER}: ` + line(c));
  },

  // Something only the owner can do (a key, a login, a manual step): assigns the card to him with the instructions.
  // It shows in his inbox under "Tasks for you"; when he clicks Done it comes back to you via "For the team".
  async task({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    // --server [NAME]: NAME says which of the owner's saved servers (AIG-374); `--server "text"` before the text still works.
    let srv = typeof flags.server === 'string' ? flags.server : '';
    if (srv && !pos[2]) { pos[2] = srv; srv = ''; }
    const what = await text(pos[2], `what ${OWNER} needs to do`);
    await api('PATCH', C(slug, pos[1]), { assignee: OWNER, needsYou: false, ...(flags.outside ? { outside: true } : {}), ...(flags.server ? { server: true, ...(srv ? { serverName: srv } : {}) } : {}) });   // --server: a job to run on a server (AIG-320)
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author, text: what, needsYou: false, mark: 'task' });
    out(flags, c, c => c.bumped ? ALREADY : `task for ${OWNER} on ${c.id}: it's in their inbox. Carry on with other work (aigile next ${slug}).`);
  },

  // Remind the owner of what already waits for him: moves it to the top of his pile, never a copy (AIG-373).
  async bump({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('usage: bump <proj> <id> --as NAME');
    const c = await api('POST', C(slug, pos[1]) + '/bump', { author: who(flags) });
    out(flags, c, c => `bumped ${c.id} to the top of ${OWNER}'s pile (reminded ${c.bumps}x)`);
  },

  async block({ pos, flags }) {
    const slug = await project(pos[0]);
    let c = await api('PATCH', C(slug, pos[1]), { blocked: true });
    if (pos[2]) c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: 'Blocked: ' + await text(pos[2], 'reason') });
    out(flags, c, c => 'blocked ' + line(c));
  },

  // 🚨 Showstopper (AIG-395): only while the owner is in 🎯 focus mode; only a lead or the Scrum Master. Rate-limited.
  async showstopper({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1] || !pos[2]) die('usage: showstopper <proj> <id> "why" --as NAME');
    const r = await api('POST', '/api/focus/showstopper', { project: slug, id: pos[1], why: await text(pos[2], 'why'), author: who(flags) });
    out(flags, r, r => `🚨 showstopper on ${r.id}: ${OWNER} sees one line`);
  },

  async unblock({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('PATCH', C(slug, pos[1]), { blocked: false });
    out(flags, c, c => 'unblocked ' + line(c));
  },

  // 📤 / 📥 The AIGILE pack (AIG-357, docs/HANDOFF.md): a card for an outside chat AI, and its reply pasted back.
  async pack({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('card id is required');
    const r = await api('GET', C(slug, pos[1]) + '/pack' + (flags.want && flags.want !== true ? '?want=' + encodeURIComponent(flags.want) : ''));
    if (flags.json) return console.log(JSON.stringify(r, null, 2));
    if (flags.primer) console.log(r.primer + '\n');
    console.log(r.text);
    if (r.removed.length) console.error(`\n(removed ${r.removed.length}: ` + r.removed.map(x => `${x.kind} in ${x.field}: ${x.text}`).join('; ') + ')');
  },
  async unpack({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('card id is required');
    const r = await api('POST', C(slug, pos[1]) + '/unpack', { text: await text(pos[2], 'the reply (use - for stdin)') });
    const o = [r.valid ? `added the outside AI's reply to ${pos[1]}` : `not an AIGILE/1 BACK reply: kept as a plain comment on ${pos[1]}`];
    if (r.back) {
      if (r.back.s) o.push('S: ' + r.back.s);
      o.push(...r.back.say);
      if (r.back.ask.length) o.push('Questions:', ...r.back.ask.map(q => '- ' + q));
      if (r.back.cards.length) o.push('Proposed cards (add with --add 1,2):', ...r.back.cards.map((x, i) => `  ${i + 1}. ${x.title} (${x.type}, ${x.priority})`));
    }
    if (flags.add && flags.add !== true && r.back) {
      const pick = String(flags.add).split(',').map(s => Number(s.trim()) - 1).filter(n => n >= 0);
      const a = await api('POST', C(slug, pos[1]) + '/outside/cards', { at: r.comment.at, pick });
      o.push(...a.added.map(c => 'added to the Backlog: ' + line(c)));
    }
    out(flags, r, () => o.join('\n'));
  },
};
module.exports = cmds;
