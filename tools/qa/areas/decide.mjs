// QA areas: decide (AIG-361): the inbox's ⚡ Decide pile and 🗂️ Topics (aigile quiz).
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('decide', '⚡ Decide pile: keys answer / skip / open; a 3-question Topic posts one comment and wakes once; CLI quiz (AIG-361)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('dc') });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const a = await mkCard(s, 'alpha', 'Big plan'), b = await mkCard(s, 'alpha', 'Format'), q = await mkCard(s, 'alpha', 'Sharing rules'), plain = await mkCard(s, 'alpha', 'Chatty');
  // Seeded through the API: CLI calls count as the team being at work and a wake would be skipped.
  const askAs = (card, text, extra = {}) => s.ok('POST', `/api/projects/alpha/cards/${card.id}/comments`, { author: 'Lead', text, needsYou: true, ...extra });
  await askAs(a, 'Plan:\n- build it\n- ship it\n\n**Ready to build? GO?**');
  await askAs(b, 'Which format?', { options: 'M3U,JSON' });
  await askAs(plain, 'Tell me how your week went');
  await s.ok('POST', `/api/projects/alpha/cards/${q.id}/quiz`, { author: 'Lead', topic: 'Sharing', items: [{ q: 'Who can see it?', options: 'Everyone,Friends,Nobody' }, { q: 'Allow comments?', options: 'Yes,No' }, { q: 'Send alerts?' }] });
  const qc = await getCard(s, 'alpha', q.id);
  check('a quiz stores a topic with 3 questions, flags the card needs-owner, default options Yes / No', qc.quiz && qc.quiz.topic === 'Sharing' && qc.quiz.items.length === 3 && qc.needsYou && qc.quiz.items[2].options.join() === 'Yes,No' && qc.quiz.items[0].options.length === 3, qc.quiz);
  const bad = await fetch(BASE + `/api/projects/alpha/cards/${q.id}/quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ q: 'x?' }] }) });
  check('a quiz without a topic is refused', bad.status === 400);

  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-decide');
  check('the kind chips show ⚡ Decide with the count (GO, options, topic = 3)', (await page.textContent('.ib-decide')).replace(/\s+/g, ' ').trim() === '⚡ Decide 3', await page.textContent('.ib-decide'));
  await page.click('.ib-decide');
  await page.waitForSelector('#ibDc:not([hidden]) .dc-btns');
  const first = await page.textContent('#ibDc');
  check('the pile shows project, card id, title and a summary of the question', /Alpha/.test(first) && first.includes(a.id) && /Big plan/.test(first) && /GO\?/.test(first), first.slice(0, 200));
  check('Go / Not yet buttons with numbers', (await page.$$eval('#ibDc .dc-btns button', bs => bs.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join('|') === '1 ✅ Go|2 ✋ Not yet');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /Format|Sharing/.test(document.getElementById('ibDc').textContent));
  const second = await page.textContent('#ibDc');
  check('→ skips to the next without answering', !second.includes('Big plan') && (await getCard(s, 'alpha', a.id)).needsYou);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => /Big plan/.test(document.getElementById('ibDc').textContent));
  await page.keyboard.press('1');
  await page.waitForFunction(() => !/Big plan/.test(document.getElementById('ibDc').textContent));
  const ga = await getCard(s, 'alpha', a.id);
  check('key 1 answers Go through the normal comment route', ga.comments.at(-1).text === 'GO' && !ga.needsYou, ga.comments.at(-1));

  // The topic: answer by keys, question by question.
  const log = path.join(s.data, 'logs', 'alpha.log');
  const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  const idle = async () => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/alpha')).presence.running; i++) await sleep(250); };
  await idle();
  const before = starts();
  // find the topic: skip until the Topic header shows
  for (let i = 0; i < 4 && !/Topic: Sharing/.test(await page.textContent('#ibDc')); i++) { await page.keyboard.press('ArrowRight'); await sleep(200); }
  check('the topic shows as one item with its title and Question 1 of 3', /Topic: Sharing/.test(await page.textContent('#ibDc')) && /Question 1 of 3/.test(await page.textContent('#ibDc')));
  await page.keyboard.press('2');
  await page.waitForFunction(() => /Question 2 of 3/.test(document.getElementById('ibDc').textContent));
  let tc = await getCard(s, 'alpha', q.id);
  check('answering one question keeps the rest open, nothing posted yet', tc.quiz.items[0].answer === 'Friends' && tc.needsYou && !tc.comments.some(m => /^Topic:/.test(m.text)), tc.quiz.items);
  // ✏️ Other… in the pile (AIG-445): type, Enter saves it and moves on.
  await page.click('#ibDc [data-dc="other"]');
  await page.fill('#dcText', 'Only weekends');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Question 3 of 3/.test(document.getElementById('ibDc').textContent));
  await page.keyboard.press('1');
  await sleep(1000);
  tc = await getCard(s, 'alpha', q.id);
  const posted = tc.comments.filter(m => /^Topic:/.test(m.text));
  check('all answered: ONE comment "Topic: Sharing — Q1: Friends, Q2: Only weekends, Q3: Yes"', posted.length === 1 && posted[0].text === 'Topic: Sharing — Q1: Friends, Q2: Only weekends, Q3: Yes' && !tc.needsYou, posted);
  await idle();
  check('the team was woken once', starts() === before + 1, [before, starts()]);

  // Enter opens the card; Esc leaves.
  await page.waitForSelector('#ibDc .dc-btns');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^#\/p\/alpha\/[A-Z]+-\d+$/.test(location.hash));
  check('Enter opens the card', true);

  // On the card itself.
  const q2 = await mkCard(s, 'alpha', 'Second topic');
  const cl = s.cli(['quiz', 'alpha', q2.id, '--topic', 'Look', 'Dark mode?|Yes,No', 'Round corners?|Yes,No', '--as', 'Lead']);
  const c1 = await getCard(s, 'alpha', q2.id);
  check('CLI quiz sends the topic: needs-owner, 2 questions, says so', cl.code === 0 && /sent topic "Look"/.test(cl.out) && c1.needsYou && c1.quiz.items.length === 2, cl);
  await page.goto(BASE + `/#/p/alpha/${q2.id}`);
  await page.waitForSelector('.qz .qz-opt');
  await page.locator('.qz .qz-item').nth(0).locator('.qz-opt', { hasText: 'Yes' }).click();
  await page.waitForFunction(() => document.querySelector('.qz .qz-opt.good'));
  await page.locator('.qz .qz-item').nth(1).locator('.qz-opt', { hasText: 'No' }).click();
  await sleep(800);
  const c2 = await getCard(s, 'alpha', q2.id);
  check('a topic is answerable on the card too, and posts one comment', c2.comments.filter(m => /^Topic: Look — Q1: Yes, Q2: No$/.test(m.text)).length === 1 && !c2.needsYou, c2.comments.at(-1));

  // ✏️ Other… on the card (AIG-445): a typed answer is that question's answer.
  const q3 = await mkCard(s, 'alpha', 'Third topic');
  await s.ok('POST', `/api/projects/alpha/cards/${q3.id}/quiz`, { author: 'Lead', topic: 'Mix', items: [{ q: 'A?', options: 'Yes,No' }, { q: 'B?', options: 'Yes,No' }] });
  await page.goto(BASE + `/#/p/alpha/${q3.id}`);
  await page.waitForSelector('.qz .qz-other');
  await page.locator('.qz .qz-item').nth(0).locator('.qz-other').click();
  await page.locator('.qz .qz-item').nth(0).locator('.qz-in').fill('Only on Tuesdays');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.qz .qz-other.good'));
  let c3 = await getCard(s, 'alpha', q3.id);
  check('Other box answer is stored as that question\'s answer, marked typed; topic stays open, shown ticked', c3.quiz.items[0].answer === 'Only on Tuesdays' && c3.quiz.items[0].typed && !c3.quiz.done && c3.needsYou, c3.quiz.items);
  await page.locator('.qz .qz-item').nth(1).locator('.qz-opt', { hasText: 'No' }).click();
  await sleep(800);
  c3 = await getCard(s, 'alpha', q3.id);
  check('Other + button closes the topic with one comment', c3.comments.filter(m => m.text === 'Topic: Mix — Q1: Only on Tuesdays, Q2: No').length === 1 && !c3.needsYou, c3.comments.at(-1));

  // Mixed: 2 by button, then a normal reply fills the rest: one combined comment, one wake.
  const q4 = await mkCard(s, 'alpha', 'Fourth topic');
  await s.ok('POST', `/api/projects/alpha/cards/${q4.id}/quiz`, { author: 'Lead', topic: 'Four', items: ['1', '2', '3', '4'].map(n => ({ q: `Q${n}?`, options: 'Yes,No' })) });
  await s.ok('POST', `/api/projects/alpha/cards/${q4.id}/quiz/answer`, { index: 0, answer: 'Yes' });
  await s.ok('POST', `/api/projects/alpha/cards/${q4.id}/quiz/answer`, { index: 1, answer: 'No' });
  await idle();
  await page.goto(BASE + `/#/p/alpha/${q4.id}`);
  await page.waitForSelector('.qz .qz-opt.good');
  check('partial button answers are still ticked after a revisit', await page.locator('.qz .qz-opt.good').count() === 2);
  await s.ok('POST', `/api/projects/alpha/cards/${q4.id}/comments`, { author: 'Owner', text: 'Go with blue, and skip the rest' });
  await sleep(1500);
  const c4 = await getCard(s, 'alpha', q4.id);
  const tp = c4.comments.filter(m => /^Topic:/.test(m.text));
  check('a reply closes the open topic: "Q1: Yes, Q2: No, Q3/Q4: see reply", answers stored typed', c4.quiz.done && !c4.needsYou && tp.length === 1 && tp[0].text === 'Topic: Four — Q1: Yes, Q2: No, Q3/Q4: see reply' && c4.quiz.items[2].answer === 'Go with blue, and skip the rest' && c4.quiz.items[3].typed, [tp, c4.quiz.items]);
  check('the reply itself is kept as a comment, and the team was woken once (one dispatcher entry)', c4.comments.some(m => m.text === 'Go with blue, and skip the rest') && (await s.ok('GET', '/api/projects/alpha')).log.filter(l => l.author === 'Dispatcher' && l.text.startsWith(q4.id + ' ')).length === 1, 'dispatcher log');
  noErrors(page);
}, true);
