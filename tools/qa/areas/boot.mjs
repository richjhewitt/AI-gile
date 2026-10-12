// QA area: boot (AIG-517): the page survives a bad load (a half-written script, a 503 mid-update, a failed language file or
// first API call) by showing "Updating… retrying" and trying again with backoff; render() throwing shows a note with Reload;
// the server answers 503 for a page file with a git conflict marker.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, check, sleep, openPage, def } from '../lib.mjs';

def('boot', '⏳ start-up survives a bad load: broken or 503 script, failed language file or first API call retry and come up, backoff never faster than 1s/2s/4s, render() throwing shows a Reload note, conflict-marked page files answer 503 (AIG-517)', async (s, ctx) => {
  // Review fix: each script and stylesheet is in index.html once (a script loaded twice wires its handlers twice).
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'), refs = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map(m => m[1]);
  check('index.html loads every script and stylesheet once', refs.length === new Set(refs).size, refs.filter((r, i) => refs.indexOf(r) !== i));
  // Server: a page file with a conflict marker line is 503 + Retry-After 2 until it is fixed (checked again once it changes).
  const name = 'qa-conflict-' + process.pid, js = path.join(ROOT, 'public', 'js', name + '.js'), css = path.join(ROOT, 'public', 'css', name + '.css');
  try {
    fs.writeFileSync(js, 'const a = 1;\n<<<<<<< HEAD\nconst b = 2;\n=======\nconst b = 3;\n>>>>>>> other\n');
    fs.writeFileSync(css, 'body { color: red; }\r\n<<<<<<< HEAD\r\na {}\r\n=======\r\nb {}\r\n>>>>>>> theirs\r\n');
    let r = await fetch(BASE + '/js/' + name + '.js');
    check('a script with a conflict marker answers 503 with Retry-After: 2', r.status === 503 && r.headers.get('retry-after') === '2', [r.status, r.headers.get('retry-after')]);
    check('... and is never sent', !(await r.text()).includes('const b'));
    r = await fetch(BASE + '/css/' + name + '.css');
    check('a stylesheet with a conflict marker (CRLF) answers 503 too', r.status === 503, r.status);
    fs.writeFileSync(js, 'const a = 1;\nconst b = 2;   // fixed\n');
    r = await fetch(BASE + '/js/' + name + '.js');
    check('once the file is fixed it is served again', r.status === 200 && (await r.text()).includes('// fixed'), r.status);
    fs.writeFileSync(js, "const s = 'x <<<<<<< y';\n");
    check('a marker in the middle of a line is not one', (await fetch(BASE + '/js/' + name + '.js')).status === 200);
    check('the real page files are served as usual', (await fetch(BASE + '/js/app.js')).status === 200 && (await fetch(BASE + '/lang/en.json')).status === 200 && (await fetch(BASE + '/')).status === 200);
  } finally { for (const f of [js, css]) try { fs.unlinkSync(f); } catch {} }

  // Page: a load where the first `times` answers for `pattern` are bad (bad(route)), then the real thing.
  // Service workers off, so every request goes through page.route (public/sw.js passes a 503 or a broken file straight on).
  const bctx = await ctx.browser().newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
  const boot = async (pattern, bad, times, upMs = 15000) => {
    const page = await bctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    const r = { page, n: 0 };
    await page.route(pattern, x => (++r.n <= times ? bad(x) : x.continue()));
    const t0 = Date.now();
    await page.goto(BASE + '/#/');
    r.note = await page.waitForSelector('#app .boot-note', { timeout: 6000 }).then(() => true, () => false);
    r.noteText = r.note ? await page.textContent('#app .boot-note').catch(() => '') : '';
    for (const end = Date.now() + upMs; r.n <= times && Date.now() < end;) await sleep(100);   // the retry asked again
    r.up = await page.waitForSelector('#app .toolbar', { timeout: upMs }).then(() => true, () => false);
    r.ms = Date.now() - t0;
    r.tries = await page.evaluate(() => sessionStorage.getItem('aigile.bootTry')).catch(() => '?');
    return r;
  };
  const broken = x => x.fulfill({ contentType: 'text/javascript', body: 'function half( {\n<<<<<<< HEAD\n' });
  const unavailable = x => x.fulfill({ status: 503, headers: { 'Retry-After': '2' }, contentType: 'text/plain', body: 'mid-update' });

  let r = await boot('**/js/board.js', broken, 1);
  check('a script that fails to parse shows "Updating… retrying" instead of a blank page', r.note && r.noteText.includes('⏳'), r.noteText);
  check('... then reloads and the board comes up', r.up && r.n >= 2, [r.up, r.n, r.ms]);
  check('... and the retry count is cleared once it is up', r.tries === null, r.tries);
  await r.page.close();

  r = await boot('**/js/format.js', unavailable, 1);
  check('a script answered 503 mid-update shows the note, then the board comes up', r.note && r.up && r.n >= 2, [r.note, r.up, r.n]);
  await r.page.close();

  r = await boot('**/lang/en.json', unavailable, 1);
  check('a language file that fails shows the note, then the board comes up in English', r.note && r.up && r.n >= 2 && (await r.page.evaluate(() => t('live.ok'))) === 'live', [r.note, r.up, r.n]);
  await r.page.close();

  r = await boot('**/api/meta', x => x.abort('connectionrefused'), 1);
  check('a first API call that fails (server restarting) shows the note, then the board comes up', r.note && r.up, [r.note, r.up, r.n]);
  await r.page.close();

  // Backoff: a script that stays broken is reloaded after 1s, then 2s (never faster), and the page still comes up once it is fixed.
  {
    const page = await bctx.newPage(); let n = 0, bad = true;
    await page.route('**/js/board.js', x => { n++; return bad ? broken(x) : x.continue(); });
    await page.goto(BASE + '/#/');
    await sleep(3600);
    check('a script that stays broken is retried with backoff, not in a tight loop (2 or 3 loads in 3.6s)', n >= 2 && n <= 3, n);
    check('... the note shows meanwhile', (await page.locator('#app .boot-note').count()) === 1);
    bad = false;
    check('... and the board comes up once the file is whole again', await page.waitForSelector('#app .toolbar', { timeout: 15000 }).then(() => true, () => false), n);
    await page.close();
  }
  await bctx.close();

  // Run time: render() throwing shows a note with Reload (and logs the error) instead of an empty or half-drawn page.
  const page = await openPage(ctx, '#/');
  check('a normal start shows no note and keeps no retry count', (await page.locator('.boot-note').count()) === 0 && (await page.evaluate(() => sessionStorage.getItem('aigile.bootTry'))) === null);
  await page.evaluate(() => { window.qaRenderHome = renderHome; renderHome = () => { throw new Error('qa render boom'); }; refresh(true); });
  await page.waitForSelector('#app .render-note', { timeout: 5000 }).catch(() => {});
  const note = await page.evaluate(() => { const n = document.querySelector('#app .render-note'); return n && { text: n.textContent, btn: (n.querySelector('button') || {}).textContent }; });
  check('render() throwing shows the error note with a Reload button', note && note.text.includes('qa render boom') && note.btn === '🔄 Reload', note);
  check('... and logs the error to the console', page.errors.some(e => e.includes('qa render boom')), page.errors);
  await sleep(1500);
  check('... the note stays while render keeps failing', (await page.locator('#app .render-note').count()) === 1);
  await page.evaluate(() => { renderHome = window.qaRenderHome; refresh(true); });
  check('once render works again the page comes back', await page.waitForSelector('#app .toolbar', { timeout: 5000 }).then(() => true, () => false) && (await page.locator('#app .render-note').count()) === 0);
  await page.close();
}, true);
