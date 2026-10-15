// QA area: groupdm (AIG-1027): 👥 a group chat in Messages with the owner and agents from several projects. The owner's message
// wakes each member once with its own engine, model and project folder (stubs stand in for Claude and Codex); a member running
// for the group gets one go-round-again, not a second process; `aigile group say` lands in the thread as "Name (Engine)".
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { check, sleep, tmp, until, mkProject, openPage, noErrors, def } from '../lib.mjs';

const require = createRequire(import.meta.url);
const dir = tmp('groupdm'), stub = path.join(dir, 'codex-stub' + require('../../../lib/platform').stubExt()), out = path.join(dir, 'codex-out.txt');
require('../../../lib/platform').writeStub(fs, stub, 'log', out);

def('groupdm', '👥 group chats: ＋ New group in Messages, the owner\'s message wakes each member once (own engine, model, folder), again not twice, aigile group say/show, owner-only (AIG-1027)', async (s, ctx) => {
  const pa = tmp('grpa'), pb = tmp('grpb');
  await mkProject(s, 'Pix', 'PIX', { path: pa });
  await mkProject(s, 'Clo', 'CLO', { path: pb });
  await s.ok('POST', '/api/projects/pix/team', { name: 'Pixel', role: 'Designer', engine: 'codex', codexModel: 'gpt-q' });
  await s.ok('POST', '/api/projects/clo/team', { name: 'Claudia', role: 'Designer', model: 'sonnet' });
  const read = f => { try { return fs.readFileSync(f, 'utf8').replace(/\r/g, '').replace(/"/g, ''); } catch { return ''; } };
  const norm = x => String(x).trim().toLowerCase().replace(/\\/g, '/');
  const logOf = (slug, key) => read(path.join(s.data, 'logs', key + '.log'));
  const starts = key => (logOf('', key).match(/started \(group /g) || []).length;

  // Candidates: every agent with its project and engine
  const cands = await s.ok('GET', '/api/chats/_groups/candidates');
  check('candidates list both agents with project and engine', cands.some(c => c.name === 'Pixel' && c.project === 'pix' && c.engineLabel === 'Codex') && cands.some(c => c.name === 'Claudia' && c.project === 'clo' && c.engineLabel === 'Claude'), cands);
  check('one member is not a group', (await s.api('POST', '/api/chats/_groups', { name: 'x', members: [{ project: 'pix', name: 'Pixel' }] })).status === 400);
  check('an unknown agent is refused', (await s.api('POST', '/api/chats/_groups', { name: 'x', members: [{ project: 'pix', name: 'Pixel' }, { project: 'clo', name: 'Nobody' }] })).status === 400);

  // The page: Messages, ＋ New group, pick both, create
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dmnewgroup]');
  check('Messages has a Groups part with ＋ New group', /Groups/.test(await page.textContent('#dmPanel .dm-groups')));
  await page.click('#dmPanel [data-dmnewgroup]');
  await page.waitForSelector('#grpPick [data-grpi]');
  check('the picker shows name · project · engine', /Pixel · Pix · Codex/.test(await page.textContent('#grpPick')) && /Claudia · Clo · Claude/.test(await page.textContent('#grpPick')));
  await page.fill('#grpName', 'IRL logo');
  await page.click('#grpCreate');
  check('fewer than two picked is refused in the dialog', /two/.test(await page.textContent('#grpErr')));
  await page.evaluate(() => document.querySelectorAll('#grpPick label').forEach(l => { if (/Pixel|Claudia/.test(l.textContent)) l.querySelector('input').checked = true; }));
  await page.click('#grpCreate');
  await page.waitForSelector('#dmText');
  const groups = await s.ok('GET', '/api/chats/_groups'), g = groups[0];
  check('the group is saved with both members', groups.length === 1 && g.name === 'IRL logo' && g.members.length === 2, groups);
  check('kept in data/groups/<id>.chat', fs.existsSync(path.join(s.data, 'groups', g.id + '.chat')));
  const kPix = 'pix#grp-' + g.id + '-pixel', kClo = 'clo#grp-' + g.id + '-claudia';

  // The owner writes: both members start, each with its engine, model and folder
  fs.writeFileSync(out, ''); fs.writeFileSync(s.wakeOut, '');
  await page.fill('#dmText', '5 logo designs each, please'); await page.press('#dmText', 'Enter');
  await until(() => /exec/.test(read(out)) && /-p /.test(read(s.wakeOut)), 15000);
  const cx = read(out), cl = read(s.wakeOut);
  check('Pixel runs codex exec with its model', / ?exec --json .*-m gpt-q You are running through Codex/.test(cx), cx);
  check('Pixel runs in its project folder', norm(cx.split('\n')[0]) === norm(pa), cx.split('\n')[0]);
  check('Claudia runs Claude with -p and its model', /-p You are Claudia/.test(cl) && /--model sonnet/.test(cl), cl);
  check('Claudia runs in her project folder', norm(cl.split('\n')[0]) === norm(pb), cl.split('\n')[0]);
  check('the prompt names the group, the thread and the one reply', cx.includes('IRL logo') && cx.includes('5 logo designs each') && cx.includes(`aigile group say ${g.id}`) && /--as 'Pixel'/.test(cx) && /Do not start the wait command/.test(cx), cx);
  check('the run is logged under the member key', starts(kPix) === 1 && starts(kClo) === 1, logOf('', kPix));
  check('In flight shows the run on its project', !!(await s.ok('GET', '/api/projects/pix')).presence.workers.find(w => w.id === 'grp-' + g.id + '-pixel'));

  // Again while running: no second process now, one more run after
  const r2 = await s.ok('POST', '/api/chats/_groups/' + g.id, { text: 'and one in blue' });
  check('a member still running gets again, not a second run', r2.woke.every(w => w.again) && starts(kPix) === 1 && starts(kClo) === 1, r2);
  await until(() => starts(kPix) === 2 && starts(kClo) === 2, 20000);
  check('after the run ends it goes round once more', starts(kPix) === 2 && starts(kClo) === 2, [starts(kPix), starts(kClo)]);
  await until(async () => !(await s.ok('GET', '/api/projects/pix')).presence.workers.length && !(await s.ok('GET', '/api/projects/clo')).presence.workers.length, 20000);
  await sleep(1500);
  check('and only once', starts(kPix) === 2 && starts(kClo) === 2, [starts(kPix), starts(kClo)]);

  // A member answers with the CLI, as a background run would
  const say = s.cli(['group', 'say', g.id, 'Five designs: C:/irl/logo-1.png', '--as', 'Pixel'], { AIGILE_BACKGROUND: '1' });
  check('aigile group say works', say.code === 0, say);
  const th = await s.ok('GET', '/api/chats/_groups/' + g.id);
  check('the answer is in the thread as Pixel (Codex)', th.messages.some(m => m.author === 'Pixel (Codex)' && /Five designs/.test(m.text) && !m.mine), th.messages);
  await page.waitForFunction(() => /Pixel \(Codex\)/.test(document.getElementById('dmList').textContent), null, { timeout: 8000 });
  check('the page shows the author with the engine', true);
  const show = s.cli(['group', 'show', g.id]);
  check('aigile group show prints the thread', show.code === 0 && /IRL logo/.test(show.out) && /Pixel \(Codex\): Five designs/.test(show.out) && /Owner: 5 logo designs/.test(show.out), show);
  check('say as a non-member is refused', s.cli(['group', 'say', g.id, 'hi', '--as', 'Mallory'], { AIGILE_BACKGROUND: '1' }).code !== 0);
  check('say as the owner is refused', (await s.api('POST', `/api/chats/_groups/${g.id}/say`, { as: 'Owner', text: 'x' })).status === 400);
  check('a member answer wakes nobody', starts(kPix) === 2 && starts(kClo) === 2);

  // Owner only: a team's call cannot create a group or write as the owner
  const asTeam = (url, body) => fetch(s.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'background', 'X-Aigile-As': 'Pixel' }, body: JSON.stringify(body) }).then(r => r.status);
  check('a team call cannot create a group', await asTeam('/api/chats/_groups', { name: 'y', members: [{ project: 'pix', name: 'Pixel' }, { project: 'clo', name: 'Claudia' }] }) === 403);
  check('a team call cannot post as the owner', await asTeam('/api/chats/_groups/' + g.id, { text: 'hi' }) === 403);
  check('a team call cannot list the candidates', (await fetch(s.base + '/api/chats/_groups/candidates', { headers: { 'X-Aigile-Where': 'background', 'X-Aigile-As': 'Pixel' } })).status === 403);

  // ⛔ No Token Mode: the message is kept, nobody starts, the thread says why
  await s.ok('POST', '/api/notokens', { on: true });
  const r3 = await s.ok('POST', '/api/chats/_groups/' + g.id, { text: 'still there?' });
  check('No Token Mode: nobody is woken', r3.woke.every(w => w.skipped) && starts(kPix) === 2, r3);
  check('and the thread says so', (await s.ok('GET', '/api/chats/_groups/' + g.id)).messages.some(m => /Pixel was not woken/.test(m.text)));
  await s.ok('POST', '/api/notokens', { on: false });
  noErrors(page);
}, true, { AIGILE_ENGINE_STUB: stub });
