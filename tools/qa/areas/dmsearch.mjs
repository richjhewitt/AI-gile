// QA area: dmsearch (AIG-1252, AIG-1251): a search box on the Messages chat list (name and last message, keyboard friendly),
// and a sound + desktop notification when a friend writes (same alert switch, quiet in focus mode, a click opens the chat).
import { check, sleep, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('dmsearch', 'Messages: search box filters chats by name and last message; a friend writing beeps and notifies (AIG-1252, AIG-1251)', async (s, ctx) => {
  for (const [n, k] of [['Davy Site', 'DS'], ['Other Thing', 'OT']]) { await mkProject(s, n, k); await s.ok('POST', '/api/projects/' + n.toLowerCase().replace(' ', '-') + '/team', { name: 'Lead', role: 'Lead' }); }
  await s.ok('POST', '/api/projects/davy-site/leadchat', { text: 'hello there', author: 'Lead' });
  await s.ok('POST', '/api/projects/other-thing/leadchat', { text: 'the dave report', author: 'Lead' });
  // two made-up friends, the second one writing later (the page reads the contacts list)
  let contacts = [
    { id: 'c1', name: 'Davy', last: '2026-01-01T10:00:00Z', lastText: 'see you', lastIn: '2026-01-01T10:00:00Z' },
    { id: 'c2', name: 'Mo', last: '2026-01-01T09:00:00Z', lastText: 'ok', lastIn: '2026-01-01T09:00:00Z' },
  ];
  const page = await openPage(ctx, '#/');
  await page.route(/\/api\/dms\/contacts\/c\d\//,r => r.fulfill({ json: /usage/.test(r.request().url()) ? { projects: [], at: '' } : [] }));   // the made-up friends have no files
  await page.route('**/api/dms/contacts', r => r.request().method() === 'GET' ? r.fulfill({ json: contacts }) : r.continue());
  await page.addInitScript(() => {
    window.__notes = []; window.__beeps = 0;
    localStorage.setItem('aigile.alerts', '1');
    window.Notification = class { constructor(title, o) { this.title = title; this.o = o; window.__notes.push(this); } close() {} static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
    window.addEventListener('DOMContentLoaded', () => { IB.beep = () => { window.__beeps++; }; });
  });
  await page.reload();
  await page.waitForFunction(() => typeof IB !== 'undefined' && IB.beep);
  await page.evaluate(() => { IB.beep = () => { window.__beeps++; }; });
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmSearch');
  await page.waitForSelector('#dmPanel [data-dm="dm:c1"]');
  const keys = async () => (await page.locator('#dmPanel .dm-list [data-dm]').evaluateAll(a => a.map(x => x.dataset.dm))).filter(k => k !== '_allhands' && k !== '_assistant');
  check('all chats show with an empty box', (await keys()).length >= 4, await keys());
  await page.fill('#dmSearch', 'dav');
  await sleep(200);
  let k = await keys();
  check('typing dav keeps only Davy chats (name or last message)', k.includes('dm:c1') && k.includes('davy-site') && !k.includes('dm:c2'), k);
  check('typing keeps focus in the box', await page.evaluate(() => document.activeElement.id === 'dmSearch'));
  await page.fill('#dmSearch', 'the dave report');
  await sleep(200);
  k = await keys();
  check('the last message is searched too', k.join() === 'other-thing', k);
  await page.fill('#dmSearch', 'zzzz');
  await sleep(200);
  check('no match says so', /zzzz/.test(await page.textContent('#dmPanel .dm-empty')));
  await page.press('#dmSearch', 'Escape');
  await sleep(200);
  check('Escape clears the box and shows everything', (await page.inputValue('#dmSearch')) === '' && (await keys()).length >= 4);
  await page.fill('#dmSearch', 'mo');
  await sleep(200);
  await page.press('#dmSearch', 'ArrowDown');
  check('ArrowDown moves to the first row', await page.evaluate(() => document.activeElement.classList.contains('dm-row')));
  await page.focus('#dmSearch');
  await page.press('#dmSearch', 'Enter');
  await page.waitForSelector('#dmList');
  check('Enter opens the first match', /Mo/.test(await page.textContent('#dmPanel .dm-head')));
  await page.click('#dmPanel button[onclick="Dms.back()"]');
  await page.waitForSelector('#dmSearch');
  await page.fill('#dmSearch', '');
  // phone width
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(200);
  const box = await page.evaluate(() => { const r = document.getElementById('dmSearch').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  check('the search box fits at 390px', box.l >= 0 && box.r <= box.w, box);
  await page.setViewportSize({ width: 1400, height: 900 });
  // AIG-1251: Mo writes again while the Messages panel is closed
  await page.click('#dmPanel button[onclick="Dms.close()"]');
  await page.evaluate(() => (PagePoll.invalidate(), Dms.reload()));
  await sleep(300);
  check('no notification before anyone writes', await page.evaluate(() => window.__notes.length) === 0);
  contacts = contacts.map(c => c.id === 'c2' ? { ...c, last: '2026-01-02T09:00:00Z', lastText: 'are you there?', lastIn: '2026-01-02T09:00:00Z' } : c);
  await page.evaluate(() => (PagePoll.invalidate(), Dms.reload()));
  await page.waitForFunction(() => window.__notes.length === 1);
  const n = await page.evaluate(() => ({ t: window.__notes[0].title, b: window.__notes[0].o.body, beeps: window.__beeps }));
  check('a friend writing beeps and notifies with their words', n.beeps === 1 && /Mo/.test(n.t) && n.b === 'are you there?', n);
  await page.evaluate(() => (PagePoll.invalidate(), Dms.reload())); await sleep(300);
  check('the same message does not notify twice', await page.evaluate(() => window.__notes.length) === 1);
  await page.evaluate(() => { document.documentElement.setAttribute('data-focus', '1'); });
  contacts = contacts.map(c => c.id === 'c2' ? { ...c, lastText: 'again', lastIn: '2026-01-03T09:00:00Z' } : c);
  await page.evaluate(() => (PagePoll.invalidate(), Dms.reload())); await sleep(300);
  check('quiet in focus mode', await page.evaluate(() => window.__notes.length) === 1);
  await page.evaluate(() => { document.documentElement.removeAttribute('data-focus'); document.documentElement.setAttribute('data-night', '1'); });
  contacts = contacts.map(c => c.id === 'c2' ? { ...c, lastText: 'and again', lastIn: '2026-01-04T09:00:00Z' } : c);
  await page.evaluate(() => (PagePoll.invalidate(), Dms.reload())); await sleep(300);
  check('quiet when going quiet', await page.evaluate(() => window.__notes.length) === 1);
  await page.evaluate(() => { document.documentElement.removeAttribute('data-night'); });
  contacts = contacts.map(c => c.id === 'c1' ? { ...c, lastText: 'hi again', lastIn: '2026-01-05T09:00:00Z' } : c);
  await page.evaluate(() => (PagePoll.invalidate(), Dms.reload()));
  await page.waitForFunction(() => window.__notes.length === 2);
  await page.evaluate(() => window.__notes[1].onclick());
  await page.waitForSelector('#dmPanel #dmList');
  check('clicking the notification opens that chat', /Davy/.test(await page.textContent('#dmPanel .dm-head')));
  noErrors(page);
}, true);
