// QA area: gate (AIG-613): the merge gate on a card: QA areas and the full suite, green or red; a red card is not handed over.
// And the change calendar (AIG-615): the owner's quiet times, when nothing goes live.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('gate', '🟢/🔴 merge gate: aigile qa stores the result, the card shows it, aigile test refuses a red card (AIG-613); quiet times: golive-ok, brief line, top bar chip, Setup list (AIG-615)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Gated change', { status: 'doing' });
  const old = await mkCard(s, 'alpha', 'Old card, no QA', { status: 'doing' });

  // No qa record (old data): not blocked
  check('a card starts with no qa record', !a.qa);
  const t0 = s.cli(['test', 'alpha', old.id, 'Open it and look', '--as', 'Backend']);
  check('a card with no QA can still be handed over', t0.code === 0 && (await getCard(s, 'alpha', old.id)).status === 'verify', t0);

  // Red
  const bad = s.cli(['qa', 'alpha', a.id, '--areas', 'card,cli', '--result', 'fail', '--full', 'fail', '--note', 'card check broke', '--as', 'Backend']);
  let c = await getCard(s, 'alpha', a.id);
  check('qa --result fail is stored', bad.code === 0 && c.qa && c.qa.result === 'fail' && c.qa.full === 'fail' && c.qa.areas.join() === 'card,cli' && c.qa.by === 'Backend' && c.qa.note === 'card check broke' && !!c.qa.at, bad);
  check('the CLI says red', /QA red/.test(bad.out), bad.out);
  check('a bad result is refused', s.cli(['qa', 'alpha', a.id, '--result', 'maybe', '--as', 'Backend']).code !== 0);
  check('the API refuses a bad result', (await s.api('PATCH', `/api/projects/alpha/cards/${a.id}`, { qa: { result: 'meh' } })).status === 400);

  const no = s.cli(['test', 'alpha', a.id, 'Open it and look', '--as', 'Backend']);
  check('test refuses while QA is red', no.code !== 0 && /QA is red: fix it or record a pass with aigile qa/.test(no.out + (no.err || '')), no);
  check('and the card stayed in doing', (await getCard(s, 'alpha', a.id)).status === 'doing');

  let page = await openPage(ctx, `#/p/alpha/${a.id}`);
  await page.waitForSelector('[data-ctab="details"]');
  await page.click('[data-ctab="details"]');
  await page.waitForSelector('.qa-gate');
  let txt = await page.locator('.qa-gate').innerText();
  check('the card shows 🔴 QA red', (await page.locator('.qa-gate.red').count()) === 1 && txt.includes('🔴'), txt);
  check('with the areas and the full suite', /card, cli/.test(txt) && /full suite red/.test(txt), txt);

  // Areas green but the full suite red is still red
  s.cli(['qa', 'alpha', a.id, '--areas', 'card', '--result', 'pass', '--full', 'fail', '--as', 'Backend']);
  check('areas green, full suite red: test still refuses', s.cli(['test', 'alpha', a.id, 'Open it and look', '--as', 'Backend']).code !== 0);

  // Green
  const good = s.cli(['qa', 'alpha', a.id, '--areas', 'card,cli', '--result', 'pass', '--full', 'pass', '--as', 'Backend']);
  check('qa --result pass is stored, the CLI says green', good.code === 0 && /QA green/.test(good.out) && (await getCard(s, 'alpha', a.id)).qa.result === 'pass', good);
  const yes = s.cli(['test', 'alpha', a.id, 'Open it and look', '--as', 'Backend']);
  check('test is allowed after a pass', yes.code === 0 && (await getCard(s, 'alpha', a.id)).status === 'verify', yes);

  page = await openPage(ctx, `#/p/alpha/${a.id}`);
  await page.waitForSelector('[data-ctab="details"]');
  await page.click('[data-ctab="details"]');
  await page.waitForSelector('.qa-gate.green');
  txt = await page.locator('.qa-gate').innerText();
  check('the card shows 🟢 QA green (areas, full suite)', txt.includes('🟢') && /card, cli/.test(txt) && /full suite green/.test(txt), txt);
  const p2 = await openPage(ctx, `#/p/alpha/${old.id}`);
  await p2.waitForSelector('[data-ctab="details"]');
  await p2.click('[data-ctab="details"]');
  await sleep(300);
  check('a card with no QA shows ⚪ no QA yet', (await p2.locator('.qa-gate.none').innerText()).includes('⚪'));
  await noErrors(page);
  await noErrors(p2);

  // Change calendar (AIG-615): quiet times from Setup; nothing goes live in them.
  const hm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const d = new Date(), n = d.getHours() * 60 + d.getMinutes();
  check('no quiet times: golive-ok says ok', (r => r.code === 0 && r.out.trim() === 'ok')(s.cli(['golive-ok', 'alpha'])));
  check('a bad quiet time is refused', (await s.api('POST', '/api/setup', { prefs: { quiet: [{ day: 'all', from: '25:00', to: '10:00' }] } })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { quiet: [{ day: 'all', from: hm(n - 60), to: hm(n + 60), label: 'Stream' }] } });
  const q = s.cli(['golive-ok', 'alpha']);
  check('inside a quiet time: golive-ok exits 1 with quiet until HH:MM (label)', q.code === 1 && q.out.trim() === `quiet until ${hm(n + 60)} (Stream)`, q);
  const br = s.cli(['brief', 'alpha']).out;
  check('the brief says quiet time: nothing goes live', br.includes(`Quiet time (Stream) until ${hm(n + 60)}: nothing goes live; merge and test on branches only.`), br.slice(0, 600));
  const top = await openPage(ctx, '#/p/alpha');
  await top.waitForSelector('#quietTimeTop:not([hidden])', { timeout: 8000 }).catch(() => {});
  const chip = await top.locator('#quietTimeTop').innerText().catch(() => '');
  check('the top bar shows a quiet chip', await top.locator('#quietTimeTop').isVisible() && chip.includes('Stream') && chip.includes(hm(n + 60)), chip);

  // Today only, by weekday name; and past midnight
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  await s.ok('POST', '/api/setup', { prefs: { quiet: [{ day: days[(d.getDay() + 1) % 7], from: hm(n - 60), to: hm(n + 60), label: 'Tomorrow' }] } });
  check('a quiet time on another day does not count', s.cli(['golive-ok', 'alpha']).code === 0);

  // Outside: ok, no brief line, the chip goes
  await s.ok('POST', '/api/setup', { prefs: { quiet: [{ day: 'all', from: hm(n + 120), to: hm(n + 180), label: 'Demo' }] } });
  const ok = s.cli(['golive-ok', 'alpha']);
  check('outside the quiet time: golive-ok says ok', ok.code === 0 && ok.out.trim() === 'ok', ok);
  check('and the brief has no quiet line', !/Quiet time/.test(s.cli(['brief', 'alpha']).out));
  await top.waitForSelector('#quietTimeTop[hidden]', { state: 'attached', timeout: 8000 }).catch(() => {});
  check('the chip is gone', !(await top.locator('#quietTimeTop').isVisible()));
  await noErrors(top);

  // Setup: the list shows, add and remove save
  const set = await openPage(ctx, '#/setup');
  await set.waitForSelector('#qtAdd', { state: 'attached' });
  check('Setup lists the quiet time', (await set.locator('#quietTimes .qt-row').count()) === 1 && (await set.inputValue('#qt-label-0')) === 'Demo');
  await set.evaluate(() => quietTimeSave(-1)); await sleep(600);
  check('+ Add saves a second quiet time', ((await s.ok('GET', '/api/setup')).prefs.quiet || []).length === 2);
  await set.evaluate(() => quietTimeSave(0)); await sleep(600);
  const left = (await s.ok('GET', '/api/setup')).prefs.quiet || [];
  check('✕ removes one', left.length === 1 && left[0].label === '', JSON.stringify(left));
  await s.ok('POST', '/api/setup', { prefs: { quiet: [] } });
  check('an empty list clears them', ((await s.ok('GET', '/api/setup')).prefs.quiet || []).length === 0);
  await noErrors(set);
}, true);
