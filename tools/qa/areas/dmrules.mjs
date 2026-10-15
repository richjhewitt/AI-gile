// QA area: dmrules (AIG-551): while the usage saver or No Token Mode is on, the owner's DM to a lead or to the Lead Scrum Master
// gets a rule-based, automated reply (help, status, list, move, park, crucial) and no AI run starts.
import fs from 'node:fs';
import { check, sleep, tmp, mkProject, mkCard, getCard, openPage, def } from '../lib.mjs';

def('dmrules', '💬 DM housekeeping without AI: help, status, list, move, park, crucial, unknown text, no run started (AIG-551)', async (s, ctx) => {
  await mkProject(s, 'Rules', 'RUL', { path: tmp('rules') });
  const doing = await mkCard(s, 'rules', 'building it', { status: 'doing' });
  const todo = await mkCard(s, 'rules', 'later thing', { status: 'todo' });
  const idle = async () => { await sleep(700); return !(await s.ok('GET', '/api/projects/rules')).presence.running && !fs.existsSync(s.wakeOut); };
  // A DM to the lead: a quick card, as the page sends it. Returns the lead's reply.
  const dm = async text => {
    const c = await s.ok('POST', '/api/projects/rules/cards', { title: '💬 ' + text.slice(0, 40), description: text, type: 'task', status: 'team', createdBy: 'Owner', quick: true });
    const full = await getCard(s, 'rules', c.id);
    return { card: full, reply: full.comments.filter(m => m.auto).at(-1) };
  };

  // Not saving: no rule reply (the normal path).
  const plain = await dm('status');
  check('with AI allowed, no automated reply', !plain.reply, JSON.stringify(plain.card.comments));
  await sleep(1200); fs.rmSync(s.wakeOut, { force: true });
  // AIG-1215: the owner's own 💬 ending with "?" is an instruction to the team, not a question waiting on him.
  { const q = await s.ok('POST', '/api/projects/rules/cards', { title: '💬 can the team plan this in?', description: 'can the team plan this in?', type: 'task', status: 'team', createdBy: 'Owner', quick: true });
    const cm = body => s.ok('POST', '/api/projects/rules/cards/' + q.id + '/comments', body);
    check('owner 💬 ending with ? is not NEEDS-OWNER', (await getCard(s, 'rules', q.id)).needsYou === false);
    await cm({ author: 'Lead', text: '- Done: planned in' });
    const after = await getCard(s, 'rules', q.id);
    check('a plain team reply does not flag it, and it stays For the team', after.needsYou === false && after.status === 'team', JSON.stringify(after));
    await cm({ author: 'Lead', text: 'Which sprint?', mark: 'ask' });
    check('a team ask still flags it NEEDS-OWNER', (await getCard(s, 'rules', q.id)).needsYou === true); }
  for (let i = 0; i < 40 && (await s.ok('GET', '/api/projects/rules')).presence.running; i++) await sleep(250);
  fs.rmSync(s.wakeOut, { force: true });

  // Saver on.
  const h5Resets = Math.floor(Date.now() / 1000) + 3600, wkResets = h5Resets + 86400;
  await s.ok('POST', '/api/setup', { prefs: { plan: 'normal', saveH5: 80, saveWk: 85 } });
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 82, resets_at: h5Resets }, seven_day: { used_percentage: 10, resets_at: wkResets } } });
  check('the saver is on', !!(await s.ok('GET', '/api/limits/latest')).saving);
  fs.rmSync(s.wakeOut, { force: true });

  let r = await dm('Help');
  check('help lists the commands (any case), flagged automated', r.reply && /status/.test(r.reply.text) && /move/.test(r.reply.text) && r.reply.auto === true, JSON.stringify(r.card.comments));
  check('the reply is from the lead', r.reply && r.reply.author === 'Lead', r.reply && r.reply.author);
  r = await dm('Status');
  check('status counts the columns and names what is doing', r.reply && /Doing 1/.test(r.reply.text) && new RegExp(doing.id).test(r.reply.text) && /To do 1/.test(r.reply.text), r.reply && r.reply.text);
  r = await dm('LIST todo');
  check('list todo shows the To do cards', r.reply && new RegExp(todo.id).test(r.reply.text) && !new RegExp(doing.id).test(r.reply.text), r.reply && r.reply.text);
  r = await dm(`move ${todo.id.toLowerCase()} done`);
  check('move changes the status', r.reply && /Moved/.test(r.reply.text) && (await getCard(s, 'rules', todo.id)).status === 'done', r.reply && r.reply.text);
  r = await dm(`park ${doing.id}`);
  check('park puts the card in the Backlog', (await getCard(s, 'rules', doing.id)).status === 'backlog' && /Parked/.test(r.reply.text), r.reply && r.reply.text);
  r = await dm(`crucial ${doing.id}`);
  check('crucial marks the card crucial', (await getCard(s, 'rules', doing.id)).crucial === true && /crucial/.test(r.reply.text), r.reply && r.reply.text);
  r = await dm('move RUL-999 done');
  check('an unknown card id is said so', r.reply && /RUL-999/.test(r.reply.text), r.reply && r.reply.text);
  r = await dm(`move ${doing.id} nowhere`);
  check('an unknown column is said so, the card stays', r.reply && /nowhere/.test(r.reply.text) && (await getCard(s, 'rules', doing.id)).status === 'backlog', r.reply && r.reply.text);
  r = await dm('please refactor the whole thing');
  check('other text: one reply that it waits until usage is back', r.reply && /until usage is back/.test(r.reply.text) && r.card.comments.filter(m => m.auto).length === 1, r.reply && r.reply.text);
  check('and the message itself is kept for the lead', r.card.description === 'please refactor the whole thing');
  check('the chat marks the reply automated', JSON.stringify(await s.ok('GET', '/api/chats/rules')).includes('"auto":true'));

  // A reply typed in an existing DM card is ruled too.
  const c = r.card;
  await s.ok('POST', `/api/projects/rules/cards/${c.id}/comments`, { text: 'status', author: 'Owner' });
  const after = await getCard(s, 'rules', c.id);
  check('a reply inside the DM gets a rule reply', after.comments.filter(m => m.auto).length === 2 && /Doing/.test(after.comments.at(-1).text), JSON.stringify(after.comments.map(m => m.text)));
  check('no AI run started for any of it', await idle());

  // AIG-566: a chip on each lead reply: ⚙ automated for rule replies, ✨ AI for a comment written through the CLI; legend in the view.
  check('a CLI comment is stored as an AI one (auto false)', (s.cli(['comment', 'rules', c.id, 'Sure, on it', '--as', 'Lead']).code === 0) && (await getCard(s, 'rules', c.id)).comments.at(-1).auto === false);
  const pg = await openPage(ctx, '#/');
  await pg.click('#dmRail [data-dms]'); await pg.click('#dmPanel [data-dm="rules"]');
  await pg.waitForSelector('#dmList .dm-origin.ai', { timeout: 6000 }).catch(() => {});
  check('a rule reply shows the ⚙ Automated, free chip', /Automated, free/.test(await pg.textContent('#dmList .dm-origin.auto').catch(() => '')));
  check('a CLI comment shows the ✨ AI, uses tokens chip', /AI, uses tokens/.test(await pg.textContent('#dmList .dm-origin.ai').catch(() => '')));
  check('the owner\'s own message has no chip', await pg.evaluate(() => ![...document.querySelectorAll('#dmList .dm-msg.mine')].some(m => m.querySelector('.dm-origin'))));
  // AIG-926: no legend line above the composer any more; each chip says what it means itself.
  check('no jargon legend line in the DM view', !(await pg.$('.dm-legend')));
  await pg.close();

  // The Lead Scrum Master.
  await s.ok('POST', '/api/chats/_watchman', { text: 'status' });
  await s.ok('POST', '/api/chats/_watchman', { text: 'tell the teams to hurry' });
  const chat = await s.ok('GET', '/api/chats/_watchman');
  const auto = chat.messages.filter(m => m.auto);
  check('the Scrum Master answers status by rule, flagged automated', auto.length === 2 && /Rules/.test(auto[0].text) && /Lead Scrum Master/.test(auto[0].author), JSON.stringify(chat.messages));
  check('and says other text waits until usage is back', /until usage is back/.test(auto[1].text), auto[1] && auto[1].text);
  check('the Scrum Master started no run', !chat.busy && await idle());

  // No Token Mode does the same.
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 10, resets_at: h5Resets }, seven_day: { used_percentage: 10, resets_at: wkResets } } });
  r = await dm('help');
  check('with AI allowed again, no rule reply', !r.reply);
  for (let i = 0; i < 40 && (await s.ok('GET', '/api/projects/rules')).presence.running; i++) await sleep(250);
  await s.ok('POST', '/api/notokens', { on: true });
  fs.rmSync(s.wakeOut, { force: true });
  r = await dm('list backlog');
  check('No Token Mode gives rule replies too', r.reply && new RegExp(doing.id).test(r.reply.text), r.reply && r.reply.text);
  check('and starts no run', await idle());
  await s.ok('POST', '/api/notokens', { on: false });

  // AIG-609: GO on a 💬 card whose last lead comment names backlog cards: they move to To do, the lead says so (automated), the 💬 card is done.
  await mkProject(s, 'Gos', 'GOS', { path: tmp('gos') });
  await s.ok('POST', '/api/projects/gos/team', { name: 'Lead', role: 'Lead' }); await s.ok('POST', '/api/projects/gos/team', { name: 'Forge', role: 'Backend' });
  const b1 = await mkCard(s, 'gos', 'first idea', { status: 'backlog' }), b2 = await mkCard(s, 'gos', 'second idea', { status: 'backlog' }), b3 = await mkCard(s, 'gos', 'third idea', { status: 'backlog' });
  const talk = await s.ok('POST', '/api/projects/gos/cards', { title: '💬 what next', description: 'what next?', type: 'task', status: 'team', createdBy: 'Owner', quick: true });
  await s.ok('POST', `/api/projects/gos/cards/${talk.id}/comments`, { author: 'Lead', text: `I suggest ${b1.id} and ${b2.id}. Shall I start them?` });
  fs.rmSync(s.wakeOut, { force: true });
  await s.ok('POST', `/api/projects/gos/cards/${talk.id}/comments`, { author: 'Owner', text: '👍 go' });
  const gt = await getCard(s, 'gos', talk.id);
  check('GO moves the named backlog cards to To do', (await getCard(s, 'gos', b1.id)).status === 'todo' && (await getCard(s, 'gos', b2.id)).status === 'todo' && (await getCard(s, 'gos', b3.id)).status === 'backlog');
  check('the lead comments "On it" with the ids, flagged automated', gt.comments.at(-1).auto === true && gt.comments.at(-1).author === 'Lead' && new RegExp(`On it: ${b1.id}, ${b2.id} are in To do`).test(gt.comments.at(-1).text), gt.comments.at(-1));
  check('the 💬 card is done and the lead was not woken for the GO', gt.status === 'done' && !fs.existsSync(s.wakeOut));
  const talk2 = await s.ok('POST', '/api/projects/gos/cards', { title: '💬 again', description: 'x', type: 'task', status: 'team', createdBy: 'Owner', quick: true });
  await s.ok('POST', `/api/projects/gos/cards/${talk2.id}/comments`, { author: 'Lead', text: `Should I do ${b3.id}?` });
  await s.ok('POST', `/api/projects/gos/cards/${talk2.id}/comments`, { author: 'Owner', text: 'go ahead and also think about the colours' });
  check('longer text is not a GO: the backlog card stays', (await getCard(s, 'gos', b3.id)).status === 'backlog' && (await getCard(s, 'gos', talk2.id)).status !== 'done');

  // AIG-610: handing over the last part ("... 3/3") folds the earlier parts that wait in verify.
  const p1 = await mkCard(s, 'gos', 'Big thing 1/3', { status: 'verify', testSteps: '1. a' }), p2 = await mkCard(s, 'gos', 'Big thing 2/3', { status: 'verify', testSteps: '1. b' });
  const other = await mkCard(s, 'gos', 'Other 1/2', { status: 'verify', testSteps: '1. z' });
  const p3 = await mkCard(s, 'gos', 'Big thing 3/3', { status: 'doing' });
  const tr = s.cli(['test', 'gos', p3.id, '1. c', '--as', 'Lead']);
  check('test on the last part succeeds', tr.code === 0, tr);
  const q1 = await getCard(s, 'gos', p1.id), q3 = await getCard(s, 'gos', p3.id);
  check('the earlier parts are folded into it', q1.status === 'done' && (await getCard(s, 'gos', p2.id)).status === 'done' && q3.status === 'verify' && /1\. a/.test(q3.testSteps) && /1\. b/.test(q3.testSteps), q3.testSteps);
  check('a different title stem is left alone', (await getCard(s, 'gos', other.id)).status === 'verify');

  // AIG-611: the last roster member answering closes the 📣 Stand-up.
  await s.ok('POST', '/api/standup', { projects: ['gos'] });
  const names = ((await s.ok('GET', '/api/projects/gos')).team || []).filter(m => !/retired/i.test(m.status || '')).map(m => m.name);
  const stand = () => s.ok('GET', '/api/projects/gos').then(p => p.cards.find(c => c.standup));
  for (const n of names.slice(0, -1)) s.cli(['standup', 'gos', '--done', 'x', '--next', 'y', '--as', n]);
  check('with someone still to answer, the stand-up stays open', names.length > 0 && (await stand()).status !== 'done', names);
  s.cli(['standup', 'gos', '--done', 'x', '--next', 'y', '--as', names.at(-1)]);
  check('the last member answering moves the stand-up to done', (await stand()).status === 'done');
}, true);
