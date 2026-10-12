// QA areas: i18n, rtl, usagecheck, popreopen (split from look-setup.mjs, AIG-297; rtl AIG-487).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

// The checker (AIG-487): its JSON report for a folder of language files.
const runCheck = (...a) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'i18n', 'check.mjs'), '--json', ...a], { encoding: 'utf8' }); let j = null; try { j = JSON.parse(r.stdout); } catch {} return { code: r.status, j, out: r.stdout + r.stderr }; };
// A browser context with these extra language files (stubbed: /api/langs lists them, /lang/<code>.json serves a marked copy of English).
const MARK = { ar: 'ع ', he: 'ש ', 'zh-tw': '繁 ', no: 'NO ', fil: 'FIL ', 'pt-br': 'BR ', pirate: 'Arr ', eo: 'EO ' };
async function withLangs(b, opts, codes) {
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
  const files = fs.readdirSync(path.join(ROOT, 'public', 'lang')).filter(f => f !== 'languages.json').map(f => f.slice(0, -5));
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, ...opts });
  await c.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
  await c.route('**/api/langs', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ codes: [...new Set([...files, ...codes])] }) }));
  for (const code of codes) {
    const m = MARK[code] || code.toUpperCase() + ' ';
    const dict = Object.fromEntries(Object.entries(en).map(([k, v]) => [k, k.endsWith('.html') ? v : typeof v === 'string' ? m + v : Object.fromEntries(Object.entries(v).map(([f, x]) => [f, m + x]))]));
    await c.route(`**/lang/${code}.json`, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(dict) }));
  }
  return c;
}

def('i18n', 'languages: every shipped file passes the checker, the 🌐 picker (region, fun last, files that are in), device fallbacks, plurals, Intl dates, no raw keys or {{dev:}} markers (AIG-124, AIG-487)', async (s, ctx) => {
  const langDir = path.join(ROOT, 'public', 'lang');
  const read = f => JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8'));
  const en = read('en.json');
  check('English has strings', Object.keys(en).length > 100, Object.keys(en).length);
  check('dev words are marked in English', Object.values(en).some(v => /\{\{dev:\w+\}\}/.test(v)));

  // The checker passes every shipped language file (missing keys allowed: English shows instead).
  const shipped = fs.readdirSync(langDir).filter(f => !['en.json', 'languages.json'].includes(f)).map(f => f.slice(0, -5));
  const all = runCheck();
  check('the checker runs', !!all.j, all.out.slice(0, 300));
  for (const r of (all.j || { results: [] }).results) check(`${r.code}.json passes the checker` + (r.missing.length ? ` (${r.missing.length} keys fall back to English)` : ''), !r.problems.length, r.problems.slice(0, 5));
  check('the checker looked at every shipped file', shipped.every(c => all.j && all.j.results.some(r => r.code === c)), shipped.length);
  // ... and catches broken files: invalid JSON, a key English doesn't have, a changed placeholder, a bad plural; a file that only misses keys passes.
  const bad = tmp('i18ncheck');
  fs.writeFileSync(path.join(bad, 'en.json'), JSON.stringify({ 'a.hi': 'Hi {name}', 'a.n': { one: '{count} card', other: '{count} cards' }, 'a.x': 'X' }));
  fs.writeFileSync(path.join(bad, 'languages.json'), JSON.stringify([{ code: 'en', label: 'EN', name: 'English', locale: 'en-GB' }, { code: 'xx', label: 'XX', name: 'Xx', locale: 'en-GB' }, { code: 'yy', label: 'YY', name: 'Yy', locale: 'en-GB' }, { code: 'zz', label: 'ZZ', name: 'Zz', locale: 'en-GB' }]));
  fs.writeFileSync(path.join(bad, 'xx.json'), JSON.stringify({ 'a.hi': 'Hoi {naam}', 'a.n': { one: '{count} kaart', lots: '{count} kaarten' }, 'a.extra': 'nope' }));
  fs.writeFileSync(path.join(bad, 'yy.json'), '{ "a.hi": "Hoi {name}", }');
  fs.writeFileSync(path.join(bad, 'zz.json'), JSON.stringify({ 'a.hi': '{name}, hoi', 'a.n': { one: 'één kaart', few: '{count} kaartjes', other: '{count} kaarten' } }));
  const br = runCheck('--dir', bad), res = c => ((br.j || { results: [] }).results.find(r => r.code === c) || { problems: [], missing: [] });
  check('a broken file makes the checker fail', br.code === 1 && br.j && br.j.ok === false, br.out.slice(0, 300));
  check('invalid JSON is reported', res('yy').problems.some(p => /invalid JSON/.test(p)), res('yy').problems);
  check('a key English does not have is reported', res('xx').problems.some(p => /a\.extra/.test(p)), res('xx').problems);
  check('a placeholder that differs is reported', res('xx').problems.some(p => /a\.hi: placeholders \{naam\}/.test(p)), res('xx').problems);
  check('a plural form that does not exist is reported', res('xx').problems.some(p => /a\.n has a plural form/.test(p)), res('xx').problems);
  check('missing keys alone pass, and are counted', !res('zz').problems.length && res('zz').missing.join() === 'a.x', res('zz'));

  // languages.json: LocoRadio's 121, Flemish as nl-BE, the right-to-left ones, the fun ones.
  const list = read('languages.json'), codeSet = new Set(list.map(l => l.code));
  check('languages.json lists 121 languages, each with code, label, own name and locale', list.length === 121 && list.every(l => l.code && l.label && l.name && l.locale), list.length);
  check('Flemish is nl-BE (not vls), for Belgium, based on nl', !codeSet.has('vls') && list.some(l => l.code === 'nl-BE' && l.region === 'BE' && l.base === 'nl'));
  check('LocoRadio codes for the rest (pt-br, zh-tw, fil, no)', ['pt-br', 'zh-tw', 'fil', 'no', 'ckb'].every(c => codeSet.has(c)));
  check('right to left: ar ur fa he ps sd yi ckb', list.filter(l => l.dir === 'rtl').map(l => l.code).sort().join(' ') === 'ar ckb fa he ps sd ur yi', list.filter(l => l.dir === 'rtl').map(l => l.code));
  check('fun languages are flagged (pirate, klingon, emoji, morse)', ['pirate', 'tlh', 'emoji', 'morse'].every(c => list.find(l => l.code === c).fun === true));

  // Seed something on every page: a question, a test with steps, a stand-up answer.
  await mkProject(s, 'Alpha', 'ALP'); await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const q = await mkCard(s, 'alpha', 'Export format');
  s.cli(['ask', 'alpha', q.id, 'M3U or JSON? Assuming M3U', '--as', 'Lead']);
  await mkCard(s, 'alpha', 'Build the thing', { status: 'verify', testSteps: '1. Open it\n2. Click the button' });
  await mkCard(s, 'alpha', 'Raise me', { type: 'bug', priority: 'high' });

  // A stubbed nl.json: one string changed, one key missing (so it must fall back to English).
  const nl = { ...read('nl.json'), 'home.newproject': '+ NIEUW PROJECT' }; delete nl['home.find'];
  const b = ctx.browser();
  // Outside Belgium (time zone and browser language), so the picker offers Nederlands, not Vlaams.
  const pctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-US', timezoneId: 'America/New_York' });
  const page = await pctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
  await page.route('**/lang/nl.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(nl) }));
  await page.goto(BASE + '/#/');
  await page.waitForSelector('#app .toolbar');
  check('starts in English', (await page.evaluate(() => document.documentElement.lang)) === 'en' && (await page.textContent('#app .toolbar .primary')).includes('New project'));
  check('no language picker in the top bar', (await page.locator('header select, header .langbtn').count()) === 0);
  const stray = () => page.evaluate(() => {
    const re = /\b(?:card|inbox|home|board|dlg|setup|usage|standup|dms|pres|cols?|verdict|filter|views|lanes|fy|ago|live|theme|update|poke|night|quiet|crumb|attach|format|happening|ask|look|perm|docs|assignee|role|cv|lang|leave|projects|common)\.[a-z][\w.]*|\{\{dev:/;
    const texts = [document.body.innerText, ...[...document.querySelectorAll('[title],[placeholder],[aria-label]')].map(e => [e.title, e.placeholder, e.getAttribute('aria-label')].join(' '))];
    return texts.map(t => (t.match(re) || [])[0]).filter(Boolean);
  });
  // No raw key and no dev marker on the main pages (English).
  for (const hash of ['#/', '#/p/alpha', '#/p/alpha/ALP-2', '#/inbox', '#/usage', '#/setup', '#/standups']) {
    await page.goto(BASE + '/' + hash); await page.reload(); await page.waitForSelector('#app > *', { timeout: 8000 }); await sleep(400);
    check('no raw keys or markers on ' + hash, (await stray()).length === 0, await stray());
  }
  await page.goto(BASE + '/#/p/alpha'); await page.reload(); await page.waitForSelector('.board');
  await page.click('button:has-text("Raise bug")'); await page.waitForSelector('.dialog');
  check('no raw keys in the bug dialog', (await stray()).length === 0, await stray());
  await page.keyboard.press('Escape');

  // Switching to Dutch loads nl.json (the stub), sets <html lang>, and falls back to English for the missing key.
  await page.goto(BASE + '/#/setup'); await page.waitForSelector('#setupForm');
  // 🌐 picker (AIG-487): a button with the label; the list by own name, only languages whose file is in, Vlaams only in Belgium.
  const pick = async code => { await page.click('.setup .langbtn'); await page.waitForSelector('.setup .langlist:not([hidden])'); await page.click(`.setup .langlist button[data-lang="${code}"]`); };
  check('Setup has the 🌐 picker showing EN', (await page.textContent('.setup .langbtn')).replace(/\s/g, '') === '🌐EN▾', await page.textContent('.setup .langbtn'));
  await page.click('.setup .langbtn');
  check('the list opens with English ticked and focused', await page.isVisible('.setup .langlist') && (await page.getAttribute('.setup .langbtn', 'aria-expanded')) === 'true' && (await page.evaluate(() => document.activeElement.dataset.lang)) === 'en');
  const names = await page.locator('.setup .langlist button').allTextContents();
  check('the list shows the languages whose file is in, by own name; no Vlaams outside Belgium', names.includes('English') && names.includes('Nederlands') && !names.includes('Vlaams') && names.length === shipped.length, names);
  await page.keyboard.press('ArrowDown');
  check('arrow keys move through the list', (await page.evaluate(() => document.activeElement.dataset.lang)) !== 'en');
  await page.keyboard.press('Escape');
  check('Esc closes the list and focus goes back to the button', await page.isHidden('.setup .langlist') && await page.evaluate(() => document.activeElement.classList.contains('langbtn')));
  check('Esc on the list does not leave Setup', await page.isVisible('#setupForm'));
  await pick('nl');
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8000 });
  await page.goto(BASE + '/#/'); await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8000 });
  await page.waitForSelector('#app .toolbar');
  check('html lang is nl', (await page.evaluate(() => document.documentElement.lang)) === 'nl');
  check('a string comes from nl.json', (await page.textContent('#app .toolbar .primary')).trim().toLowerCase() === '+ nieuw project', await page.textContent('#app .toolbar .primary'));
  check('a missing key falls back to English', await page.evaluate(() => { delete i18n.dict['home.newproject']; return t('home.newproject') === i18n.en['home.newproject']; }));
  check('the choice is remembered', (await page.evaluate(() => localStorage.getItem('aigile.lang'))) === 'nl');
  check('no 🌐 EN button until the switch is on', await page.locator('#enBtn').isHidden());
  await page.goto(BASE + '/#/setup'); await page.waitForSelector('#setupForm');
  await page.check('#enSwitch');
  await page.waitForSelector('#enBtn:not([hidden])');
  await page.click('#enBtn');
  await page.waitForFunction(() => document.documentElement.lang === 'en' && /NL/.test(document.getElementById('enBtn')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});   // the button repaints just after the language loads
  check('🌐 EN shows the board in English, and the button offers the way back', /NL/.test(await page.textContent('#enBtn')) && (await page.evaluate(() => localStorage.getItem('aigile.lang'))) === 'nl');
  await page.waitForSelector('#setupForm');
  check('Setup still shows your own language', (await page.textContent('.setup .langbtn .langlab')) === 'NL');
  await page.click('#enBtn');
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8000 });
  await page.waitForSelector('#setupForm');
  check('in Dutch the list puts the device language (English) first', (await page.locator('.setup .langlist button').first().getAttribute('data-lang')) === 'en');
  await pick('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 8000 });
  await page.waitForSelector('#setupForm');
  check('back to English', (await page.evaluate(() => localStorage.getItem('aigile.lang'))) === 'en');

  // Plurals (AIG-487): { one, other } through Intl.PluralRules with {count}; a language's own forms (Russian: one, few, many).
  check('plural one/other in English', await page.evaluate(() => t('quiet.done.told', { count: 1 }) === '📣 Told 1 team' && t('quiet.done.told', { count: 3 }) === '📣 Told 3 teams'));
  check('plural forms follow the language (ru: 1 one, 3 few, 5 many, 21 one)', await page.evaluate(() => {
    const keep = [i18n.dict, i18n.locale];
    i18n.dict = { 'x.n': { one: '{count} карточка', few: '{count} карточки', many: '{count} карточек', other: '{count} карточки' } }; i18n.locale = 'ru-RU';
    const out = [1, 3, 5, 21].map(n => t('x.n', { count: n })).join('|');
    [i18n.dict, i18n.locale] = keep;
    return out === '1 карточка|3 карточки|5 карточек|21 карточка';
  }));
  check('a plural key with no count uses the one form, a plain string still works', await page.evaluate(() => t('inbox.g.count') === '{count} card' && t('lang.title') === 'Language'));
  check('English dates follow the browser region (en-US here)', (await page.evaluate(() => i18n.locale)) === 'en-US');
  noErrors(page);

  // No saved pick (AIG-352): the device language decides, nl-BE before nl before en; an explicit pick wins.
  // codes: extra (stubbed) language files that are "in" for this start.
  const startIn = async (locale, pick, { navLangs, ...more } = {}, codes = []) => {
    const c = await withLangs(b, { locale, ...more }, codes);
    if (navLangs) await c.addInitScript(l => { Object.defineProperty(navigator, 'languages', { get: () => l }); }, navLangs);   // a tag the browser itself would rewrite
    try {
      const p = await c.newPage();
      p.errors = []; p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
      await p.goto(BASE + '/#/'); await p.waitForSelector('#app .toolbar');
      if (pick) { await p.evaluate(l => localStorage.setItem('aigile.lang', l), pick); await p.reload(); await p.waitForSelector('#app .toolbar'); }
      await sleep(200);
      return { lang: await p.evaluate(() => i18n.lang), html: await p.evaluate(() => document.documentElement.lang), dir: await p.evaluate(() => document.documentElement.dir), locale: await p.evaluate(() => i18n.locale), errors: p.errors, alpha: ((await p.textContent("header .alpha-tag")) || "").trim(), tip: await p.getAttribute("header .alpha-tag", "title"),
        names: await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = langPickHtml(); return [...d.querySelectorAll('.langlist button')].map(x => x.dataset.lang); }),
        newProject: (await p.textContent('#app .toolbar .primary')).trim() };
    } finally { await c.close(); }
  };
  const fl = await startIn('nl-BE');
  check('a nl-BE device with no pick starts in Flemish', fl.lang === 'nl-BE' && fl.html === 'nl-BE' && fl.locale === 'nl-BE', fl);
  check('in Belgium the picker offers Vlaams, not Nederlands', fl.names.includes('nl-BE') && !fl.names.includes('nl'), fl.names);
  const du = await startIn('nl-NL', null, { timezoneId: 'Europe/Amsterdam' });
  check('a nl-NL device with no pick starts in Dutch, with Dutch dates', du.lang === 'nl' && du.locale === 'nl-NL' && !du.names.includes('nl-BE'), du);
  check('plain nl in the Brussels time zone starts in Flemish', (await startIn('nl', null, { timezoneId: 'Europe/Brussels' })).lang === 'nl-BE');
  check('a fr-BE device with no pick starts in French, not Flemish', (await startIn('fr-BE')).lang === 'fr');
  const saved = await startIn('nl-BE', 'en');
  check('a saved en pick wins over a nl-BE device', saved.lang === 'en', saved.lang);
  check('no page errors in the device-language starts', saved.errors.length === 0, saved.errors);
  // LocoRadio's fallbacks, with stubbed files: zh-HK -> zh-tw, nb -> no, tl -> fil, pt-BR -> pt-br, iw -> he; fun languages never by themselves.
  const extra = ['zh-tw', 'no', 'fil', 'pt-br', 'he', 'ar', 'pirate', 'eo'];
  for (const [loc, want] of [['zh-HK', 'zh-tw'], ['nb-NO', 'no'], ['nn', 'no'], ['tl', 'fil'], ['pt-BR', 'pt-br'], ['he-IL', 'he']]) {
    const r = await startIn(loc, null, {}, extra);
    check(`a ${loc} device starts in ${want}`, r.lang === want, r.lang);
  }
  check('an old iw (Hebrew) browser starts in he', (await startIn('en-US', null, { navLangs: ['iw'] }, extra)).lang === 'he');
  const us = await startIn('en-US', null, {}, extra);
  const fun = await startIn('eo', null, { timezoneId: 'Europe/London' }, extra);
  check('a fun language (Esperanto) is never picked by itself', fun.lang === 'en', fun.lang);
  check('fun languages come last in the list, English second after the device language', fun.names[0] === 'en' && fun.names.slice(-2).sort().join() === 'eo,pirate', fun.names);
  check('a stubbed language shows its file (marked), its locale and dir', (await startIn('en-US', 'pt-br', {}, extra)).newProject.startsWith('BR '));
  check('the extra stubbed files show in the list only because they are in', us.names.includes('zh-tw') && !(await startIn('en-US')).names.includes('zh-tw'));
  const rtl = await startIn('en-US', 'ar', {}, extra);
  check('Arabic sets <html dir=rtl> and lang ar, Latin digits in dates', rtl.dir === 'rtl' && rtl.html === 'ar' && rtl.locale === 'ar-u-nu-latn', rtl);
  check('English goes back to dir=ltr', saved.dir === 'ltr');
  // The closed alpha label (AIG-348) in the top bar, in each language.
  const flem = await startIn('nl-BE'), engl = await startIn('en-US');
  check('the alpha label reads Gesloten alfa in Flemish, with its tooltip', flem.alpha === '🐣 Gesloten alfa' && flem.tip === 'Vroeg en nog niet af: bedankt om het uit te proberen!', flem.alpha + ' / ' + flem.tip);
  check('the alpha label reads Closed alpha in English, with its tooltip', engl.alpha === '🐣 Closed alpha' && engl.tip === 'Early and unfinished: thanks for trying it!', engl.alpha + ' / ' + engl.tip);
  check('the alpha label is on the board page in the main context', (await page.locator('header .alpha-tag').count()) === 1);
  await pctx.close();
}, true);

def('rtl', 'right to left (AIG-487): a stubbed Arabic file mirrors the board, card panel, rail, dialogs, inbox and Setup; nothing sticks out; code stays left to right', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const a = await mkCard(s, 'alpha', 'Build the thing', { status: 'verify', testSteps: '1. Open it\n2. Run `npm test`', description: 'Run this:\n\n```\nnode aigile.js list\n```' });
  await mkCard(s, 'alpha', 'Doing this', { status: 'doing' });
  const shots = tmp('rtl');
  for (const [w, h] of [[1400, 900], [390, 844]]) {
    const c = await withLangs(ctx.browser(), { viewport: { width: w, height: h }, locale: 'en-US' }, ['ar']);
    await c.addInitScript(() => { try { localStorage.setItem('aigile.lang', 'ar'); } catch {} });
    const page = await c.newPage(), tag = w > 600 ? 'desktop' : 'phone';
    page.errors = []; page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
    const fits = async label => { const m = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); check(`${tag} ${label}: nothing sticks out sideways (${m[0]} <= ${m[1]})`, m[0] <= m[1], m); };
    const shot = async n => page.screenshot({ path: path.join(shots, `${tag}-${n}.png`) });
    await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board .column');
    check(`${tag}: <html dir=rtl lang=ar>`, (await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang].join())) === 'rtl,ar');
    const cols = await page.evaluate(() => [...document.querySelectorAll('.board .column')].map(e => e.getBoundingClientRect().left));
    if (w > 600) {
      check('board: the first column is on the right', cols.length > 1 && cols[0] > cols[cols.length - 1], cols);
      const rail = await page.evaluate(() => { const r = document.getElementById('dmRail').getBoundingClientRect(), m = document.getElementById('app').getBoundingClientRect(); return { rail: r.right, railL: r.left, app: m.right, W: innerWidth }; });
      check('rail: on the right edge, the page beside it', rail.rail >= rail.W - 1 && rail.app <= rail.railL + 1, rail);
    }
    await fits('board'); await shot('board');
    await page.goto(BASE + '/#/p/alpha/' + a.id); await page.waitForSelector('.panel');
    const pre = await page.evaluate(() => { const p = document.querySelector('.panel pre'); return p ? getComputedStyle(p).direction : 'none'; });
    check(`${tag} card panel: open, code stays left to right`, pre === 'ltr', pre);
    await fits('card panel'); await shot('card');
    await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
    await page.click('button:has-text("Raise bug")'); await page.waitForSelector('.dialog');
    const dlg = await page.evaluate(() => { const r = document.querySelector('.dialog').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; });
    check(`${tag} dialog: inside the window`, dlg);
    await fits('dialog'); await shot('dialog');
    await page.keyboard.press('Escape');
    await page.goto(BASE + '/#/inbox'); await page.waitForSelector('#app > *'); await sleep(500);
    await fits('inbox'); await shot('inbox');
    await page.goto(BASE + '/#/setup'); await page.waitForSelector('#setupForm');
    check(`${tag} Setup: the picker shows AR`, (await page.textContent('.setup .langbtn .langlab')) === 'AR');
    await page.click('.setup .langbtn'); await page.waitForSelector('.setup .langlist:not([hidden])');
    const lst = await page.evaluate(() => { const r = document.querySelector('.setup .langlist').getBoundingClientRect(); return { l: r.left, r: r.right, W: innerWidth }; });
    check(`${tag} Setup: the open list is inside the window`, lst.l >= -1 && lst.r <= lst.W + 1, lst);
    await fits('setup'); await shot('setup');
    check(`${tag}: no page errors`, page.errors.length === 0, page.errors);
    await c.close();
  }
  console.log('      rtl screenshots: ' + shots);
}, true);

def('usagecheck', '🔄 Check usage now: starts the agent hidden, waits for a reading, auto switch (AIG-151)', async (s, ctx) => {
  check('status says auto is off at first', (await s.ok('GET', '/api/usage/check')).auto === false);
  const page = await openPage(ctx, '#/usage');
  await page.waitForSelector('#uzCheck');
  await page.click('#uzCheck');
  await page.waitForFunction(() => /Last reading/.test(document.querySelector('.uz-check').textContent), null, { timeout: 30000 }).catch(() => {});
  check('the button gets a fresh reading from the stand-in agent', /Last reading/.test(await page.textContent('.uz-check')) && (await s.ok('GET', '/api/limits')).latest.h5.pct === 42, await page.textContent('.uz-check'));
  check('a second check within 2 minutes is refused', (await s.api('POST', '/api/usage/check')).status === 400);
  await page.check('.uz-check input[type=checkbox]');
  await sleep(300);
  check('the auto switch is saved', (await s.ok('GET', '/api/usage/check')).auto === true);
  noErrors(page);
}, true, (() => {
  // A stand-in agent: posts a usage reading to this QA server, like Claude's status line would.
  const dir = tmp('usagecheck'), script = path.join(dir, 'post.js'), bat = path.join(dir, 'agent.bat');
  fs.writeFileSync(script, `fetch('http://127.0.0.1:' + process.env.AIGILE_PORT + '/api/limits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate_limits: { five_hour: { used_percentage: 42, resets_at: 1 }, seven_day: { used_percentage: 7, resets_at: 2 } } }) }).catch(() => {}).then(() => setTimeout(() => {}, 30000));`);
  fs.writeFileSync(bat, `@echo off\r\nnode "${script}"\r\n`);
  return { AIGILE_AGENT_COMMAND: bat, AIGILE_NO_USAGE_AUTO: '1' };
})());

def('popreopen', '⧉ a pop-out closed by sending a card back opens again when the team replies (AIG-183)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Server steps', { status: 'verify', testSteps: 'Step 1: run the setup' });
  const main = await openPage(ctx, '#/p/alpha');
  const popP = ctx.waitForEvent('page');
  await main.evaluate(id => window.open('#/pop/alpha/' + id, 'aigile-alpha-' + id, 'width=560,height=780'), c.id);   // opened by the page, like ⧉ Pop out
  const pop = await popP;
  await pop.waitForSelector('#v-text');
  await pop.fill('#v-text', 'Step 1 failed');
  const closed = pop.waitForEvent('close', { timeout: 5000 }).then(() => true).catch(() => false);
  await pop.click('.verdict button:has-text("Send back")');
  check('sending back closes the pop-out', await closed);
  check('the card is remembered', /alpha\/ALP-/.test(await main.evaluate(() => localStorage.getItem('aigile.reopen') || '')));
  const opened = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  s.cli(['comment', 'alpha', c.id, 'Thanks. Step 2: restart it', '--as', 'Lead']);
  const again = await opened;
  check('the team replying opens it again', !!again && (await again.evaluate(() => location.hash)) === '#/pop/alpha/' + c.id, again && await again.evaluate(() => location.hash));
  check('and it is forgotten after reopening', !/ALP-/.test(await main.evaluate(() => localStorage.getItem('aigile.reopen') || '')));
  noErrors(main);
}, true);
