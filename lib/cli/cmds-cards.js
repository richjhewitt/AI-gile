// aigile commands: add, edit, move, start, assign, comment, dm, ask, tests, checked, fold, test, task, block, unblock (split from aigile.js, AIG-297).
const { STATUSES, queueInfo, uploadShots, OWNER, die, text, api, project, P, C, who, line, when, out } = require('./core');

const cmds = {
  async add({ pos, flags }) {
    const slug = await project(pos[0]);
    const title = await text(pos[1], 'title');
    const b = { title };
    for (const [f, k] of [['type', 'type'], ['priority', 'priority'], ['status', 'status'], ['desc', 'description'], ['sprint', 'sprint'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = flags[f] === true ? '' : (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (flags['needs-you']) b.needsYou = true;
    const c = await api('POST', P(slug) + '/cards', b);
    out(flags, c, c => 'added ' + line(c));
  },

  async edit({ pos, flags }) {
    const slug = await project(pos[0]);
    const b = {};
    for (const [f, k] of [['title', 'title'], ['type', 'type'], ['priority', 'priority'], ['desc', 'description'], ['sprint', 'sprint'], ['assignee', 'assignee'], ['test-steps', 'testSteps']])
      if (flags[f] !== undefined) b[k] = (f === 'desc' || f === 'test-steps') ? await text(flags[f], f) : flags[f];
    if (!Object.keys(b).length) die('nothing to change; give at least one of --title --desc --type --priority --sprint --assignee --test-steps');
    const c = await api('PATCH', C(slug, pos[1]), b);
    out(flags, c, c => 'updated ' + line(c));
  },

  async move({ pos, flags }) {
    const slug = await project(pos[0]);
    if (!STATUSES.includes(pos[2])) die('status must be one of ' + STATUSES.join(', '));
    if (pos[2] === 'done' && !process.env.AIGILE_ALLOW_DONE) {
      // Teams may close a card once they've read Rich's comment on it ('For the team'); otherwise Rich accepts.
      const card = (await api('GET', P(slug))).cards.find(c => c.id.toLowerCase() === String(pos[1]).toLowerCase());
      if (card && card.status !== 'team') die(`only ${OWNER} moves cards to done (they accept them in 'verify'). Use: aigile test ...  (cards in 'team' you may move to done once you've read ${OWNER}'s comment)`);
    }
    const c = await api('PATCH', C(slug, pos[1]), { status: pos[2] });
    out(flags, c, c => 'moved ' + line(c));
  },

  async start({ pos, flags }) {
    const slug = await project(pos[0]);
    const name = who(flags);
    const c = await api('PATCH', C(slug, pos[1]), { status: 'doing', assignee: name });
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
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: await text(pos[2], 'question'), needsYou: true, options: flags.options });
    out(flags, c, c => `asked ${OWNER} on ${c.id}; card now flagged NEEDS-OWNER. Move on to other work (aigile next ${slug}).`);
  },

  // AI tester (AIG-163): the tests waiting for the owner that nobody has checked yet, steps included, compact.
  async tests({ pos, flags }) {
    const slug = await project(pos[0]);
    const list = (await api('GET', '/api/projects/' + slug)).cards.filter(c => c.status === 'verify' && (flags.all || !c.aiCheck));
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

  async test({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    const steps = await text(pos[2], 'test steps');
    // --open URL [--start "command"]: the card gets a ▶ Open it button (AIG-146).
    await api('PATCH', C(slug, pos[1]), { status: 'verify', testSteps: steps, needsYou: false, ...(flags.open ? { openUrl: flags.open, startCmd: flags.start || '' } : {}) });
    // Proof on hand-back (AIG-166): --commit <sha> lets the board attach what changed; --shot a.png,b.png adds screenshots.
    if (flags.commit) await api('POST', C(slug, pos[1]) + '/proof', { commit: flags.commit });
    const attachments = await uploadShots(slug, flags.shot);
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author, text: 'Ready for you to test. Steps are on the card.', needsYou: false, attachments });
    out(flags, c, c => `handed to ${OWNER}: ` + line(c));
  },

  // Something only Rich can do (a key, a login, a manual step): assigns the card to him with the instructions.
  // It shows in his inbox under "Tasks for you"; when he clicks Done it comes back to you via "For the team".
  async task({ pos, flags }) {
    const slug = await project(pos[0]);
    await queueInfo(slug, pos[1], flags);
    const author = who(flags);
    const what = await text(pos[2], `what ${OWNER} needs to do`);
    await api('PATCH', C(slug, pos[1]), { assignee: OWNER, needsYou: false });
    const c = await api('POST', C(slug, pos[1]) + '/comments', { author, text: what, needsYou: false });
    out(flags, c, c => `task for ${OWNER} on ${c.id}: it's in their inbox. Carry on with other work (aigile next ${slug}).`);
  },

  async block({ pos, flags }) {
    const slug = await project(pos[0]);
    let c = await api('PATCH', C(slug, pos[1]), { blocked: true });
    if (pos[2]) c = await api('POST', C(slug, pos[1]) + '/comments', { author: who(flags), text: 'Blocked: ' + await text(pos[2], 'reason') });
    out(flags, c, c => 'blocked ' + line(c));
  },

  async unblock({ pos, flags }) {
    const slug = await project(pos[0]);
    const c = await api('PATCH', C(slug, pos[1]), { blocked: false });
    out(flags, c, c => 'unblocked ' + line(c));
  },
};
module.exports = cmds;
