// QA area: saver (AIG-548..550): usage saver %, ⭐ crucial cards, teams/tester down tools past the saver unless crucial.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('saver', '💾 usage saver: setting clamped below the cap, crucial cards, wakes and tester held back unless crucial, told once per window, banner (AIG-548..550)', async (s, ctx) => {
  const wkResets = Math.floor(Date.now() / 1000) + 86400, h5Resets = Math.floor(Date.now() / 1000) + 3600;
  const reading = (h5, wk) => s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: h5, resets_at: h5Resets }, seven_day: { used_percentage: wk, resets_at: wkResets } } });
  const told = () => { try { return fs.readFileSync(path.join(s.data, 'saver.told'), 'utf8'); } catch { return ''; } };
  await mkProject(s, 'Save', 'SAV', { path: tmp('save') });
  const doing = await mkCard(s, 'save', 'in progress', { status: 'doing' });
  const plain = await mkCard(s, 'save', 'plain card');

  // 1. The setting: off by default, saved, clamped below the cap.
  let pr = (await s.ok('GET', '/api/setup')).prefs;
  check('the saver is off by default', pr.saveH5 === '' && pr.saveWk === '', JSON.stringify(pr));
  await s.ok('POST', '/api/setup', { prefs: { plan: 'normal', saveH5: 80, saveWk: 85 } });
  pr = (await s.ok('GET', '/api/setup')).prefs;
  check('both savers are saved', pr.saveH5 === 80 && pr.saveWk === 85, JSON.stringify(pr));
  check('a saver of 100 is refused', (await s.api('POST', '/api/setup', { prefs: { saveH5: 100 } })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { saveH5: 99 } });
  check('a saver at or over the cap is held one below it', (await s.ok('GET', '/api/setup')).prefs.saveH5 === 89);
  await s.ok('POST', '/api/setup', { prefs: { saveH5: 80 } });

  // 2. Crucial: API, CLI.
  check('a card is not crucial at first', !(await getCard(s, 'save', plain.id)).crucial);
  const r1 = s.cli(['crucial', 'save', plain.id]);
  check('the CLI marks a card crucial', r1.code === 0 && (await getCard(s, 'save', plain.id)).crucial === true, r1);
  await s.ok('PATCH', `/api/projects/save/cards/${plain.id}`, { crucial: false });
  check('the route turns it off again', (await getCard(s, 'save', plain.id)).crucial !== true);
  s.cli(['crucial', 'save', plain.id]);
  check('crucial off by the CLI', s.cli(['crucial', 'save', plain.id, 'off']).code === 0 && !(await getCard(s, 'save', plain.id)).crucial);
  check('a bad third word is refused', s.cli(['crucial', 'save', plain.id, 'maybe']).code !== 0);

  // 3. Below the saver nothing is held; past it the wake is refused unless a card is crucial.
  await reading(50, 50);
  check('under the saver: no saving', (await s.ok('GET', '/api/limits/latest')).saving === null);
  await reading(82, 10);
  const lat = await s.ok('GET', '/api/limits/latest');
  check('5-hour at 82% with a saver of 80%: saving is reported', lat.saving && lat.saving.pct === 82 && lat.saving.save === 80 && lat.saving.cap === 90 && /5-hour/.test(lat.saving.name), JSON.stringify(lat));
  check('and the hard cap is not yet reached', lat.over === false);
  let w = await s.api('POST', '/api/projects/save/wake');
  check('the wake is refused with a saver reason', w.status === 400 && /usage saver.*5-hour.*82%.*80%/.test(JSON.stringify(w.body)), JSON.stringify(w.body));
  check('the tester is held back (nothing crucial to test)', (await s.api('POST', '/api/tester', {})).status === 400);

  // Told once for this window.
  check('the owner is told once for this window', told() === '5-hour@' + h5Resets, told());
  const m1 = fs.statSync(path.join(s.data, 'saver.told')).mtimeMs; await sleep(20); await reading(83, 10);
  check('and not again in the same window', fs.statSync(path.join(s.data, 'saver.told')).mtimeMs === m1);
  const dc = await getCard(s, 'save', doing.id);
  check('one line landed on the newest doing card', dc.comments.filter(m => /Usage saver/.test(m.text)).length === 1 && /Scrum Master/.test(dc.comments.at(-1).author), JSON.stringify(dc.comments));
  const chat = await s.ok('GET', '/api/chats/_watchman');
  check('the Lead Scrum Master said it in the chat', JSON.stringify(chat).includes('Usage saver'), JSON.stringify(chat).slice(0, 300));

  // Crucial work goes ahead.
  await s.ok('PATCH', `/api/projects/save/cards/${plain.id}`, { crucial: true });
  w = await s.api('POST', '/api/projects/save/wake');
  check('with a crucial card the wake goes', w.status === 200, JSON.stringify(w.body));
  for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/save')).presence.running; i++) await sleep(250);
  // A finished crucial card no longer counts.
  await s.ok('PATCH', `/api/projects/save/cards/${plain.id}`, { status: 'done' });
  check('a done crucial card does not keep the team running', (await s.api('POST', '/api/projects/save/wake')).status === 400);
  await s.ok('PATCH', `/api/projects/save/cards/${plain.id}`, { status: 'backlog' });

  // The banner.
  const page = await openPage(ctx, '#/');
  await page.waitForFunction(() => { const b = document.getElementById('saverBar'); return b && !b.hidden && /Usage saver/.test(b.textContent); }, null, { timeout: 8000 }).catch(() => {});
  const bt = await page.textContent('#saverBar');
  check('the banner shows the reading and the saver', /Usage saver: 8\d% of 5-hour \(saver 80%\)\. Only ⭐ crucial cards run\./.test(bt), bt);
  noErrors(page);

  // Setup shows the inputs.
  const sp = await openPage(ctx, '#/setup');
  await sp.waitForSelector('#pf-more summary', { timeout: 8000 });
  if (!(await sp.$eval('#pf-more', d => d.open))) await sp.click('#pf-more summary');
  check('Setup has the two saver inputs', (await sp.$$('#pf-saveH5, #pf-saveWk')).length === 2);
  noErrors(sp);

  // The card panel toggle and the board chip.
  await s.ok('PATCH', `/api/projects/save/cards/${plain.id}`, { crucial: false });
  const cp = await openPage(ctx, `#/p/save/${plain.id}`);
  await cp.waitForSelector('.crucial-btn', { timeout: 8000 });
  await cp.click('.crucial-btn');
  await sleep(600);
  check('the card panel toggle marks the card crucial', (await getCard(s, 'save', plain.id)).crucial === true);
  await cp.goto(cp.url().split('#')[0] + '#/p/save');
  await cp.waitForSelector('.pill.crucial', { timeout: 8000 }).catch(() => {});
  check('a ⭐ chip shows on the board card', (await cp.$$('.pill.crucial')).length >= 1);
  noErrors(cp);

  // Back under the saver: work restarts by itself, nothing to clear.
  await s.ok('PATCH', `/api/projects/save/cards/${plain.id}`, { crucial: false });
  await reading(40, 10);
  check('usage drops: no saving', (await s.ok('GET', '/api/limits/latest')).saving === null);
  check('and the wake goes without any crucial card', (await s.api('POST', '/api/projects/save/wake')).status === 200);
}, true, (() => { const f = path.join(tmp('saver'), 'aigile.local.json'); fs.writeFileSync(f, '{ "owner": "Owner", "agent": { "command": "x", "notesFile": "CLAUDE.local.md", "settingsFile": ".claude/settings.local.json" } }'); return { AIGILE_LOCAL: f }; })());
