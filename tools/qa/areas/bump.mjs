// QA area: bump (AIG-373): a second task / question for the owner bumps the open one instead of adding a copy.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('bump', 'task / ask on a card that already has an open one bumps it (chip, order, one Updated line); aigile bump; dedupe route (AIG-373)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('bp') });
  const a = await mkCard(s, 'alpha', 'DNS step'), b = await mkCard(s, 'alpha', 'Other task'), q = await mkCard(s, 'alpha', 'Format question'), q2 = await mkCard(s, 'alpha', 'Later question');
  const cli = (...args) => s.cli(args);
  const dnsText = c => c.comments.filter(m => m.mark === 'task');

  cli('task', 'alpha', a.id, 'Add the  DNS record\nfor relay', '--as', 'Lead');
  const r2 = cli('task', 'alpha', a.id, 'Add the DNS record for relay', '--as', 'Lead');
  let c = await getCard(s, 'alpha', a.id);
  check('the same task twice leaves one task comment', dnsText(c).length === 1, c.comments);
  check('the CLI says it bumped instead', /Already waiting on the owner: bumped it to the top instead/.test(r2.out), r2);
  check('the bump is recorded with a count and a time, text unchanged', c.bumpedAt && c.bumps === 1 && dnsText(c)[0].bumps === 1 && !/Updated:/.test(dnsText(c)[0].text), c);
  cli('task', 'alpha', a.id, 'Add the DNS record for relay, TTL 300', '--as', 'Lead');
  cli('task', 'alpha', a.id, 'Add the DNS record for relay, TTL 600', '--as', 'Lead');
  c = await getCard(s, 'alpha', a.id);
  const tm = dnsText(c);
  check('a different text becomes one Updated: line (the latest), still one task', tm.length === 1 && c.bumps === 3 && (tm[0].text.match(/Updated:/g) || []).length === 1 && /Updated: Add the DNS record for relay, TTL 600$/.test(tm[0].text), tm);

  cli('task', 'alpha', b.id, 'Second card task', '--as', 'Lead');
  cli('ask', 'alpha', q.id, 'Which format?', '--as', 'Lead', '--options', 'M3U,JSON');
  cli('ask', 'alpha', q2.id, 'Which colour?', '--as', 'Lead');
  const ra = cli('ask', 'alpha', q.id, 'Which format?', '--as', 'Lead');
  const qc = await getCard(s, 'alpha', q.id);
  check('ask twice: one question, bumped, CLI says so', qc.comments.filter(m => m.mark === 'ask').length === 1 && qc.bumps === 1 && /Already waiting/.test(ra.out), [qc.comments, ra]);

  const inbox = await s.ok('GET', '/api/inbox');
  check('the inbox lists a bumped card before the longer-waiting ones', inbox[0].bumpedAt && [a.id, q.id].includes(inbox[0].id), inbox.map(x => x.id));

  const eb = cli('bump', 'alpha', b.id, '--as', 'Lead');
  const bc = await getCard(s, 'alpha', b.id);
  check('aigile bump bumps the open task without adding a comment', bc.bumps === 1 && bc.comments.length === 1 && /bumped/.test(eb.out), [bc, eb]);
  const empty = await mkCard(s, 'alpha', 'Nothing waiting');
  const nb = await s.api('POST', `/api/projects/alpha/cards/${empty.id}/bump`, {});
  check('bump with nothing waiting is refused', nb.status === 400, nb);

  await s.ok('POST', `/api/projects/alpha/cards/${a.id}/taskdone`, { text: 'done' });
  cli('task', 'alpha', a.id, 'Add the DNS record for relay', '--as', 'Lead');
  c = await getCard(s, 'alpha', a.id);
  check('after Done the same text is a fresh task, not a bump', dnsText(c).length === 2 && !c.bumps && !c.bumpedAt, c);

  // The owner commenting on a card with an open task must not drop the task: Done stays.
  await s.ok('POST', `/api/projects/alpha/cards/${b.id}/comments`, { author: 'Owner', text: 'on it, a question first' });
  const kb = await getCard(s, 'alpha', b.id);
  check('an owner comment keeps the open task assigned to the owner', kb.assignee === 'Owner', kb.assignee);
  const tpage = await openPage(ctx, '#/inbox');
  await tpage.waitForSelector('.ib-item');
  check('a replied task waits on the team (AIG-472); the other open task keeps its Done button', (await tpage.$$eval('#ibK .ib-item [data-act="taskdone"]', es => es.length)) === 1);
  await tpage.close();

  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-item');
  const chips = await page.$$eval('.q-chip.bump', es => es.map(e => e.textContent.trim()));
  check('the ⏫ reminded chip shows with a time', chips.length >= 2 && chips.every(x => /^⏫ reminded /.test(x)), chips);
  const ids = await page.$$eval('#ibQ .ib-item .ib-id', es => es.map(e => e.textContent.trim()));
  check('the bumped question sits above the other question', ids[0] === q.id, ids);
  noErrors(page);

  // Old copies from before (written straight into the data file, as the old server did): the one-off clean-up keeps the newest.
  const d = await mkCard(s, 'alpha', 'Legacy copies');
  await s.ok('PATCH', `/api/projects/alpha/cards/${d.id}`, { assignee: 'Owner' });
  const file = path.join(s.data, 'alpha.json'), pj = JSON.parse(fs.readFileSync(file, 'utf8')), pc = pj.cards.find(x => x.id === d.id);
  ['Do X now', 'Do Y', 'Do  X\nnow', 'Do X now'].forEach((text, n) => pc.comments.push({ author: 'Lead', text, at: '2026-01-01T00:0' + n + ':00.000Z', mark: 'task' }));
  fs.writeFileSync(file, JSON.stringify(pj, null, 2));
  const marked = async () => (await getCard(s, 'alpha', d.id)).comments.filter(m => m.mark === 'task');
  const dry = await s.ok('POST', '/api/projects/alpha/dedupe', { dry: true });
  check('dedupe: a dry run only reports', dry.dry && dry.changes.length === 1 && dry.changes[0].removed === 2 && (await marked()).length === 4, dry);
  const run = await s.ok('POST', '/api/projects/alpha/dedupe', {});
  const left = await marked();
  check('dedupe: exact copies collapse into the newest, different text stays', run.changes[0].removed === 2 && left.length === 2 && left[0].text === 'Do Y' && left[1].at === '2026-01-01T00:03:00.000Z', left);
  check('dedupe: other cards untouched', (await getCard(s, 'alpha', a.id)).comments.filter(m => m.mark === 'task').length === 2);
}, true);

def('taskreply', 'a task the owner replied to waits on the team; the lead\'s answer comes back on top with the steps folded; Done finishes it (AIG-472)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('tr') });
  const a = await mkCard(s, 'alpha', 'Write the file');
  const post = (author, text) => s.ok('POST', `/api/projects/alpha/cards/${a.id}/comments`, { author, text });
  const inbox = async () => (await s.ok('GET', '/api/inbox')).filter(c => c.id === a.id).length;
  s.cli(['task', 'alpha', a.id, '1. Open the file\n2. Write the line', '--as', 'Lead']);
  check('an open task is in the inbox once', (await inbox()) === 1);
  await post('Owner', 'there is no line Write');
  check('after the owner replies it is waiting on the team', (await inbox()) === 0 && (await getCard(s, 'alpha', a.id)).assignee === 'Owner');
  await sleep(20);
  await post('Lead', 'Sorry, use the Add button instead');
  check('the lead answering brings it back, once', (await inbox()) === 1);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${a.id}"] .ib-question`);
  const q = await page.textContent(`.ib-item[data-id="${a.id}"] .ib-question`);
  check('the lead\'s newest message is on top', q.includes('use the Add button'), q);
  const fold = await page.textContent(`.ib-item[data-id="${a.id}"] details.ib-steps`);
  check('the first steps are folded under Earlier steps', fold.includes('Earlier steps') && fold.includes('Write the line'), fold);
  await s.ok('POST', `/api/projects/alpha/cards/${a.id}/taskdone`, { text: 'done' });
  check('Done finishes it', (await inbox()) === 0);
  noErrors(page);
}, true);
