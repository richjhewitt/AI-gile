// QA area: opencard (AIG-758, AIG-759): `aigile open <proj> <id> --as NAME` pops a card open in the app while it is in front,
// else it waits as a chip; the brief and AGENTS.md carry the DM-about-one-card rule.
import fs from 'node:fs';
import { check, mkProject, mkCard, openPage, def } from '../lib.mjs';

def('opencard', 'aigile open: the app pops the card out when in front, else a chip; DM-to-card rule in brief and AGENTS.md (AIG-758/759)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c1 = await mkCard(s, 'alpha', 'Open me first', { status: 'todo' });
  const c2 = await mkCard(s, 'alpha', 'Open me later', { status: 'todo' });
  const cli = (...a) => s.cli(a);

  // API and CLI
  const r = cli('open', 'alpha', c1.id, '--as', 'Forge');
  check('open prints that the app was asked', r.code === 0 && new RegExp(c1.id).test(r.out), r);
  check('a missing card is refused', cli('open', 'alpha', 'ALP-999', '--as', 'Forge').code !== 0);
  check('no card id is refused', cli('open', 'alpha', '--as', 'Forge').code !== 0);
  let q = await s.ok('GET', '/api/opencard?front=0');
  check('not in front: kept as a chip, nothing auto', q.auto.length === 0 && q.chips.length === 1 && q.chips[0].id === c1.id && q.chips[0].by === 'Forge', q);
  q = await s.ok('GET', '/api/opencard?front=1');
  check('a request already shown as a chip is not auto-opened later', q.auto.length === 0 && q.chips.length === 1, q);
  await s.ok('DELETE', `/api/opencard/${q.chips[0].n}`);
  check('dismissing clears it', (await s.ok('GET', '/api/opencard?front=0')).chips.length === 0);
  cli('open', 'alpha', c2.id, '--as', 'Forge'); cli('open', 'alpha', c2.id, '--as', 'Pixel');
  q = await s.ok('GET', '/api/opencard?front=1');
  check('in front: handed over once, one entry per card', q.auto.length === 1 && q.auto[0].by === 'Pixel' && q.chips.length === 0, q);
  check('and gone after', (await s.ok('GET', '/api/opencard?front=1')).auto.length === 0);

  // Page: not in front -> chip; click opens the pop-out; in front -> pop-out straight away.
  const page = await openPage(ctx, '#/p/alpha');
  await page.evaluate(() => { document.hasFocus = () => false; });
  cli('open', 'alpha', c1.id, '--as', 'Forge');
  await page.waitForSelector('#ocChips .oc-chip', { timeout: 6000 });
  check('the chip names the card', new RegExp(c1.id).test(await page.textContent('#ocChips')));
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#ocChips .oc-go')]);
  check('clicking the chip opens the card pop-out', new RegExp(`#/pop/alpha/${c1.id}$`).test(pop.url()), pop.url());
  await pop.close();
  await page.waitForFunction(() => !document.querySelector('#ocChips'), null, { timeout: 6000 });
  check('the chip is gone after the click', true);
  await page.evaluate(() => { document.hasFocus = () => true; });
  const [auto] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), Promise.resolve(cli('open', 'alpha', c2.id, '--as', 'Forge'))]);
  check('in front: the card pops out by itself', new RegExp(`#/pop/alpha/${c2.id}$`).test(auto.url()), auto.url());
  await auto.close();

  // AIG-759: the rule
  const brief = cli('brief', 'alpha');
  check('brief carries the DM-about-one-card line', /aigile open alpha <id>/.test(brief.out) && /carried on in/.test(brief.out), brief.out.slice(-400));
  const agents = fs.readFileSync(new URL('../../../AGENTS.md', import.meta.url), 'utf8');
  check('AGENTS.md lists open and has the 7b rule', /aigile open <proj> <id> --as NAME/.test(agents) && /carried on in AIG-x/.test(agents));
  check('help lists open', /\n\s+open <proj> <id> --as NAME/.test(cli('help').out));
}, true);
