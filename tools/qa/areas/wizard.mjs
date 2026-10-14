// QA area: wizard (AIG-354), the setup wizard, quick mode.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, openPage, noErrors, def } from '../lib.mjs';

def('wizard', '🧙 setup wizard: first run offers it, I\'ll wing it leaves defaults, the wizard saves style and spend plan, running it again keeps values, Back works, a guessed agent is not saved (AIG-354)', async (s, ctx) => {
  const setup = async () => (await s.ok('GET', '/api/setup'));
  const strip = p => { const { wizardSeen, lang, ...r } = p; return JSON.stringify(r); };   // lang: the page saves its language on load (AIG-488)
  const before = strip((await setup()).prefs);
  check('fresh data: setup needed, wizard not seen', (await setup()).needed === true && (await setup()).prefs.wizardSeen === false);

  // I'll wing it: the choice, then defaults untouched.
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#wzYes');
  check('first run shows the three choices', (await page.textContent('#wzYes')).includes('Wizard') && (await page.textContent('#wzTour')).includes('Tour') && (await page.textContent('#wzNo')).includes('let me in'));
  await page.click('#wzNo');   // AIG-940: no second popup after
  await page.waitForSelector('#wzYes', { state: 'detached' });
  await sleep(200);
  const after = await setup();
  check('wing it leaves every default and marks the wizard answered', strip(after.prefs) === before && after.prefs.wizardSeen === true && !after.fields.find(f => f.key === 'owner').value, JSON.stringify(after.prefs));
  await page.reload(); await page.waitForSelector('#setupForm'); await sleep(500);
  check('it does not come back by itself', !(await page.isVisible('#wzYes')));

  // AIG-1068: only the first load of the home page goes to Setup; then Home shows a Finish setup line and deep links stay put.
  await page.goto(s.base + '/'); await sleep(800);
  check('the first home load goes to Setup once', /#\/setup/.test(page.url()), page.url());
  await page.goto(s.base + '/#/'); await page.reload(); await page.waitForSelector('#finishSetup'); await sleep(300);
  check('after that Home stays and shows Finish setup', !/#\/setup/.test(page.url()) && (await page.textContent('#finishSetup')).includes('Finish setup'), page.url());
  await page.goto(s.base + '/#/standups'); await page.reload(); await sleep(800);
  check('a deep link opens where it points', /#\/standups/.test(page.url()), page.url());
  await page.goto(s.base + '/#/'); await page.waitForSelector('#finishSetup'); await page.click('#finishSetup a'); await page.waitForSelector('#setupForm');
  check('Finish setup goes to the boxes', /#\/setup\/you/.test(page.url()));
  await page.goto(s.base + '/#/setup'); await page.waitForSelector('#setupForm');

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
  const guess = (await page.isVisible('#wzUse')) ? await page.textContent('.suggest code') : '';   // AIG-940: the found one is a button, the placeholder only a hint
  check('the agent guess is not typed in; the placeholder is a short hint', (await page.inputValue('#wz-agent')) === '' && (await page.getAttribute('#wz-agent', 'placeholder')) !== guess);
  await page.fill('#wz-name', 'Wiz');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-style]');
  await page.click('#wzBack'); await page.waitForSelector('#wz-name');
  check('Back keeps the name', (await page.inputValue('#wz-name')) === 'Wiz');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-style]');
  check('Balanced is the recommended one', (await page.locator('.wz-opt', { hasText: 'recommended' }).count()) === 1);
  await page.check('[name=wz-style][value=careful]');
  await page.click('#wzNext'); await page.waitForSelector('[name=wz-plan]');
  check('the five spend steps', (await page.locator('[name=wz-plan]').count()) === 5 && (await page.locator('.wz-opt').first().textContent()).includes('🐢'));
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

  // Advanced mode (AIG-355): one screen per topic, each saved on Next; Back keeps values; the summary's Edit jumps back.
  await page.click('#wzDone'); await page.waitForSelector('.wizard', { state: 'detached' });
  await page.click('#wzRun'); await page.waitForSelector('.wz-dots');
  check('the first screen offers Advanced', await page.isVisible('#wzAdv'));
  await page.click('#wzAdv'); await page.waitForSelector('#wz-name');
  check('twelve screens', (await page.locator('.wz-dot').count()) === 12);
  check('the name is pre-filled', (await page.inputValue('#wz-name')) === 'Wiz');
  const nxt = async sel => { await page.click('#wzNext'); await page.waitForSelector(sel); };
  await nxt('[name=wa-tidy]');
  check('lead style is pre-filled from what is set (Get on with it)', await page.isChecked('[name=wa-tidy][value=no]') && await page.isChecked('[name=wa-go][value=small]') && await page.isChecked('[name=wa-chatty][value=quiet]'));
  check('lead screen has the dev-words question, not the night one', (await page.locator('[name=wa-words]').count()) === 2 && (await page.locator('[name=wa-night]').count()) === 0);
  await page.check('[name=wa-tidy][value=yes]'); await page.check('[name=wa-go][value=ask]'); await page.check('[name=wa-chatty][value=chatty]');
  await nxt('[name=wa-runIn]');
  st = await setup();
  check('lead style saved on Next', st.prefs.tidyCards === true && st.prefs.go === 'ask' && st.prefs.chatty === true, JSON.stringify(st.prefs));
  check('the command box hides until Other', !(await page.isVisible('#wa-runCmd')));
  await page.check('[name=wa-runIn][value=other]'); await page.fill('#wa-runCmd', 'myed "{folder}"');
  await nxt('#wa-budgetH5');
  st = await setup();
  check('where teams run saved', st.prefs.runIn === 'other' && st.prefs.runCmd === 'myed "{folder}"');
  check('budget sliders pre-filled', (await page.inputValue('#wa-budgetH5')) === '100');
  await page.check('[name=wa-plan][value=careful]');
  check('a spend step fills the sliders', (await page.inputValue('#wa-budgetH5')) === '60' && (await page.inputValue('#wa-budgetWk')) === '75' && await page.isChecked('[name=wa-plan][value=careful]'));
  await page.check('#wa-light');
  await nxt('#wa-maxRuns');
  st = await setup();
  check('budget saved', st.prefs.budgetH5 === 60 && st.prefs.budgetWk === 75 && st.prefs.light === true);
  check('parallel pre-filled from the step', (await page.inputValue('#wa-maxRuns')) === '2' && (await page.inputValue('#wa-helpersSonnet')) === '2');
  await page.fill('#wa-helpersSonnet', '4');
  await nxt('[name=wa-usage]');
  st = await setup();
  check('parallel saved', st.prefs.maxRuns === 2 && st.prefs.helpersSonnet === 4 && st.prefs.helpersHaiku === 3);
  check('usage pre-filled, one line on cost', await page.isChecked('[name=wa-usage][value=hand]') && (await page.textContent('#wa-body')).includes('costs a little'));
  await page.check('[name=wa-usage][value=auto]');
  await nxt('[name=wa-help]');
  check('usage saved', (await setup()).prefs.usageChecks === 'auto');
  check('three help levels with their faces', (await page.locator('[name=wa-help]').count()) === 3 && (await page.textContent('#wa-body')).includes('😎'));
  await page.check('[name=wa-help][value="3"]');
  await nxt('[name=wa-dispatch]');
  check('help level saved', (await setup()).prefs.helpLevel === '3');
  check('Dispatcher pre-filled with the default', await page.isChecked('[name=wa-dispatch][value=haiku]'));
  await page.check('[name=wa-dispatch][value=lead]');
  await page.click('#wzBack'); await page.waitForSelector('[name=wa-help]');
  check('Back keeps the help level', await page.isChecked('[name=wa-help][value="3"]'));
  await nxt('[name=wa-dispatch]');
  check('Back and forward keeps the unsaved Dispatcher pick', await page.isChecked('[name=wa-dispatch][value=lead]'));
  await page.check('[name=wa-dispatch][value=rules]');
  await nxt('#wa-roles');
  check('Dispatcher saved', (await setup()).prefs.dispatch === 'rules');
  check('every role starts ticked, the lead locked', (await page.locator('#wa-roles input:checked').count()) === 8 && await page.isDisabled('#wa-roles input[data-role="Lead (Opus)"]'));
  await page.uncheck('#wa-roles input[data-role="QA (Haiku)"]');
  await nxt('[name=wa-night]');
  st = await setup();
  check('default roles saved', Array.isArray(st.prefs.newRoles) && st.prefs.newRoles.length === 7 && !st.prefs.newRoles.includes('QA (Haiku)'), JSON.stringify(st.prefs.newRoles));
  await page.check('[name=wa-night][value=quiet]');
  await nxt('.wizard .lang-pick');
  check('night saved', (await setup()).prefs.watchAll === false);
  await nxt('.wz-sum');
  check('summary lists every choice with an Edit link', (await page.locator('.wz-sum tr').count()) === 11 && (await page.locator('.wz-sum button').count()) === 11);
  check('summary shows the saved values', (await page.textContent('[data-row=help]')).includes('😎') && (await page.textContent('[data-row=runs]')).includes('myed') && (await page.textContent('[data-row=roles]')).includes('Docs (Haiku)') && !(await page.textContent('[data-row=roles]')).includes('QA (Haiku)'));
  await page.click('[data-row=usage] button'); await page.waitForSelector('[name=wa-usage]');
  check('Edit shows the saved choice', await page.isChecked('[name=wa-usage][value=auto]'));
  await page.check('[name=wa-usage][value=off]');
  await page.click('#wzBack'); await page.waitForSelector('.wz-sum');
  check('Back from Edit returns to the summary without saving', (await setup()).prefs.usageChecks === 'auto');
  await page.click('[data-row=usage] button'); await page.waitForSelector('[name=wa-usage]');
  check('the unsaved pick is still there', await page.isChecked('[name=wa-usage][value=off]'));
  await page.click('#wzNext'); await page.waitForSelector('.wz-sum');
  check('saving an edit returns to the summary with the new value', (await setup()).prefs.usageChecks === 'off' && (await page.textContent('[data-row=usage]')).includes('Off'));
  await page.click('#wzDone'); await page.waitForSelector('.wizard', { state: 'detached' });
  const np = await s.ok('POST', '/api/projects', { name: 'Fresh one' });
  const fresh = await s.ok('GET', '/api/projects/' + np.slug);
  check('a new project starts with those roles', Array.isArray(fresh.roles) && fresh.roles.length === 7 && !fresh.roles.includes('QA (Haiku)'), JSON.stringify(fresh.roles));
  noErrors(page);
}, true, (() => { const f = process.env.QA_WIZARD_FILE = path.join(tmp('wizard'), 'aigile.local.json'); return { AIGILE_LOCAL: f }; })());
