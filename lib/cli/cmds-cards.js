// aigile commands: add, edit, move, start, assign, comment, dm, ask, tests, checked, fold, test, task, block, unblock (split from aigile.js, AIG-297).
const { rail, STATUSES, queueInfo, uploadShots, OWNER, die, text, api, project, P, C, who, line, when, out } = require('./core');

// The groups on a board (AIG-386): a group lives as long as it has cards; done cards don't count.
const groupsOf = cards => {
  const m = new Map();
  for (const c of cards) if (c.group && c.status !== 'done') (m.get(c.group) || m.set(c.group, []).get(c.group)).push(c);
  return [...m].map(([name, cs]) => ({ name, cards: cs })).sort((a, b) => a.name.localeCompare(b.name));
};
// The body of an assumption comment (AIG-526): plain "what I assumed" is stored as `chose`; --decided/--chose/--why/--if-plugged/--options add the structure.
async function assumeBody(plain, flags) {
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const chose = str(flags.chose) || (plain === undefined ? '' : await text(plain, 'what you assumed and why'));
  if (!chose) die('what you chose is required: --chose "..." (with --decided, --why, --if-plugged, optional --options "A|B|C"), or just a plain line');
  const assume = { chose };
  for (const [k, f] of [['decided', 'decided'], ['why', 'why'], ['ifNo', 'if-plugged']]) if (str(flags[f])) assume[k] = str(flags[f]);
  const options = str(flags.options).split('|').map(s => s.trim()).filter(Boolean);
  if (options.length) assume.options = options;
  const text_ = 'Assumption: ' + [assume.decided && assume.decided + ':', chose, assume.why && '(' + assume.why + ')'].filter(Boolean).join(' ');
  return { author: who(flags), text: text_, mark: 'assume', assume };
}
// 🔴 The merge gate (AIG-613): a card whose last QA run failed is not handed over. No qa record (old cards): not blocked.
const qaRed = c => !!(c && c.qa && (c.qa.result === 'fail' || c.qa.full === 'fail'));
const QA_RED = id => `${id}: QA is red: fix it or record a pass with aigile qa`;
const ALREADY =`Already waiting on the owner: bumped it to the top instead`;
// A reminder of the project's Definition of Ready / Done after `start` / `test` (AIG-864). Never blocks; plain output only.
async function dodNote(slug, kind, flags) {
  if (flags.json) return;
  try { const d = await api('GET', P(slug) + '/dod'); console.log((kind === 'ready' ? 'Definition of Ready:' : 'Definition of Done:') + '\n' + d[kind].map(i => '  [ ] ' + i).join('\n')); } catch {}
}
const cmds = {
  async add({ pos, flags }) {
    const slug = await project(pos[0]);
    const title = await text(pos[1], 'title');
    const b = { title };
    for (const [f, k] of [['type', 'type'], ['start-day', 'startDay'], ['priority', 'priority'], ['risk', 'risk'], ['status', 'status'], ['desc', 'description'], ['sprint', 'sprint'], ['group', 'group'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = flags[f] === true ? '' : (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (flags['needs-you']) b.needsYou = true;
    if (flags.life) {   // 🏡 AIG-394: a real-life task, the owner's own
      b.lifeType = flags.life;
      if (flags.at) { const w = require('../timed').parseWhen(flags.at); if (!w) die('--at: use "2026-10-12 14:00", "tomorrow 9:00", "+2h"'); b.apptAt = w; }
      if (flags.remind !== undefined) b.remindMins = Number(flags.remind);
      if (flags.every !== undefined) b.remindEvery = Number(flags.every);   // AIG-813: remind every N minutes until done
    }
    const c = await api('POST', P(slug) + '/cards', b);
    out(flags, c, c => 'added ' + line(c));
  },

  async edit({ pos, flags }) {
    const slug = await project(pos[0]);
    const b = {};
    for (const [f, k] of [['title', 'title'], ['type', 'type'], ['start-day', 'startDay'], ['priority', 'priority'], ['risk', 'risk'], ['desc', 'description'], ['sprint', 'sprint'], ['group', 'group'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (flags.life !== undefined) b.lifeType = flags.life === true ? '' : flags.life;   // AIG-813: make an existing card a 🏡 real-life task
    if (flags.every !== undefined) b.remindEvery = flags.every === true ? '' : Number(flags.every);
    if (!Object.keys(b).length) die('nothing to change; give at least one of --title --desc --type --priority --risk --sprint --group --assignee --test-steps');
    const c = await api('PATCH', C(slug, pos[1]), b);
    out(flags, c, c => 'updated ' + line(c));
  },

  async move({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!STATUSES.includes(pos[2])) die('status must be one of ' + STATUSES.join(', '));
    const body = { status: pos[2] };
    if (pos[2] === 'done') {   // 🔥 an incident is closed with its post-mortem (AIG-614)
      const card = (await api('GET', P(slug))).cards.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase());
      if (card && card.type === 'incident' && card.status !== 'done' && await rail('postmortem')) {
        const pm = { happened: flags.happened, why: flags.why, change: flags.change };
        if (!['happened', 'why', 'change'].every(k => typeof pm[k] === 'string' && pm[k].trim())) die('an incident needs its post-mortem before it is done: aigile move ' + slug + ' ' + card.id + ' done --happened "what happened" --why "why" --change "what we change"');
        body.postmortem = pm;
      }
    }
    if (pos[2] === 'doing') {   // ⚠️ a risky card needs its plan approved first (AIG-612)
      const card = (await api('GET', P(slug))).cards.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase());
      if (card && card.risk === 'risky' && card.status !== 'doing' && await rail('riskPlan')) {
        const cm = card.comments || [], isOwner = m => String(m.author || '').toLowerCase() === OWNER.toLowerCase();
        const planAt = cm.reduce((n, m, i) => /lead/i.test(m.author || '') && /plan/i.test(m.text || '') ? i : n, -1);
        const approved = planAt >= 0 && cm.slice(planAt + 1).some(isOwner);
        if (flags.planned) await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: `Plan approved by ${OWNER} (risky card)` });
        else if (!approved) die(`${card.id} is risky: post the plan first (aigile ask ${slug} ${card.id} "Plan: ..." --as Lead) and wait for ${OWNER}'s OK. Already approved? Add --planned.`);
      }
    }
    if (pos[2] === 'done' && !process.env.AIGILE_ALLOW_DONE) {
      // Teams may close a card once they've read the owner's comment on it ('For the team'); otherwise the owner accepts.
      const card = (await api('GET', P(slug))).cards.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase());
      if (card && card.status !== 'team') die(`only ${OWNER} moves cards to done (they accept them in 'verify'). Use: aigile test ...  (cards in 'team' you may move to done once you've read ${OWNER}'s comment)`);
    }
    const c = await api('PATCH', C(slug, pos[1]), body);
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
    await dodNote(slug, 'ready', flags);
  },

  // Definition of Ready / Done (AIG-864): dod <proj> prints both lists; dod <proj> ready|done "a|b|c" sets one (empty = the default).
  async dod({ pos, flags }) {
    const slug = await project(pos[0]);
    if (pos[1] !== undefined) {
      if (!['ready', 'done'].includes(pos[1])) die('usage: dod <proj> [ready|done "item1|item2"]');
      await api('PATCH', P(slug), { dod: { [pos[1]]: String(pos[2] || '') } });
    }
    const d = await api('GET', P(slug) + '/dod');
    out(flags, d, d => ['ready', 'done'].map(k => (k === 'ready' ? 'Definition of Ready' : 'Definition of Done') + ':\n' + d[k].map(i => '  - ' + i).join('\n')).join('\n'));
  },

  async assign({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('PATCH', C(slug, pos[1]), { assignee: pos[2] === undefined ? die('NAME is required (use "" to unassign)') : pos[2] });
    out(flags, c, c => 'assigned ' + line(c));
  },

  // AIG-426: carry on in another card, and Rich's chat follows.
  async 'next-card'({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1] || !pos[2]) die('usage: next-card <proj> <from-id> <to-id> --as NAME');
    const c = await api('POST', C(slug, pos[1]) + '/followup', { to: pos[2], author: who(flags) });
    out(flags, c, c => `${c.id}: the chat now follows to ${c.followUp}`);
  },

  // AIG-758: pop a card open in the app for the owner (only while the app is in front, else a chip they can click).
  async open({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('usage: open <proj> <id> --as NAME');
    const r = await api('POST', C(slug, pos[1]) + '/open', { author: who(flags) });
    out(flags, r, r => `asked the app to open ${r.id} for ${OWNER} (a chip if the app is not in front)`);
  },

  // 🌙 assume <proj> <id> "what I assumed and why": a comment marked as an assumption; it lands on the owner's Assumptions page (AIG-477).
  // Structured (AIG-526): --decided "what had to be decided" --chose "what we chose" --why "why" --if-plugged "what changes if he says no" [--options "A|B|C"].
  async assume({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('POST', C(slug, pos[1]) + '/comments', await assumeBody(pos[2], flags));
    out(flags, c, c => `logged an assumption on ${c.id}`);
  },

  async comment({ pos, flags }) {
    const slug = await project(pos[0]);
    const body = flags.assume ? await assumeBody(pos[2], flags)   // --assume: the same as 'aigile assume' (AIG-477)
      : { author: who(flags), text: await text(pos[2], 'comment text') };
    const c = await api('POST', C(slug, pos[1]) + '/comments', body);
    out(flags, c, c => `commented on ${c.id} (${c.comments.length} comments)`);
  },

  async dm({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('POST', `/api/projects/${slug}/dm`, { author: who(flags), text: await text(pos[1], 'message') });
    out(flags, c, c => `sent to ${OWNER}'s chat (${c.id})`);
  },

  // AIG-675: an agent writes to another agent: a roster name, Lead or Scrum Master.
  async msg({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1]) die('usage: msg <proj> <to> "text" --as NAME   (to: a roster name, Lead or Scrum Master)');
    const r = await api('POST', `/api/projects/${slug}/agentmsg`, { from: who(flags), to: pos[1], text: await text(pos[2], 'message') });
    out(flags, r, r => `sent to ${r.to} (${r.id})${r.woke ? ', woken' : ''}`);
  },

  async ask({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: await text(pos[2], 'question'), needsYou: true, mark: 'ask', options: flags.options });
    out(flags, c, c => c.bumped ? ALREADY : `asked ${OWNER} on ${c.id}; card now flagged NEEDS-OWNER. Move on to other work (aigile next ${slug}).`);
  },

  // 🔁 retro <proj> "suggested change to WAYS-OF-WORKING" --why "what happened" [--section "Git"] [--card AIG-x] --as NAME (AIG-865): one card, asked as a plan (Go / Not yet).
  async retro({ pos, flags }) {
    const slug = await project(pos[0]);
    const str = v => (typeof v === 'string' ? v : '');
    const c = await api('POST', P(slug) + '/retros', { text: await text(pos[1], 'suggested change'), why: str(flags.why), section: str(flags.section), card: str(flags.card), author: who(flags) });
    out(flags, c, c => `retro ${c.id} is waiting for ${OWNER}'s Go (🚦 Ready for go); WAYS-OF-WORKING changes only if he says Go.`);
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
    if (!['pass', 'fail', 'skip'].includes(result)) die('usage: checked <proj> <id> pass|fail|skip "what you saw" [--sure|--likely] [--shot a.png] --as NAME');
    const note = await text(pos[3], 'what you saw');
    const attachments = await uploadShots(slug, flags.shot);
    const c = await api('POST', C(slug, pos[1]) + '/aicheck', { result, note, by: who(flags), attachments, ...(result === 'pass' ? { sure: !!flags.sure && !flags.likely } : {}) });
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
    // 👥 Group chats (AIG-1027): group say <id> "text" --as NAME [--project SLUG]  /  group show <id> [--n N]
    if (pos[0] === 'say' || pos[0] === 'show') {
      const id = pos[1]; if (!id) die(`usage: group ${pos[0]} <group id>` + (pos[0] === 'say' ? ' "text" --as NAME' : ' [--n 30]'));
      const G = '/api/chats/_groups/' + encodeURIComponent(id);
      if (pos[0] === 'say') { const m = await api('POST', G + '/say', { as: who(flags), text: await text(pos[2], 'message'), ...(typeof flags.project === 'string' ? { project: flags.project } : {}) }); return out(flags, m, () => 'said in the group'); }
      const g = await api('GET', G + '/show' + (flags.n ? '?n=' + encodeURIComponent(flags.n) : ''));
      return out(flags, g, g => `👥 ${g.name} (${g.id}): ${OWNER}, ${g.members.map(m => `${m.name} (${m.engineLabel}, ${m.project})`).join(', ')}\n` + (g.messages.map(m => `${when(m.at)} ${m.author}: ${m.text}`).join('\n') || 'No messages yet.'));
    }
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
    // AIG-966: a re-hand-over with no word from the owner since the last one doesn't post the same note again (the firewall kept those as duplicates).
    const handedAgain = (card, note, files) => {
      if (files && files.length) return false;
      const cm = (card && card.comments) || [], { isRich } = require('../store');
      let i = cm.length - 1; while (i >= 0 && !isRich(cm[i].author)) i--;
      return cm.slice(i + 1).some(m => String(m.text || '').trim() === note);
    };
    if (members.length && (gname || !all.some(c => c.id.toLowerCase() === String(pos[1]).toLowerCase()))) {
      const author = who(flags), shared = gname ? pos[1] : pos[2];
      const red = (await rail('qaGate')) && members.find(qaRed); if (red) die(QA_RED(red.id));
      if (!shared && members.some(c => !c.testSteps)) die('give the test steps (shared by the whole group), or give every card in the group its own first');
      for (const c of members) {
        await queueInfo(slug, c.id, flags);
        await api('PATCH', C(slug, c.id), { status: 'verify', ...(typeof flags.check === 'string' ? { checklist: flags.check } : {}), ...(shared ? { testSteps: await text(shared, 'test steps') } : {}), needsYou: false, ...(flags.open ? { openUrl: flags.open, startCmd: flags.start || '' } : {}) });
        if (flags.commit) await api('POST', C(slug, c.id) + '/proof', { commit: flags.commit });
        const note = `Ready for you to test, with the group "${members[0].group}". Steps are on the card.`, files = await uploadShots(slug, flags.shot);
        if (!handedAgain(c, note, files)) await api('POST', C(slug, c.id) + '/comments', { author, text: note, needsYou: false, attachments: files });
      }
      await dodNote(slug, 'done', flags);
      return out(flags, members, () => `handed ${members.length} cards of group "${members[0].group}" to ${OWNER}: ${members.map(c => c.id).join(', ')}`);
    }
    if (qaRed(all.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase())) && await rail('qaGate')) die(QA_RED(String(pos[1]).toUpperCase()));
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    const steps = await text(pos[2], 'test steps');
    // --open URL [--start "command"]: the card gets a ▶ Open it button (AIG-146).
    await api('PATCH', C(slug, pos[1]), { status: 'verify', testSteps: steps, needsYou: false, ...(typeof flags.check === 'string' ? { checklist: flags.check } : {}), info: !!flags.info || require('../store').isInfoSteps(steps), ...(flags.open ? { openUrl: flags.open, startCmd: flags.start || '' } : {}) });
    // Proof on hand-back (AIG-166): --commit <sha> lets the board attach what changed; --shot a.png,b.png adds screenshots.
    if (flags.commit) await api('POST', C(slug, pos[1]) + '/proof', { commit: flags.commit });
    const attachments = await uploadShots(slug, flags.shot);
    const note = 'Ready for you to test. Steps are on the card.', before = all.find(x => x.id.toLowerCase() === String(pos[1]).toLowerCase());
    const c = handedAgain(before, note, attachments) ? { ...before, status: 'verify', testSteps: steps } : await api('POST', C(slug, pos[1]) + '/comments', { author, text: note, needsYou: false, attachments });
    // AIG-610: the last part of a series ("Title 3/3") takes the earlier parts that are in verify with it (the fold route does the work).
    const m = String(c.title || '').match(/^(.*\S)\s+(\d+)\/(\d+)\s*$/);
    if (m && m[2] === m[3] && +m[3] > 1) {
      const stem = m[1].toLowerCase();
      const parts = (await api('GET', P(slug))).cards.filter(x => x.id !== c.id && x.status === 'verify' && (x.title.match(/^(.*\S)\s+(\d+)\/(\d+)\s*$/) || [])[1]?.toLowerCase() === stem && (x.title.match(/(\d+)\/(\d+)\s*$/) || [])[2] === m[3]);
      for (const x of parts) await api('POST', C(slug, x.id) + '/fold', { into: c.id, author });
      if (parts.length) { out(flags, c, c => `handed to ${OWNER}: ` + line(c) + `\nfolded ${parts.map(x => x.id).join(', ')} into it (parts of "${m[1]}")`); return await dodNote(slug, 'done', flags); }
    }
    out(flags, c, c => `handed to ${OWNER}: ` + line(c));
    await dodNote(slug, 'done', flags);
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

  // 🟢 QA (AIG-613): the merge gate on the card: the areas run, their result and the full suite.
  async qa({ pos, flags }) {
    const slug = await project(pos[0]);
    const pf = v => v === 'pass' || v === 'fail';
    if (flags.full === true) flags.full = pos[2];   // --full is a plain switch elsewhere, so its pass|fail lands as a word
    if (!pos[1] || !pf(flags.result) || (flags.full !== undefined && !pf(flags.full))) die('usage: qa <proj> <id> --areas a,b --result pass|fail [--full pass|fail] [--note "..."] --as NAME');
    const qa = { areas: typeof flags.areas === 'string' ? flags.areas : '', result: flags.result, by: who(flags), ...(flags.full !== undefined ? { full: flags.full } : {}), ...(typeof flags.note === 'string' ? { note: flags.note } : {}) };
    const c = await api('PATCH', C(slug, pos[1]), { qa });
    const g = c.qa || {};
    out(flags, c, c => `QA ${qaRed(c) ? 'red' : 'green'}${g.areas.length ? ' (' + g.areas.join(', ') + ')' : ''}${g.full ? ', full suite ' + g.full : ''}: ` + line(c));
  },

  // ⚠️ Risk (AIG-612): small | normal | risky (risky = plan first)
  async risk({ pos, flags }) {
    const slug = await project(pos[0]);
    // 📒 The risk register (AIG-863): `risk <proj>` lists, `risk <proj> add "risk" ...`, `risk <proj> set <rid> ...`
    if (!pos[1] || pos[1] === 'add' || pos[1] === 'set') {
      const f = v => (typeof v === 'string' ? v : undefined);
      const fields = { card: f(flags.card), category: f(flags.category), likelihood: f(flags.likelihood), impact: f(flags.impact), owner: f(flags.owner), mitigation: f(flags.mitigation), warning: f(flags.warning), review: f(flags.review), status: f(flags.status) };
      for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
      if (pos[1] === 'add') {
        const r = await api('POST', P(slug) + '/risks', { ...fields, risk: await text(pos[2], 'the risk'), createdBy: who(flags) });
        return out(flags, r, r => `${r.id} added (score ${r.score}): ${r.risk}`);
      }
      if (pos[1] === 'set') {
        if (!pos[2]) die('usage: risk <proj> set <rid> [--status open|watching|closed|happened --likelihood 1-3 --impact 1-3 --review YYYY-MM-DD --owner --mitigation --warning --card --category]');
        if (flags.risk && typeof flags.risk === 'string') fields.risk = flags.risk;
        const r = await api('PATCH', P(slug) + '/risks/' + pos[2], fields);
        return out(flags, r, r => `${r.id} [${r.status}] score ${r.score}${r.incident ? ' -> ' + r.incident : ''}: ${r.risk}`);
      }
      const d = await api('GET', P(slug) + '/risks');
      return out(flags, d, d => d.risks.length ? d.risks.map(r => `${r.id} [${r.status}] score ${r.score} (L${r.likelihood}xI${r.impact})${r.card ? ' ' + r.card : ''}${r.overdue ? ' OVERDUE review ' + r.review : r.review ? ' review ' + r.review : ''}${r.owner ? ' @' + r.owner : ''}: ${r.risk}`).join('\n') : 'no risks yet');
    }
    if (!pos[1] || !['small', 'normal', 'risky'].includes(pos[2])) die('usage: risk <proj> <id> small|normal|risky --as NAME');
    const c = await api('PATCH', C(slug, pos[1]), { risk: pos[2] });
    out(flags, c, c => 'risk ' + pos[2] + ': ' + line(c));
  },

  // 🧩 Problem card (AIG-887): one cause behind repeat incidents. `problem <proj>` lists, `add "title" [--incidents A,B]`,
  // `<id> [--cause ".." --workaround ".." --change AIG-x]`, `<id> link AIG-x`.
  async problem({ pos, flags }) {
    const slug = await project(pos[0]);
    const f = v => (typeof v === 'string' ? v : undefined);
    const fields = { rootCause: f(flags.cause), workaround: f(flags.workaround), change: f(flags.change), incidents: f(flags.incidents) };
    for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
    const show = r => `${r.id} [${r.status}] ${r.title}${r.incidents.length ? ' incidents ' + r.incidents.join(',') : ''}${r.changeId ? ' fix ' + r.changeId : ''}${r.rootCause ? '\n  cause: ' + r.rootCause : ''}${r.workaround ? '\n  workaround: ' + r.workaround : ''}`;
    if (pos[1] === 'add') {
      const r = await api('POST', P(slug) + '/problems', { ...fields, title: await text(pos[2], 'the title'), createdBy: who(flags) });
      return out(flags, r, r => 'added ' + show(r));
    }
    if (pos[1] && pos[2] === 'link') {
      if (!pos[3]) die('usage: problem <proj> <id> link AIG-x');
      const r = await api('POST', P(slug) + '/problems/' + pos[1] + '/link', { incident: pos[3] });
      return out(flags, r, r => 'linked ' + show(r));
    }
    if (pos[1]) {
      if (!Object.keys(fields).length) die('usage: problem <proj> <id> [--cause ".." --workaround ".." --change AIG-x --incidents A,B]  |  problem <proj> <id> link AIG-x');
      const r = await api('PATCH', P(slug) + '/problems/' + pos[1], fields);
      return out(flags, r, r => 'updated ' + show(r));
    }
    const d = await api('GET', P(slug) + '/problems');
    out(flags, d, d => d.problems.length ? d.problems.map(show).join('\n') : 'no problem cards');
  },

  // 🗂️ Configuration items (AIG-1122): `ci <proj>` lists, `ci <proj> add <kind> <name> [--detail --expires --backup-where --backup-days --links]`, `set <id> ...`, `rm <id>` (owner).
  async ci({ pos, flags }) {
    const slug = await project(pos[0]), ci = require('../ci'), f = v => (typeof v === 'string' ? v : undefined);
    const body = () => {
      const b = { detail: f(flags.detail), expires: f(flags.expires), links: f(flags.links), name: f(flags.name), kind: f(flags.kind) };
      if (f(flags['backup-where']) !== undefined || f(flags['backup-days']) !== undefined) b.backup = { where: f(flags['backup-where']) || '', everyDays: f(flags['backup-days']) };
      for (const k of Object.keys(b)) if (b[k] === undefined) delete b[k];
      return b;
    };
    if (pos[1] === 'add' || pos[1] === 'set' || pos[1] === 'rm') who(flags);   // the board lets only the owner change items
    if (pos[1] === 'add') {
      if (!pos[2] || !pos[3]) die('usage: ci <proj> add <' + ci.KINDS.join('|') + '> <name> [--detail T --expires YYYY-MM-DD --backup-where W --backup-days N --links A,B]');
      const r = await api('POST', P(slug) + '/ci', { ...body(), kind: pos[2], name: pos[3] });
      return out(flags, r, ci.show);
    }
    if (pos[1] === 'set') {
      if (!pos[2]) die('usage: ci <proj> set <id> [--name --kind --detail --expires --backup-where --backup-days --links]');
      const r = await api('PATCH', P(slug) + '/ci/' + encodeURIComponent(pos[2]), body());
      return out(flags, r, ci.show);
    }
    if (pos[1] === 'backed-up') {   // 💾 sets the item's last backup to today (AIG-1126)
      if (!pos[2]) die('usage: ci <proj> backed-up <id>');
      who(flags);
      return out(flags, await api('POST', P(slug) + '/ci/' + encodeURIComponent(pos[2]) + '/backed-up', {}), ci.show);
    }
    if (pos[1] === 'rm') {
      if (!pos[2]) die('usage: ci <proj> rm <id>');
      const r = await api('DELETE', P(slug) + '/ci/' + encodeURIComponent(pos[2]));
      return out(flags, r, r => r.id + ' removed');
    }
    const d = await api('GET', P(slug) + '/ci');
    out(flags, d, d => d.items.length ? d.items.map(ci.show).join('\n') : 'no configuration items (aigile ci ' + slug + ' add <kind> <name>)');
  },

  // 📖 Runbooks (AIG-1107): `runbook <proj>` lists the names, `runbook <proj> <name>` prints one (docs/runbooks/<name>.md).
  async runbook({ pos, flags }) {
    const slug = await project(pos[0]);
    if (pos[1]) {
      const r = await api('GET', P(slug) + '/runbooks/' + encodeURIComponent(pos[1]));
      return out(flags, r, r => r.text.replace(/\s+$/, ''));
    }
    const d = await api('GET', P(slug) + '/runbooks');
    out(flags, d, d => d.runbooks.length ? d.runbooks.join('\n') : 'no runbooks (put markdown files in docs/runbooks/ in the project folder)');
  },

  // ⭐ Crucial (AIG-549): a crucial card still runs while the usage saver is on.
  async crucial({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!pos[1] || (pos[2] && pos[2] !== 'off')) die('usage: crucial <proj> <id> [off]');
    const on = pos[2] !== 'off', c = await api('PATCH', C(slug, pos[1]), { crucial: on });
    out(flags, c, c => (on ? '⭐ crucial: ' : 'no longer crucial: ') + line(c));
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
