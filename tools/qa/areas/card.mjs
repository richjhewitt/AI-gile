// QA areas: card, gobutton, attach, refresh, drafts, openit, testnotes, editor, steady.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, freePort, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('card', 'tabs, reply survives polling, Enter sends, Accept, Wait and see, formatting', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const desc = 'Intro with **bold words** here\n\n- first point\n- second point\n\n```\nnpm run thing\n```\n';
  await mkCard(s, 'alpha', 'Verify me', { status: 'verify', testSteps: 'Step one', description: desc });
  await mkCard(s, 'alpha', 'Chatty', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', 'ALP-2', 'Forge', 'working on it');
  await mkCard(s, 'alpha', 'Verify two', { status: 'verify', testSteps: 'Step two' });
  await mkCard(s, 'alpha', 'Verify three', { status: 'verify', testSteps: 'Step three' });
  const page = await openPage(ctx, '#/p/alpha/ALP-1');
  await page.waitForSelector('#modal .panel');
  const tabs = await page.$$eval('#modal .ctab', els => els.map(e => e.dataset.ctab));
  check('verify card has Reply/Details/Test tabs', JSON.stringify(tabs) === JSON.stringify(['reply', 'details', 'test']), tabs);
  check('verify card opens on Test', (await page.getAttribute('#modal .ctab.on', 'data-ctab')) === 'test');
  await page.click('.ctab[data-ctab=details]');
  check('Details pane shown', await page.isVisible('.cpane[data-pane=details]') && !(await page.isVisible('.cpane[data-pane=test]')));
  check('bullet list renders', (await page.locator('.cpane[data-pane=details] ul.bl li').count()) === 2);
  check('bold renders', (await page.locator('.cpane[data-pane=details] .desc b').first().textContent()) === 'bold words');
  check('code box with Copy renders', (await page.locator('.cpane[data-pane=details] .codebox pre code').textContent()) === 'npm run thing' && (await page.locator('.codebox button.copy').count()) === 1);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('.codebox button.copy');
  await page.waitForTimeout(200);
  check('Copy button confirms', /Copied/.test(await page.textContent('.codebox button.copy')));
  await page.click('.ctab[data-ctab=reply]');
  await page.fill('#r-text', 'my unsent draft');
  await page.waitForTimeout(2500);
  check('reply text survives 2.5s of polling', (await page.inputValue('#r-text')) === 'my unsent draft');
  check('still the same tab after polling', (await page.getAttribute('#modal .ctab.on', 'data-ctab')) === 'reply');

  // Wait and see (verify card ALP-1): panel closes, card stays in verify
  const before = (await getCard(s, 'alpha', 'ALP-1')).updated;
  await page.click('.ctab[data-ctab=test]');
  await page.click('button[onclick="waitAndSee()"]');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  const w = await getCard(s, 'alpha', 'ALP-1');
  check('Wait and see closes panel, keeps verify, moves to back', w.status === 'verify' && w.updated >= before && !page.url().endsWith('ALP-1'), [w.status, page.url()]);

  // Enter sends (ALP-2)
  await page.goto(BASE + '/#/p/alpha/ALP-2');
  await page.waitForSelector('#r-text');
  await page.fill('#r-text', 'thanks, carry on');
  await page.press('#r-text', 'Enter');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  const c2 = await getCard(s, 'alpha', 'ALP-2');
  check('Enter sends and closes the panel', c2.comments.at(-1).text === 'thanks, carry on' && c2.comments.at(-1).author === 'Owner' && c2.status === 'team', [c2.status, c2.comments.at(-1)]);

  // Accept (ALP-3)
  await page.goto(BASE + '/#/p/alpha/ALP-3');
  await page.waitForSelector('#modal .panel');
  await page.click('button.good');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  check('Accept marks done and leaves the card', (await getCard(s, 'alpha', 'ALP-3')).status === 'done');

  // Send back needs a reason (ALP-4)
  await page.goto(BASE + '/#/p/alpha/ALP-4');
  await page.waitForSelector('#modal .panel');
  await page.click('button.warn');
  check('Send back without a reason shows an error', /Say what is wrong/.test(await page.textContent('#v-err')));
  await page.fill('#v-text', 'nope');
  await page.click('button.warn');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  check('Send back moves to team', (await getCard(s, 'alpha', 'ALP-4')).status === 'team');

  // Edit
  await page.goto(BASE + '/#/p/alpha/ALP-2');
  await page.waitForSelector('#modal .panel');
  await page.click('button[onclick="editCard()"]');
  await page.fill('#f-title', 'Chatty renamed');
  await page.click('form button[type=submit]');
  await page.waitForTimeout(500);
  check('edit saves the title', (await getCard(s, 'alpha', 'ALP-2')).title === 'Chatty renamed');
  noErrors(page);
}, true);

def('gobutton', '👍 Go answers a question in one tap, in the inbox and on the card', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const q1 = await mkCard(s, 'alpha', 'First question'), q2 = await mkCard(s, 'alpha', 'Second question'), b = await mkCard(s, 'alpha', 'Stuck');
  for (const c of [q1, q2]) s.cli(['ask', 'alpha', c.id, 'Go?', '--as', 'Lead']);
  s.cli(['block', 'alpha', b.id, 'no key', '--as', 'Lead']);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${q1.id}"] button[data-act="go"]`);
  check('title counts everything waiting (desktop badge)', (await page.title()) === '(3) AI-gile', await page.title());
  check('blocked card has no Go', (await page.locator(`.ib-item[data-id="${b.id}"] button[data-act="go"]`).count()) === 0);
  // AIG-167: a blocked item can be put off for an hour.
  await page.click(`.ib-item[data-id="${b.id}"] button[data-act="wait"]`);
  await page.waitForSelector(`.ib-item[data-id="${b.id}"]`, { state: 'detached', timeout: 5000 }).catch(() => {});
  const blk = await getCard(s, 'alpha', b.id), inb = await s.ok('GET', '/api/inbox');
  check('Later hides a blocked item for now', (await page.locator(`.ib-item[data-id="${b.id}"]`).count()) === 0 && !inb.some(x => x.id === b.id), [blk.snoozedUntil, blk.blocked, inb.map(x => x.id)]);
  await page.click(`.ib-item[data-id="${q1.id}"] button[data-act="go"]`);
  await page.waitForSelector(`.ib-item[data-id="${q1.id}"]`, { state: 'detached', timeout: 4000 }).catch(() => {});
  let c = await getCard(s, 'alpha', q1.id);
  check('inbox Go sends GO and clears the question', c.comments.at(-1).author === 'Owner' && c.comments.at(-1).text === 'GO' && !c.needsYou && c.status === 'team', c);
  await page.goto(BASE + '/#/p/alpha/' + q2.id);
  await page.click('.reply button:has-text("Go")');
  await sleep(500);
  c = await getCard(s, 'alpha', q2.id);
  check('card Go sends GO', c.comments.at(-1).text === 'GO' && !c.needsYou, c);
  await page.goto(BASE + '/#/p/alpha/' + q1.id);
  await page.waitForSelector('.reply');
  check('no Go once answered', (await page.locator('.reply button:has-text("Go")').count()) === 0);
  noErrors(page);
}, true);

def('attach', 'paste or attach files in replies; thumbnails; teams get the paths', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmgACZgYAAAKfEC/tW5j8QAAAAASUVORK5CYII=';
  const c1 = await mkCard(s, 'alpha', 'Paste here'), c2 = await mkCard(s, 'alpha', 'Inbox one');
  check('empty upload refused', (await s.api('POST', '/api/projects/alpha/attachments', { name: 'x.png', data: '' })).status === 400);
  check('unknown attachment is 404', (await s.api('GET', '/api/projects/alpha/attachments/zz-none.png')).status === 404);
  check('path escape refused', [400, 404].includes((await fetch(BASE + '/api/projects/alpha/attachments/..%2F..%2Falpha.json')).status));

  // Card: paste a screenshot, send with no text.
  const page = await openPage(ctx, '#/p/alpha/' + c1.id);
  await page.click('[data-ctab="reply"]');
  await page.waitForSelector('#r-text');
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    const ta = document.getElementById('r-text'); ta.focus();
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.waitForSelector('.reply .att-chip');
  check('pasted screenshot shows as a chip', /screenshot-.*\.png/.test(await page.textContent('.reply .att-chip')));
  await sleep(1500);
  check('chip survives the poll', (await page.locator('.reply .att-chip').count()) === 1);
  // AIG-376: the ✕ stays inside the chip (a long name used to push it out of view)
  check('the chip\'s ✕ is visible inside it', await page.$eval('.reply .att-chip', ch => { const b = ch.querySelector('[data-att-del]').getBoundingClientRect(), c = ch.getBoundingClientRect(); return b.width > 0 && b.right <= c.right + 1; }));
  await page.click('.reply button:has-text("Send reply")');
  await sleep(600);
  let c = await getCard(s, 'alpha', c1.id);
  const att = (c.comments.at(-1).attachments || [])[0] || {};
  check('comment has the attachment with a full path', /screenshot-.*\.png$/.test(att.name || '') && fs.existsSync(att.path || '-') && att.size > 0, c.comments.at(-1));
  const r = await fetch(BASE + '/api/projects/alpha/attachments/' + encodeURIComponent(att.id));
  check('file served as an image', r.ok && r.headers.get('content-type') === 'image/png');
  await page.goto(BASE + '/#/p/alpha/' + c1.id);
  await page.waitForSelector('.att-shown img');
  await page.waitForFunction(() => document.querySelector('.att-shown img').naturalWidth > 0, null, { timeout: 4000 }).catch(() => {});
  check('thumbnail shows in the comment', await page.evaluate(() => document.querySelector('.att-shown img').naturalWidth > 0));
  const sh = s.cli(['show', 'alpha', c1.id]);
  check('show prints the path', sh.out.includes('📎 ' + att.name + ': ' + att.path), sh.out);
  const up = s.cli(['updates', 'alpha']);
  check('updates prints the path', up.out.includes(att.path), up.out);

  // Inbox: attach a file with the picker alongside text.
  s.cli(['ask', 'alpha', c2.id, 'Logs?', '--as', 'Lead']);
  await page.goto(BASE + '/#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${c2.id}"] input[type=file]`, { state: 'attached' });
  await page.setInputFiles(`.ib-item[data-id="${c2.id}"] input[type=file]`, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.fill(`.ib-item[data-id="${c2.id}"] textarea`, 'here you go');
  await page.click(`.ib-item[data-id="${c2.id}"] button[data-act="send"]`);
  await sleep(800);
  c = await getCard(s, 'alpha', c2.id);
  const last = c.comments.at(-1);
  check('inbox reply carries text and file', last.text === 'here you go' && last.attachments && last.attachments[0].name === 'notes.txt', last);

  // Your call: send back with only a screenshot (it counts as the reason).
  const c3 = await mkCard(s, 'alpha', 'To test');
  s.cli(['test', 'alpha', c3.id, '1. look', '--as', 'Lead']);
  await page.goto(BASE + '/#/p/alpha/' + c3.id);
  await page.waitForSelector('.verdict input[type=file]', { state: 'attached' });
  await page.setInputFiles('.verdict input[type=file]', { name: 'bug.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await page.click('.verdict button:has-text("Send back")');
  await sleep(800);
  c = await getCard(s, 'alpha', c3.id);
  check('send back with a screenshot only', c.status === 'team' && c.comments.at(-1).verdict === 'sendback' && c.comments.at(-1).attachments[0].name === 'bug.png', c.comments.at(-1));

  // Inbox task: Done with a file.
  const c4 = await mkCard(s, 'alpha', 'Do a thing');
  s.cli(['task', 'alpha', c4.id, 'run it', '--as', 'Lead']);
  await page.goto(BASE + '/#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${c4.id}"] input[type=file]`, { state: 'attached' });
  await page.setInputFiles(`.ib-item[data-id="${c4.id}"] input[type=file]`, { name: 'out.txt', mimeType: 'text/plain', buffer: Buffer.from('ok') });
  await page.click(`.ib-item[data-id="${c4.id}"] button[data-act="taskdone"]`);
  await sleep(800);
  c = await getCard(s, 'alpha', c4.id);
  check('task Done carries the file', /^✅ Done/.test(c.comments.at(-1).text) && c.comments.at(-1).attachments[0].name === 'out.txt', c.comments.at(-1));

  // Raise bug with a pasted screenshot (AIG-80).
  await page.goto(BASE + '/#/p/alpha');
  await page.click('button:has-text("Raise bug")');
  await page.fill('#dialog input[type=text]', 'Broken thing');
  check('Raise bug is roomy on a big screen (AIG-89)', await page.$eval('#dialog .dialog', d => d.offsetWidth >= 900) && await page.$eval('#f-description', d => d.offsetHeight >= 300));
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    document.querySelector('#dialog input[type=text]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.waitForSelector('#dialog .att-chip');
  // AIG-129: the pasted screenshot shows as a thumbnail; clicking it previews it; Escape closes only the preview.
  await page.click('#dialog .att-thumb');
  await page.waitForSelector('.att-lightbox img');
  check('thumbnail opens a full-size preview', await page.$eval('.att-lightbox img', i => i.naturalWidth > 0));
  await page.keyboard.press('Escape');
  check('Escape closes the preview, not the dialog', (await page.locator('.att-lightbox').count()) === 0 && (await page.locator('#dialog .dialog').count()) === 1);
  // A second paste and two picked files add to the list (AIG-82).
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    document.querySelector('#dialog textarea').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.setInputFiles('#dialog input[type=file]', [{ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }, { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }]);
  check('four attachments pending', (await page.locator('#dialog .att-chip').count()) === 4, await page.locator('#dialog .att-chip').count());
  await page.click('#dialog button[type=submit]');
  await sleep(800);
  const bug = (await s.ok('GET', '/api/projects/alpha')).cards.find(x => x.title === 'Broken thing');
  check('raised bug has all four', bug && bug.attachments && bug.attachments.length === 4 && /screenshot-.*.png$/.test(bug.attachments[0].name), bug);
  check('show prints the bug screenshot path', s.cli(['show', 'alpha', bug.id]).out.includes(bug.attachments[0].path));
  await page.goto(BASE + '/#/p/alpha/' + bug.id);
  await page.click('[data-ctab="details"]');
  await page.waitForSelector('[data-pane="details"] .att-shown img');
  check('all four show under the description', (await page.locator('[data-pane="details"] .att-shown img').count()) === 4);
  noErrors(page);
}, true);

def('refresh', 'a new build shows a 🆕 Refresh pill above an open card; it asks before losing an unsent reply', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Typing here');
  let build = 'one';
  const page = await ctx.newPage();
  await page.route('**/api/meta', async r => { try { const res = await r.fetch(); await r.fulfill({ response: res, json: { ...(await res.json()), dev: true, build } }); } catch {} });
  await page.goto(BASE + '/#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  await page.fill('#r-text', 'half a sentence');
  build = 'two';
  await page.waitForSelector('#updateTop button', { timeout: 8000 });
  check('Refresh pill shows, no pop-up', (await page.textContent('#updateTop')).includes('Refresh') && (await page.locator('.overlay.center').count()) === 0);
  check('typing untouched', (await page.inputValue('#r-text')) === 'half a sentence');
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.click('#updateTop button');
  await sleep(300);
  check('asks before losing the reply, and stays when cancelled', /unsent reply/.test(asked) && (await page.inputValue('#r-text')) === 'half a sentence', asked);
  await page.fill('#r-text', '');
  await Promise.all([page.waitForEvent('load'), page.click('#upRefresh button')]);
  check('reloads straight away with nothing unsent', true);
  // Desktop app: its Restart pill replaces Refresh, since a restart reloads too (AIG-83, AIG-130), and asks first.
  await page.waitForSelector('#r-text').catch(() => page.click('[data-ctab="reply"]'));
  await page.fill('#r-text', 'another half');
  build = 'three';
  await page.waitForSelector('#upRefresh button', { timeout: 8000 });
  await page.evaluate(() => window.showRestartApp());
  check('Restart app shows and Refresh hides', (await page.textContent('#upRestart')).includes('Restart app') && !(await page.isVisible('#upRefresh button')));
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.click('#upRestart button');
  await sleep(300);
  check('Restart asks before losing the reply', /Restart anyway/.test(asked) && (await page.inputValue('#r-text')) === 'another half', asked);
}, true);

def('drafts', 'unsent text survives a reload; sending clears it (AIG-171)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Talk about it');
  await say(s, 'alpha', c.id, 'Lead', 'what do you think?');
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  await page.type('#r-text', 'half a thought');
  await page.reload();
  await page.click('[data-ctab="reply"]');
  await page.waitForSelector('#r-text');
  await page.waitForFunction(() => document.getElementById('r-text').value === 'half a thought', null, { timeout: 4000 }).catch(() => {});
  check('reply text is back after a reload', (await page.inputValue('#r-text')) === 'half a thought');
  await page.press('#r-text', 'Enter');
  await sleep(600);
  await page.goto(BASE + '/#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  await page.waitForSelector('#r-text');
  await sleep(300);
  check('sent text does not come back', (await page.inputValue('#r-text')) === '' && (await getCard(s, 'alpha', c.id)).comments.at(-1).text === 'half a thought');
  noErrors(page);
}, true);

def('openit', '▶ Open it: starts the app with the card\'s command if needed, waits, opens the page (AIG-146)', async (s, ctx) => {
  const folder = tmp('openit'), port = await freePort();
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  const c = await mkCard(s, 'alpha', 'Settings page');
  // A tiny app that answers on its port and quits by itself after 20s.
  const start = `node -e "require('http').createServer((q,r)=>r.end('app here')).listen(${port}); setTimeout(()=>process.exit(),20000)"`;
  const t = s.cli(['test', 'alpha', c.id, '1. look', '--as', 'Lead', '--open', `http://127.0.0.1:${port}/settings`, '--start', start]);
  check('test --open stores the address and command', t.code === 0 && (await getCard(s, 'alpha', c.id)).openUrl === `http://127.0.0.1:${port}/settings`, t);
  check('a bad address is refused', (await s.api('PATCH', `/api/projects/alpha/cards/${c.id}`, { openUrl: 'javascript:alert(1)' })).status === 400);
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('button:has-text("Open it")');
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  const [opened] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), page.click('button:has-text("Open it")')]);
  check('asks before running the start command', asked.includes('createServer'), asked);
  await opened.waitForLoadState().catch(() => {});
  check('opens the page once the app answers', opened.url() === `http://127.0.0.1:${port}/settings` && (await opened.textContent('body')).includes('app here'), opened.url());
  await page.goto(BASE + '/#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${c.id}"] button[data-act="open"]`);
  check('the inbox test item has the button too', true);
}, true);

def('testnotes', 'the Test tab shows the team\'s notes since your last word, next to Accept (AIG-152)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Security pass');
  await say(s, 'alpha', c.id, 'Owner', 'please check it all');
  await say(s, 'alpha', c.id, 'Lead', 'Scanned everything: nothing personal found; fixed one gap');
  s.cli(['test', 'alpha', c.id, '- Nothing to click: read the note above and accept', '--as', 'Lead']);
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('[data-pane="test"]');
  const pane = await page.textContent('[data-pane="test"]');
  check('team note shows on the Test tab', pane.includes('From the team') && pane.includes('nothing personal found'), pane.slice(0, 300));
  check('your own older comment and the auto line are left out', !pane.includes('please check it all') && !pane.includes('Ready for you to test.'));
  noErrors(page);
}, true);

def('editor', '📝 file paths in card text open in your editor (AIG-156)', async (s, ctx) => {
  const dir = process.env.QA_EDITOR_DIR, target = path.join(dir, 'settings.json'), rec = path.join(dir, 'opened.txt');
  fs.writeFileSync(target, '{}');
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Edit a file', { description: 'Open `' + target + '` and add a line\n\n```\n' + target + '\n```' });
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.click('[data-ctab="details"]');
  await page.waitForSelector('[data-editor]');
  check('a 📝 button after the path in code and in the code box', (await page.locator('[data-editor]').count()) === 2);
  await page.locator('[data-editor]').first().click();
  for (let i = 0; i < 20 && !fs.existsSync(rec); i++) await sleep(250);
  check('it opens the file with your editor', fs.existsSync(rec) && fs.readFileSync(rec, 'utf8').includes('settings.json'));
  check('a missing file is refused', (await s.api('POST', '/api/open-file', { path: path.join(dir, 'nope.txt') })).status === 404);
  check('paths with shell characters are refused', (await s.api('POST', '/api/open-file', { path: dir + '/a%PATH%.txt' })).status === 400);
  noErrors(page);
}, true, (() => {
  // A stand-in editor that just records which file it was asked to open.
  const dir = tmp('editor'), script = path.join(dir, 'rec.js');
  fs.writeFileSync(script, `require('fs').writeFileSync(${JSON.stringify(path.join(dir, 'opened.txt'))}, process.argv[2] || '')`);
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify({ ...(() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'aigile.local.json'), 'utf8')); } catch { return {}; } })(), editor: `node "${script}"` }));
  process.env.QA_EDITOR_DIR = dir;
  return { AIGILE_LOCAL: path.join(dir, 'local.json') };
})());

def('pagelink', '🌐 a local .html path opens in the browser, not the editor (AIG-294)', async (s, ctx) => {
  const dir = tmp('pagelink'), page = path.join(dir, 'index.html').replace(/\\/g, '/');
  fs.writeFileSync(page, '<p>hi</p>');
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Look at the site', { description: 'Open `' + page + '` in your browser' });
  const pg = await openPage(ctx, '#/p/alpha/' + c.id);
  await pg.click('[data-ctab="details"]');
  await pg.waitForSelector('[data-editor]');
  check('the page gets a 🌐 button', (await pg.textContent('[data-editor]')).trim() === '🌐');
  check('it opens in the browser', (await s.ok('POST', '/api/open-file', { path: page })).with === 'browser');
  noErrors(pg);
}, true, { AIGILE_NO_WINDOWS: '1' });

def('testorder', 'Test tab: newest note right under the reply box; a replaced tester check is faded (AIG-186)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Saved views');
  s.cli(['test', 'alpha', c.id, 'save a view', '--as', 'Lead']);
  s.cli(['comment', 'alpha', c.id, '🤖 Failed: could not find Views', '--as', 'Tester']);
  s.cli(['comment', 'alpha', c.id, 'Ignore that, it works', '--as', 'Lead']);
  s.cli(['comment', 'alpha', c.id, '🤖 Passed: saved and reopened My bugs', '--as', 'Tester']);
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('[data-pane="test"] .comment');
  const first = await page.textContent('[data-pane="test"] .comment');
  check('the newest note comes first', /Passed: saved/.test(first), first);
  check('the replaced check is faded and labelled', /Failed: could not/.test(await page.textContent('[data-pane="test"] .stale')) && (await page.locator('[data-pane="test"] .stale').count()) === 1);
  noErrors(page);
}, true);

def('steady', 'an open card stays put while the board polls, also with a team sitting in aigile wait (AIG-310)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Tested by the AI', { status: 'verify', testSteps: '- Open Setup\n- Pick Nederlands' });
  await say(s, 'alpha', c.id, 'Lead', 'Folded in ALP-9');
  await say(s, 'alpha', c.id, 'Lead', 'OK: parked the rest');
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmgACZgYAAAKfEC/tW5j8QAAAAASUVORK5CYII=';
  const shot = await s.ok('POST', '/api/projects/alpha/attachments', { name: 'shot.png', type: 'image/png', data: PNG });
  await s.ok('POST', `/api/projects/alpha/cards/${c.id}/aicheck`, { result: 'pass', note: 'Saw it in Dutch', by: 'Tester', attachments: [shot] });
  await s.ok('GET', '/api/projects/alpha/updates?wait=1');   // the team sits in 'aigile wait': presence.waitingMs ticks on each request
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('#modal .panel .ai-ev img');
  await sleep(1200);
  const mark = () => page.evaluate(() => { const p = document.querySelector('#modal .panel'); p.dataset.qaMark = '1'; return p.innerHTML; });
  const still = () => page.evaluate(() => { const p = document.querySelector('#modal .panel'); return { same: !!p && p.dataset.qaMark === '1', html: p && p.innerHTML }; });
  let html = await mark(); await sleep(3200); let now = await still();
  check('open card is not rebuilt over 3s of polling while the team waits', now.same && now.html === html, now.same);
  // Something else on the board changes: the board redraws, the open card does not.
  html = await mark();
  await mkCard(s, 'alpha', 'Elsewhere on the board');
  await page.waitForFunction(() => document.querySelector('#app').textContent.includes('Elsewhere on the board'), null, { timeout: 5000 });
  now = await still();
  check('a change elsewhere on the board leaves the open card alone', now.same && now.html === html, now.same);
  // A new word on this card does redraw it.
  await say(s, 'alpha', c.id, 'Lead', 'One more thing');
  const shows = await page.waitForFunction(() => document.querySelector('#modal .panel').textContent.includes('One more thing'), null, { timeout: 5000 }).then(() => true, () => false);
  check('a new comment on the open card still shows', shows);
  // AIG-314: with the reply box focused and half typed, a new team comment still shows within 2s and the draft stays.
  await page.click('[data-ctab="reply"]');
  await page.fill('#r-text', 'half a reply');
  await page.focus('#r-text');
  const t0 = Date.now();
  await say(s, 'alpha', c.id, 'Lead', 'Live under a draft');
  const live = await page.waitForFunction(() => document.querySelector('#modal .panel').textContent.includes('Live under a draft'), null, { timeout: 2500 }).then(() => true, () => false);
  check('a new comment shows within 2s while a reply is half typed', live, Date.now() - t0);
  check('the draft is kept and still focused', (await page.inputValue('#r-text')) === 'half a reply' && await page.evaluate(() => document.activeElement && document.activeElement.id === 'r-text'));
  check('the tab count follows the new comment', /\d/.test(await page.textContent('[data-ctab="reply"]')));
  noErrors(page);
}, true);
