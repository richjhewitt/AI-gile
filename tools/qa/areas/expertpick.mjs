// QA area: expertpick (AIG-844, AIG-845): 🎓 Request an expert. The keyword routing table (plain code, no AI), the picker in the idea box,
// the roster entry ("Lexi (Legal, Sonnet)"), the Lead chat request and the expert's template intro, No AI mode, phone width and dark mode.
import { check, until, mkProject, openPage, noErrors, def } from '../lib.mjs';

const CASES = [
  ['Can you check my terms and conditions and the contract', 'lawyer'],
  ['Is my cookie banner GDPR proof?', 'privacy'],
  ['I need help with my VAT and invoices', 'accounts'],
  ['wat moet de prijs van mijn abonnement worden', 'pricing'],
  ['Fix the bug in the login page code', 'dev'],
  ['Move the site to a new server and set up backups', 'ops'],
  ['New logo and colours for the app', 'ui'],
  ['Write a newsletter to announce it', 'writer'],
  ['Instagram campaign for the launch', 'social'],
  ['Answer a customer complaint about a refund', 'helpdesk'],
  ['Please write a test plan', 'tester'],
  ['Hoe neem ik iemand aan, een vacature plaatsen', 'hr'],
  ['uitleg graag', 'generalist'],   // "ui" must not hit inside "uitleg"
  ['Help me with something', 'generalist']
];

def('expertpick', '🎓 Request an expert: keyword routing table (no AI), picker in the idea box, roster entry, Lead chat request and intro, No AI, phone, dark (AIG-844, AIG-845)', async (s, ctx) => {
  const list = await s.ok('GET', '/api/experts');
  const ids = list.groups.flatMap(g => g.presets.map(p => p.id));
  check('8 groups in order build..support, 2 presets each', list.groups.map(g => g.id).join() === 'build,design,business,legal,money,people,marketing,support' && list.groups.every(g => g.presets.length === 2), list.groups.map(g => g.id));
  const roles = (await s.ok('GET', '/api/profiles')).roles.map(r => r.id);
  check('every preset has a real role profile, a model and an emoji', list.groups.every(g => g.emoji && g.presets.every(p => roles.includes(p.role) && ['haiku', 'sonnet', 'opus'].includes(p.model) && p.emoji && p.name)) && roles.includes(list.generalist.role));
  for (const [text, want] of CASES) {
    const r = await s.ok('POST', '/api/experts/match', { text });
    check(`match "${text}" -> ${want}`, r.id === want && (want === 'generalist' ? r.via === 'generalist' : r.via === 'keywords'), r);
  }

  await mkProject(s, 'Expo', 'EXP');
  const page = await openPage(ctx, '#/p/expo');
  await page.click('#ideaBtn'); await page.waitForSelector('#idea-text');
  check('the 🎓 Request an expert button is in the idea box', await page.isVisible('#expertBtn') && /Request an expert/.test(await page.textContent('#expertBtn')));
  await page.click('#expertBtn'); await page.waitForSelector('.xp-preset');
  check('picker: 16 presets in 8 groups plus the describe box', (await page.locator('.xp-preset').count()) === 16 && (await page.locator('.xp-group').count()) === 8 && await page.isVisible('#xp-text'));
  check('picker: the project defaults to this board', (await page.inputValue('#xp-project')) === 'expo');
  await page.fill('#xp-text', 'someone to check my terms and conditions');
  await page.waitForFunction(() => /Legal/.test(document.getElementById('xp-looks').textContent));
  await page.fill('#xp-text', 'zzz qqq');
  await page.waitForFunction(() => /Nothing specific/.test(document.getElementById('xp-looks').textContent));

  // Phone width and dark mode.
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('phone width: preset buttons are big tap targets', (await page.locator('.xp-preset').first().boundingBox()).height >= 32);
  await page.emulateMedia({ colorScheme: 'dark' });
  check('dark mode: a preset is visible with readable text', await page.evaluate(() => { const b = document.querySelector('.xp-preset'), cs = getComputedStyle(b); return b.offsetHeight > 20 && cs.color !== cs.backgroundColor; }));
  await page.setViewportSize({ width: 1280, height: 800 }); await page.emulateMedia({ colorScheme: 'light' });

  // Pick a preset and send.
  await page.fill('#xp-text', '');
  await page.click('.xp-preset[data-id="lawyer"]');
  check('the chosen preset is marked pressed', (await page.getAttribute('.xp-preset[data-id="lawyer"]', 'aria-pressed')) === 'true');
  await page.click('.xp form button[type=submit], form.xp button[type=submit]');
  await page.waitForSelector('#xp-text', { state: 'detached' });
  const p = await s.ok('GET', '/api/projects/expo');
  const m = p.team.find(x => x.expert === 'lawyer');
  check('the roster has "Lexi (Legal, Sonnet)" on the Sonnet model', m && m.name === 'Lexi (Legal, Sonnet)' && m.model === 'sonnet', p.team);
  const chat = (await s.ok('GET', '/api/projects/expo/leadchat')).messages;
  check('the Lead chat records the request (from the owner)', chat.some(x => x.mine && /Expert requested: Lexi \(Legal, Sonnet\)/.test(x.text)), chat);
  const intro = chat.find(x => x.author === 'Lexi (Legal, Sonnet)');
  check('the expert\'s first message says who it is and what it can help with', intro && !intro.mine && /I am Lexi/.test(intro.text) && /contracts, terms/.test(intro.text), intro);
  const again = await s.ok('POST', '/api/projects/expo/expert', { preset: 'lawyer' });
  check('the same expert again is not added twice', again.existed && (await s.ok('GET', '/api/projects/expo')).team.filter(x => x.expert === 'lawyer').length === 1);

  // Typed text: matched by keywords; unmatched = generalist and the lead is told it may pick better.
  const typed = await s.ok('POST', '/api/projects/expo/expert', { text: 'my VAT is a mess' });
  check('typed text routes by keywords to Penny (Accounting, Haiku)', typed.preset === 'accounts' && typed.member.name === 'Penny (Accounting, Haiku)', typed);
  const gen = await s.ok('POST', '/api/projects/expo/expert', { text: 'a hand with something odd' });
  const chat2 = (await s.ok('GET', '/api/projects/expo/leadchat')).messages;
  check('no match: the generalist, and the request tells the lead to pick a better one', gen.preset === 'generalist' && gen.via === 'generalist' && chat2.some(x => x.mine && /generalist/.test(x.text) && /Lead:/.test(x.text)), gen);
  const bad = await s.api('POST', '/api/projects/expo/expert', {});
  check('no preset and no text is refused', bad.status === 400, bad.status);

  // No AI mode: the same routing, in plain code.
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  check('No AI is on', (await s.ok('GET', '/api/meta')).noAi === true);
  const na = await s.ok('POST', '/api/experts/match', { text: 'zzz qqq' });
  check('No AI: no match falls back to the generalist, no call', na.id === 'generalist');
  const nr = await s.ok('POST', '/api/projects/expo/expert', { preset: 'dev' });
  check('No AI: requesting an expert still works', nr.member.name === 'Dex (Developer, Sonnet)', nr);
  await s.ok('POST', '/api/setup', { prefs: { noAi: false } });
  const team = (method, url, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'cli', 'x-aigile-as': 'Dev' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));   // a team call: not the owner (AIG-840)
  const te = await team('POST', '/api/projects/expo/expert', { preset: 'dev' });
  check('a team request for an expert is refused with 403', te.status === 403, te);
  noErrors(page);
}, true);
