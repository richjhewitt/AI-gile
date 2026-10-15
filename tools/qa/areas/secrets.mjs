// QA area: secrets (AIG-585..587, lib/secrets.js): an agent asks for a named secret on a card, the owner pastes it into the masked box,
// `aigile secret run` hands it to a child as an env var with the output masked, one-time by default; the value is nowhere on disk or
// in any API answer; Setup > Secrets lists names only with Delete now and the auto-delete time.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, BASE, check, tmp, until, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

const SECDIR = tmp('secrets');
const VALUE = 'hunter2-QA-S3cr3t-Value';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

def('secrets', '🔑 ask for a secret on a card, paste it in the masked box, run a command with it (output masked, one-time), nowhere on disk or in the API, Setup list with Delete now and auto-delete (AIG-585..587)', async (s, ctx) => {
  await mkProject(s, 'Vault', 'VLT');
  const card = await mkCard(s, 'vault', 'Deploy the thing', { type: 'task' });
  const cli = (...a) => s.cli(a);

  // Ask (AIG-585)
  check('a bad name is refused', cli('secret', 'ask', 'vault', card.id, 'lower', 'why', '--as', 'Forge').code !== 0);
  const ask = cli('secret', 'ask', 'vault', card.id, 'QA_TOKEN', 'to call the deploy API', '--as', 'Forge');
  check('ask says it asked', ask.code === 0 && /Asked the owner for QA_TOKEN/.test(ask.out), ask);
  let c = (await s.ok('GET', '/api/projects/vault')).cards.find(x => x.id === card.id);
  check('the card carries the ask (name and reason only) and needs the owner', c.secretAsks.length === 1 && c.secretAsks[0].name === 'QA_TOKEN' && c.secretAsks[0].have === false && c.needsYou, c.secretAsks);
  check('running before it is stored is refused', cli('secret', 'run', 'vault', 'QA_TOKEN', '--', process.execPath, '-e', '1').code !== 0);

  // The fence
  const tokRes = await fetch(BASE + '/api/secrets/token', { headers: { 'X-Aigile-Where': 'terminal' } });
  check('the CLI is refused the page token', tokRes.status === 403);
  const noTok = await s.api('POST', '/api/secrets/save', { slug: 'vault', name: 'QA_TOKEN', value: VALUE });
  check('saving without the page token is refused', noTok.status === 403);
  check('the grant route refuses a caller that is not the CLI', (await fetch(BASE + '/api/secrets/grant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'vault', name: 'QA_TOKEN' }) })).status === 403);

  // Paste through the page (masked box)
  const page = await openPage(ctx, '#/p/vault/' + card.id);
  await page.waitForSelector('#sec-box');
  check('the card shows the ask and a masked box', (await page.getAttribute('#sec-in-QA_TOKEN', 'type')) === 'password' && /deploy API/.test(await page.textContent('#sec-box')));
  await page.fill('#sec-in-QA_TOKEN', VALUE);
  await page.click('#sec-box button:has-text("Save")');
  await page.waitForSelector('#sec-box .sec-have');
  check('after Save the box says stored and the value is gone from the page', !(await page.content()).includes(VALUE) && !(await page.$('#sec-in-QA_TOKEN')));
  c = (await s.ok('GET', '/api/projects/vault')).cards.find(x => x.id === card.id);
  check('the card now says it has the secret', c.secretAsks[0].have === true);

  // Nowhere: API answers and files
  const answers = JSON.stringify([await s.ok('GET', '/api/secrets'), await s.ok('GET', '/api/projects/vault')]);
  check('no API answer holds the value', !answers.includes(VALUE));
  const store = walk(SECDIR).find(f => f.endsWith('store.json'));
  check('the value is stored encrypted in a file under secrets/', store && fs.readFileSync(store, 'utf8').includes('"aes:') && !fs.readFileSync(store, 'utf8').includes(VALUE));

  // Run (AIG-586)
  const code = "console.log('env=' + process.env.QA_TOKEN); console.error('err=' + process.env.QA_TOKEN); console.log('b64=' + Buffer.from(process.env.QA_TOKEN).toString('base64')); console.log('len=' + process.env.QA_TOKEN.length)";
  const run = cli('secret', 'run', 'vault', 'QA_TOKEN', '--as', 'Forge', '--', process.execPath, '-e', code);
  check('the command ran with the value in its env (length matches)', run.code === 0 && run.out.includes('len=' + VALUE.length), run);
  check('stdout and stderr show **** instead of the value', run.out.includes('env=****') && run.err.includes('err=****') && !run.out.includes(VALUE) && !run.err.includes(VALUE), run);
  check('the base64 form is masked too', run.out.includes('b64=****') && !run.out.includes(Buffer.from(VALUE).toString('base64')), run.out);
  const again = cli('secret', 'run', 'vault', 'QA_TOKEN', '--', process.execPath, '-e', '1');
  check('one-time: it is gone after the run', again.code !== 0 && /not stored/.test(again.err), again);
  check('the card goes back to asking', (await s.ok('GET', '/api/projects/vault')).cards.find(x => x.id === card.id).secretAsks[0].have === false);
  check('no grant file is left behind', !fs.existsSync(path.join(SECDIR, 'secrets', 'grants')) || fs.readdirSync(path.join(SECDIR, 'secrets', 'grants')).length === 0);

  // --keep, Setup list, Delete now, auto-delete (AIG-587)
  cli('secret', 'ask', 'vault', card.id, 'KEEP_ME', 'a kept one', '--as', 'Forge');
  await page.reload(); await page.waitForSelector('#sec-in-KEEP_ME');
  await page.fill('#sec-in-KEEP_ME', VALUE + '-keep'); await page.click('[data-secret="KEEP_ME"] button:has-text("Save")');
  await page.waitForSelector('[data-secret="KEEP_ME"] .sec-have');
  const k1 = cli('secret', 'run', 'vault', 'KEEP_ME', '--keep', '--as', 'Forge', '--', process.execPath, '-e', "console.log(process.env.KEEP_ME)");
  check('--keep: output masked and the secret stays', k1.code === 0 && k1.out === '****', k1);
  const l = await s.ok('GET', '/api/secrets');
  const kept = l.items.find(x => x.name === 'KEEP_ME');
  check('the list has names, card, stored, last used and by whom, no value', kept && kept.stored && kept.lastUsedBy === 'Forge' && kept.lastUsedAt && !JSON.stringify(l).includes(VALUE) && l.hours === 24, kept);
  await page.goto(`${BASE}/#/setup`); await page.reload();
  await page.waitForSelector('#secretsBox tr[data-secret="KEEP_ME"]');
  const row = await page.textContent('#secretsBox tr[data-secret="KEEP_ME"]');
  check('Setup > Secrets shows the name, card and who used it, never the value', /KEEP_ME/.test(row) && row.includes(card.id) && /Forge/.test(row) && !(await page.content()).includes(VALUE));
  check('the auto-delete time defaults to 24 hours', (await page.inputValue('#sec-hours')) === '24');
  await page.selectOption('#sec-hours', '1');
  await until(async () => (await s.ok('GET', '/api/secrets')).hours === 1);
  // Make it older than the hour: stored 2 hours ago, then the next listing purges it.
  const f = walk(SECDIR).find(x => x.endsWith('store.json')), st = JSON.parse(fs.readFileSync(f, 'utf8'));
  st.items.find(x => x.name === 'KEEP_ME').storedAt = new Date(Date.now() - 2 * 3600e3).toISOString(); fs.writeFileSync(f, JSON.stringify(st));
  check('auto-delete: a secret older than the chosen time is removed', !(await s.ok('GET', '/api/secrets')).items.find(x => x.name === 'KEEP_ME' && x.stored));
  cli('secret', 'ask', 'vault', card.id, 'GONE_NOW', 'to delete', '--as', 'Forge');
  await page.reload(); await page.waitForSelector('#secretsBox tr[data-secret="GONE_NOW"]');
  await page.click('#secretsBox tr[data-secret="GONE_NOW"] button:has-text("Delete now")');
  await page.waitForSelector('#secretsBox tr[data-secret="GONE_NOW"]', { state: 'detached' });
  check('Delete now removes it from the list', !(await s.ok('GET', '/api/secrets')).items.find(x => x.name === 'GONE_NOW'));

  // Nowhere on disk, and the real Windows DPAPI path round-trips
  const bad = walk(s.dir).concat(walk(SECDIR)).filter(x => { try { return fs.readFileSync(x, 'utf8').includes(VALUE); } catch { return false; } });
  check('the value is in no file of the data folder, logs or secrets folder', bad.length === 0, bad);
  if (process.platform === 'win32') {
    const r = spawnSync(process.execPath, ['-e', `const x=require(${JSON.stringify(path.join(ROOT, 'lib', 'secrets.js'))}); const b=x.protect(${JSON.stringify(VALUE)}); console.log(b.startsWith('dpapi:') && !b.includes(${JSON.stringify(VALUE)}) && x.unprotect(b)===${JSON.stringify(VALUE)} ? 'ok' : 'bad')`], { env: { ...process.env, AIGILE_SECRETS_DIR: '' }, encoding: 'utf8', windowsHide: true });
    check('Windows DPAPI protects and unprotects the value (value sent on stdin)', r.stdout.trim() === 'ok', r.stdout + r.stderr);
  }
  noErrors(page);
}, true, { AIGILE_SECRETS_DIR: SECDIR });
