// QA area: terminal (AIG-471), the built-in terminal on 🖥️ server tasks.
// AIGILE_TERM_LOCAL: the board opens a LOCAL shell (cmd.exe /v:on here, sh elsewhere) instead of ssh, so a test never
// connects anywhere. node-pty must be installed in the AI-gile folder (npm install); xterm.js comes from jsDelivr.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { check, sleep, tmp, until, mkProject, mkCard, openPage, noErrors, def, ROOT, PORT } from '../lib.mjs';

const win = process.platform === 'win32';
const FAIL = win ? 'cmd /c exit 3' : 'sh -c "exit 3"';
// A raw request, so the test can send headers fetch won't (Host, Sec-Fetch-Site).
const raw = (method, url, headers = {}, body) => new Promise(res => {
  const r = http.request({ host: '127.0.0.1', port: PORT, method, path: url, headers: { 'Content-Type': 'application/json', ...headers } }, x => { let s = ''; x.on('data', d => s += d); x.on('end', () => res({ status: x.statusCode, body: s })); });
  r.on('error', e => res({ status: 0, body: e.message })); if (body) r.write(JSON.stringify(body)); r.end();
});
const rows = page => page.evaluate(() => [...document.querySelectorAll('#termDock .xterm-rows > div')].map(r => r.textContent.replace(/\u00a0/g, ' ').trim()));
const runText = page => page.evaluate(() => (document.querySelector('#termDock .term-run') || {}).textContent || '');

def('terminal', '⌨ terminal on server tasks: ssh servers in Setup, the panel shows echo output, ▶ Run this / Run all stops on error, termlog, token + loopback fence (AIG-471), local shell only', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const local = path.join(s.dir, 'aigile.local.json');

  // 1. Setup: a server with an ssh address, added on the page
  const setup = await openPage(ctx, '#/setup');
  await setup.waitForSelector('#serversBox');
  await setup.click('#serversBox button:has-text("Add a server")');
  await setup.fill('#serversBox input[data-srv="name"]', 'QA Box');
  await setup.dispatchEvent('#serversBox input[data-srv="name"]', 'change');
  await Promise.all([setup.waitForResponse(r => r.url().endsWith('/api/setup') && r.request().method() === 'POST'), setup.selectOption('#serversBox select[data-srv="kind"]', 'ssh')]);
  await sleep(200);   // the box is drawn again after each save
  check('the ssh kind shows host and user boxes (AIG-773)', (await setup.getAttribute('#serversBox input[data-srv="host"]', 'placeholder')) === 'Host (name or IP)' && !!(await setup.$('#serversBox input[data-srv="user"]')));
  await setup.fill('#serversBox input[data-srv="user"]', 'qa');
  await setup.dispatchEvent('#serversBox input[data-srv="user"]', 'change');
  await sleep(500);
  await setup.fill('#serversBox input[data-srv="host"]', '127.0.0.1');
  await setup.dispatchEvent('#serversBox input[data-srv="host"]', 'change');
  const saved = await until(() => { try { const v = JSON.parse(fs.readFileSync(local, 'utf8')).servers; return v && v[0] && v[0].value === 'qa@127.0.0.1' && v; } catch { return null; } }, 5000);
  check('Setup saves name, kind ssh and the address', saved && saved[0].name === 'QA Box' && saved[0].kind === 'ssh', saved);
  check('an address that could be an ssh option is refused', (await s.api('POST', '/api/setup', { prefs: { servers: [{ name: 'x', kind: 'ssh', value: '-oProxyCommand=calc' }] } })).status === 400);
  check('/api/meta lists it as a terminal server', ((await s.ok('GET', '/api/meta')).terms || []).includes('QA Box'));
  noErrors(setup);

  // 2. The fence
  const tk = await s.ok('GET', '/api/terminal/token');
  check('the page gets a token and the terminal is available', /^[0-9a-f]{48}$/.test(tk.token) && tk.available === true, tk);
  check('the CLI or a hook gets no token', (await raw('GET', '/api/terminal/token', { 'X-Aigile-Where': 'terminal' })).status === 403);
  check('another site gets no token', (await raw('GET', '/api/terminal/token', { 'Sec-Fetch-Site': 'cross-site' })).status === 403);
  check('another host name is refused', (await raw('GET', '/api/terminal/token', { Host: 'evil.example:' + PORT })).status === 403);
  const task = await mkCard(s, 'alpha', 'Restart the service', { description: 'One:\n```\necho one-liner-ok\n```\nThe block:\n```\necho step-1\n' + FAIL + '\necho step-3\n```' });
  s.cli(['task', 'alpha', task.id, 'run these on the server', '--server', '--as', 'Lead']);
  check('open without a token is refused', (await s.api('POST', '/api/terminal/open', { slug: 'alpha', id: task.id, name: 'QA Box' })).status === 403);
  check('open with a wrong token is refused', (await s.api('POST', '/api/terminal/open', { token: 'f'.repeat(48), slug: 'alpha', id: task.id, name: 'QA Box' })).status === 403);
  check('the output stream without a token is refused', (await raw('GET', `/api/terminal/alpha/${task.id}/stream`)).status === 403);
  const plain = await mkCard(s, 'alpha', 'Not a server task');
  check('a card that is not a server task gets no terminal', (await s.api('POST', '/api/terminal/open', { token: tk.token, slug: 'alpha', id: plain.id, name: 'QA Box' })).status === 400);
  check('a server name that is not saved gets no terminal', (await s.api('POST', '/api/terminal/open', { token: tk.token, slug: 'alpha', id: task.id, name: 'C:/Windows/System32/cmd.exe' })).status === 404);
  // Loopback and the off switch: the module itself, with a request from another address (temp data folder, nothing written).
  const sandbox = tmp('term-unit'), env = { ...process.env };
  process.env.AIGILE_DATA = path.join(sandbox, 'data'); process.env.AIGILE_LOCAL = path.join(sandbox, 'local.json');
  const T = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'terminal.js'));
  const refuses = req => { try { T.token(req); return false; } catch (e) { return e.status === 403 || e.code === 403; } };
  check('a request from another computer is refused', refuses({ socket: { remoteAddress: '192.168.1.20' }, headers: {} }));
  check('the same request from this computer is not', !refuses({ socket: { remoteAddress: '127.0.0.1' }, headers: {} }));
  process.env.AIGILE_NO_TERMINAL = '1';
  check('AIGILE_NO_TERMINAL turns it off', refuses({ socket: { remoteAddress: '127.0.0.1' }, headers: {} }));
  Object.assign(process.env, env); delete process.env.AIGILE_NO_TERMINAL; if (!env.AIGILE_DATA) delete process.env.AIGILE_DATA; if (!env.AIGILE_LOCAL) delete process.env.AIGILE_LOCAL;
  const src = f => fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8');
  check('the trial board and the pretend friend start with the terminal off', /AIGILE_NO_TERMINAL: '1'/.test(src('trial.js')) && /AIGILE_NO_TERMINAL: '1'/.test(src('pretend.js')));

  // 3. The panel: ⌨ Terminal opens it connected; typing echo hi shows hi
  const page = await openPage(ctx, `#/p/alpha/${task.id}`);
  await page.waitForSelector('.panel [data-term-open]');
  await page.click('.panel button[data-ctab="details"]');
  await page.waitForSelector('.panel .codebox.runs');
  check('nothing ran before a click', !(await s.ok('GET', `/api/projects/alpha/cards/${task.id}/termlog`)).text.includes('one-liner-ok'));
  await page.click('.panel [data-term-open]');
  await page.waitForSelector('#termDock .xterm-rows', { timeout: 15000 });
  await page.waitForFunction(() => /connected/.test(document.querySelector('#termDock .term-state').textContent) && !/not/.test(document.querySelector('#termDock .term-state').textContent), null, { timeout: 10000 });
  await sleep(800);   // the shell's first prompt
  await page.click('#termDock .xterm');
  await page.keyboard.type('echo hi'); await page.keyboard.press('Enter');
  check('the panel shows the output of echo hi', !!(await until(async () => (await rows(page)).includes('hi'), 8000)), await rows(page));

  // 4. ▶ Run this: the first run on the card asks first
  await page.click('.codebox.runs >> nth=0 >> button[data-run="this"]');
  await page.waitForSelector('#dialog #termYes', { timeout: 4000 });
  check('the first run on a card asks first, showing the command', /echo one-liner-ok/.test(await page.textContent('#dialog .term-confirm')));
  await page.click('#termYes');
  check('Run this types and runs the command', !!(await until(async () => (await rows(page)).includes('one-liner-ok'), 8000)), await rows(page));
  check('the dock says it is done', !!(await until(async () => /done/.test(await runText(page)), 5000)), await runText(page));

  // ▶ Run all: line by line, stops at the line that fails, no second question
  await page.click('.codebox.runs >> nth=1 >> button[data-run="all"]');
  await sleep(300);
  check('no second question on the same card', !(await page.$('#dialog #termYes')));
  check('Run all stops at the failing line', !!(await until(async () => /stopped/.test(await runText(page)), 10000)), await runText(page));
  const r = await rows(page);
  check('the line before ran, the line after did not', r.includes('step-1') && !r.some(x => /step-3/.test(x)), r);
  check('the lines get ✓ and ✗', (await page.$$('.codebox.runs >> nth=1 >> .cl.ok')).length === 1 && (await page.$$('.codebox.runs >> nth=1 >> .cl.fail')).length === 1);
  // ▶ Run next: the lit-up line runs, then the next one lights up
  check('Run next starts on the first line', (await page.getAttribute('.codebox.runs >> nth=1 >> .cl.next', 'data-i')) === '0');
  await page.click('.codebox.runs >> nth=1 >> button[data-run="next"]');
  await until(async () => /done/.test(await runText(page)), 6000);
  check('after Run next the second line is lit up', (await until(() => page.getAttribute('.codebox.runs >> nth=1 >> .cl.next', 'data-i').then(v => v === '1'), 4000)) === true);
  // The board checks too: a direct run on another card without confirm only asks
  const t2 = await mkCard(s, 'alpha', 'Another job', { server: true });
  await s.ok('POST', '/api/terminal/open', { token: tk.token, slug: 'alpha', id: t2.id, name: 'QA Box' });
  const ask = await s.ok('POST', `/api/terminal/alpha/${t2.id}/run`, { token: tk.token, lines: ['echo should-not-run'] });
  check('the board itself asks before the first run on a card', ask.needConfirm === true);
  await s.ok('POST', `/api/terminal/alpha/${t2.id}/close`, { token: tk.token });

  // 5. termlog: plain text for the lead
  await sleep(700);
  const log = s.cli(['termlog', 'alpha', task.id]);
  check('aigile termlog shows the output', log.code === 0 && /\bhi\b/.test(log.out) && /one-liner-ok/.test(log.out) && /step-1/.test(log.out), log.out.slice(-600) + log.err);
  check('termlog has no escape codes', !/\x1b/.test(log.out));
  check('termlog says where the block stopped', /stopped: ".*exit 3" exited with 3/.test(log.out), log.out.slice(-400));
  check('termlog --tail limits the lines', s.cli(['termlog', 'alpha', task.id, '--tail', '3']).out.split('\n').length <= 5);

  // 6. ⧉ Pop out: the same terminal in its own window
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#termDock .term-pop')]);
  await pop.waitForSelector('#termDock .xterm-rows', { timeout: 15000 });
  check('the pop-out is a terminal window', await pop.evaluate(() => document.body.classList.contains('popterm')));
  check('the pop-out shows what the terminal had', !!(await until(async () => (await rows(pop)).includes('one-liner-ok'), 8000)), await rows(pop));
  check('the dock left the main window', !(await page.$('#termDock')));
  await pop.click('#termDock .term-x').catch(() => {});
  await sleep(500);
  check('closing ends the session', (await s.ok('GET', `/api/projects/alpha/cards/${task.id}/termlog`)).open === false);
  noErrors(page);
}, true, { AIGILE_TERM_LOCAL: '1' });
