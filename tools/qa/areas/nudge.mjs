// QA area: nudge (AIG-593): the 👉 by the typing line in a card chat lights up when your last message is still unseen after
// 3 min, a click is the normal poke, and it goes quiet again once poked or answered.
import { check, sleep, mkProject, mkCard, getCard, say, def, BASE } from '../lib.mjs';

const open = async (ctx, hash, aheadMs) => {
  const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  if (aheadMs) await page.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, aheadMs);
  await page.goto(BASE + '/' + hash);
  return page;
};

def('nudge', '👉 nudge in the card chat: lit after 3 min unseen, click pokes, quiet once poked or answered (AIG-593)', async (s, ctx) => {
  await mkProject(s, 'Nudge', 'NDG');
  const owner = (await s.ok('GET', '/api/meta')).owner;
  const c = await mkCard(s, 'nudge', 'Stuck job', { status: 'doing' });
  await say(s, 'nudge', c.id, owner, 'how is it going?');
  let page = await open(ctx, `#/pop/nudge/${c.id}`, 0);
  await page.waitForSelector('#modal .chat', { timeout: 8000 });
  await sleep(1200);
  check('fresh message: no nudge yet', !(await page.$('#nudgeBtn.lit')));
  await page.close();
  page = await open(ctx, `#/pop/nudge/${c.id}`, 4 * 60e3);
  await page.waitForSelector('#modal .chat', { timeout: 8000 });
  const lit = await page.waitForSelector('#nudgeBtn.lit', { timeout: 6000 }).catch(() => null);
  check('after 3 min unseen the 👉 lights up', !!lit);
  const before = (await getCard(s, 'nudge', c.id)).status;
  if (lit) await lit.click();
  await sleep(1500);
  const after = await getCard(s, 'nudge', c.id);
  check('a click pokes the card (one 👉 comment), card stays put', after.comments.filter(m => m.poke).length === 1 && after.status === before, [before, after.status]);
  check('once poked it goes quiet', !(await page.$('#nudgeBtn.lit')));
  check('no page errors', page.errors.length === 0, page.errors);
  await page.close();
  await say(s, 'nudge', c.id, owner, 'still there?');
  await say(s, 'nudge', c.id, 'Lead', 'yes, nearly done');
  page = await open(ctx, `#/pop/nudge/${c.id}`, 4 * 60e3);
  await page.waitForSelector('#modal .chat', { timeout: 8000 }); await sleep(1200);
  check('answered by the team: not lit', !(await page.$('#nudgeBtn.lit')));
  await page.close();
}, true);
