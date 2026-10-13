// QA area: gate (AIG-613): the merge gate on a card: QA areas and the full suite, green or red; a red card is not handed over.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('gate', '🟢/🔴 merge gate: aigile qa stores the result, the card shows it, aigile test refuses a red card (AIG-613)', async (s, ctx) => {
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
}, true);
