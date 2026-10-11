// QA area: wizard (AIG-354), the setup wizard, quick mode.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, openPage, noErrors, def } from '../lib.mjs';

def('wizard', '🧙 setup wizard: first run offers it, I\'ll wing it leaves defaults, the wizard saves style and spend plan, running it again keeps values, Back works, a guessed agent is not saved (AIG-354)', async (s, ctx) => {
  const setup = async () => (await s.ok('GET', '/api/setup'));
  const strip = p => { const { wizardSeen, ...r } = p; return JSON.stringify(r); };
  const before = strip((await setup()).prefs);
  check('fresh data: setup needed, wizard not seen', (await setup()).needed === true && (await setup()).prefs.wizardSeen === false);

  // I'll wing it: the choice, then defaults untouched.
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#wzYes');
  check('first run shows both choices', (await page.textContent('#wzYes')).includes('wizard') && (await page.textContent('#wzNo')).includes('wing it'));
  await page.click('#wzNo');
  await page.waitForSelector('#wzYes', { state: 'detached' });
  await sleep(200);
  const after = await setup();
  check('wing it leaves every default and marks the wizard answered', strip(after.prefs) === before && after.prefs.wizardSeen === true && !after.fields.find(f => f.key === 'owner').value, JSON.stringify(after.prefs));
  await page.reload(); await page.waitForSelector('#setupForm'); await sleep(500);
  check('it does not come back by itself', !(await page.isVisible('#wzYes')));

  // The wizard from Setup.
  await page.click('#wzRun');
  await page.waitForSelector('.wz-dots');
  check('five step dots, first one on', (await page.locator('.wz-dot').count()) === 5 && (await page.locator('.wz-dot.on').count()) === 1);
  check('screen 1 has a language picker', await page.isVisible('.wizard .lang-pick'));
  check('no Back on the first screen', !(await page.isVisible('#wzBack')));
  await page.click('#wzNext');
  await page.waitForSelector('#wz-name');
  check('without a name there is no Skip', !(await page.isVisible('#wzSkip')));
  await page.click('#wzNext'); await sleep(200);
  check('Next without a name stays and says so', await page.isVisible('#wz-name') && (await page.textContent('#wz-err')).length > 0);
  const guess = await page.getAttribute('#wz-agent', 'placeholder');
  check('the agent guess is only a placeholder, not typed in', (await page.inputValue('#wz-agent')) === '');
  await page.fill('#wz-name', 'Wiz');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-style]');
  await page.click('#wzBack'); await page.waitForSelector('#wz-name');
  check('Back keeps the name', (await page.inputValue('#wz-name')) === 'Wiz');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-style]');
  check('Balanced is the recommended one', (await page.locator('.wz-opt', { hasText: 'recommended' }).count()) === 1);
  await page.check('[name=wz-style][value=careful]');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-plan]');
  check('the five spend steps', (await page.locator('[name=wz-plan]').count()) === 5 && (await page.locator('.wz-opt').first().textContent()).includes('🪰'));
  await page.check('[name=wz-plan][value=fly]');
  await page.click('#wzNext'); await page.waitForSelector('#wzDone');
  check('last screen points to Setup', (await page.textContent('.wizard')).includes('Setup'));
  let st = await setup();
  check('the careful style is saved', st.prefs.go === 'ask' && st.prefs.chatty === false && st.prefs.tidyCards === true && st.prefs.watchAll === false, JSON.stringify(st.prefs));
  check('the spend plan is saved', st.prefs.plan === 'fly' && st.prefs.budgetH5 === st.plans.fly.budgetH5 && st.prefs.maxRuns === 1);
  check('the name is saved, the guessed agent is not', st.fields.find(f => f.key === 'owner').value === 'Wiz' && st.fields.find(f => f.key === 'agent.command').value === '');
  await page.click('#wzDone');
  await page.waitForSelector('.wizard', { state: 'detached' });
  const saved = JSON.parse(fs.readFileSync(process.env.QA_WIZARD_FILE, 'utf8'));
  check('it lands in the local settings file', saved.owner === 'Wiz' && saved.wizard.seen === true && saved.lead.go === 'ask' && !(saved.agent || {}).command, JSON.stringify(saved));

  // Use this takes the guess, but only on a click.
  if (guess) {
    await page.click('#wzRun'); await page.waitForSelector('.wz-dots'); await page.click('#wzNext'); await page.waitForSelector('#wz-name');
    await page.click('#wzUse');
    check('Use this fills the box', (await page.inputValue('#wz-agent')) === guess);
    await page.evaluate(() => closeDialog());
    check('closing without finishing saves nothing', (await setup()).fields.find(f => f.key === 'agent.command').value === '');
  }

  // Again: it shows what is set, and clicking through keeps it.
  const kept = strip((await setup()).prefs);
  await page.click('#wzRun'); await page.waitForSelector('.wz-dots'); await page.click('#wzNext'); await page.waitForSelector('#wz-name');
  check('the name is filled in', (await page.inputValue('#wz-name')) === 'Wiz');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-style]');
  check('the saved style is ticked', await page.isChecked('[name=wz-style][value=careful]'));
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-plan]');
  check('the saved spend step is ticked', await page.isChecked('[name=wz-plan][value=fly]'));
  await page.click('#wzSkip'); await page.waitForSelector('#wzDone'); await page.click('#wzDone');
  await sleep(200);
  check('running it again and skipping changes nothing', strip((await setup()).prefs) === kept);

  // Then a different pick sticks.
  await page.click('#wzRun'); await page.waitForSelector('.wz-dots'); await page.click('#wzNext'); await page.waitForSelector('#wz-name');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-style]');
  await page.check('[name=wz-style][value=fast]'); await page.click('#wzNext'); await page.waitForSelector('[name=wz-plan]');
  await page.check('[name=wz-plan][value=nospare]'); await page.click('#wzNext'); await page.waitForSelector('#wzDone');
  st = await setup();
  check('Get on with it and No expense spared are saved', st.prefs.go === 'small' && st.prefs.watchAll === true && st.prefs.tidyCards === false && st.prefs.plan === 'nospare', JSON.stringify(st.prefs));
  noErrors(page);
}, true, (() => { const f = process.env.QA_WIZARD_FILE = path.join(tmp('wizard'), 'aigile.local.json'); return { AIGILE_LOCAL: f }; })());
