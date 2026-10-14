// QA area share, part 4 (AIG-307): roles on links (the AIG-185 roles plus 🧪 Alpha tester). Only the owner may use
// /api/shares (not a team via the CLI or a background run); a per-role allow/deny table of everything a friend can
// send; the role per project or for all my projects with them; the role picker and 🙋 Assign on the page.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, openPage, noErrors } from '../lib.mjs';

// What each role lets a friend send (lib/share.js CAN). ok = it lands; role = refused by the role (seq still moves).
const KINDS = ['card bug', 'card feature', 'card task', 'comment own', 'comment mine', 'status own', 'status mine', 'status assigned', 'test own', 'file own', 'verdict'];
const ALL = KINDS.map(() => 'ok'), NONE = KINDS.map(() => 'role');
const TABLE = {
  viewer: NONE,
  alpha: ['ok', 'ok', 'role', 'ok', 'role', 'role', 'role', 'role', 'role', 'role', 'role'],
  reporter: ['ok', 'role', 'role', 'ok', 'role', 'ok', 'role', 'role', 'role', 'ok', 'role'],
  member: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'role', 'ok', 'ok', 'ok', 'role'],
  tester: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'role', 'ok', 'ok', 'ok', 'ok'],
  developer: ALL,
  admin: ALL,
};

export async function shareRoles({ a, b, ca, cb, until, ctx }) {
  // Only the owner: the page (no X-Aigile-Where) or the CLI as the owner; never a team, never a background run.
  const asWho = (where, as, method, url, body) => fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body && JSON.stringify(body) }).then(r => r.status);
  await mkProject(a, 'Juliet', 'JUL'); await mkProject(b, 'Kilo', 'KIL');
  const all = { send: true, take: true, comments: true, status: true, files: false, teamRead: false };
  const off = await a.ok('POST', '/api/shares', { slug: 'juliet', contact: cb.id, allow: all });
  await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === off.id && l.state === 'incoming'));
  await b.ok('POST', `/api/shares/${off.id}/accept`, { slug: 'kilo', allow: all });
  const id = off.id;
  const liveA = await until(async () => (await a.ok('GET', '/api/shares?slug=juliet')).find(l => l.state === 'live'));
  check('roles: a new link makes the friend a Member (default)', liveA && liveA.role === 'member' && liveA.roleScope === 'default' && liveA.can.comment === 'shared', liveA);
  const j1 = await mkCard(a, 'juliet', 'Juliet one');
  const t = await a.cli(['show', 'juliet', j1.id], { AIGILE_AS: 'Bastion' });
  check('owner only: a team agent (CLI --as) is refused on /api/shares, all of it', await asWho('terminal', 'Bastion', 'GET', '/api/shares') === 403 && await asWho('vscode', 'Bastion', 'GET', `/api/shares/${id}/inbound`) === 403
    && await asWho('terminal', 'Bastion', 'POST', `/api/shares/${id}/cards`, { card: j1.id }) === 403 && await asWho('terminal', 'Bastion', 'PATCH', `/api/shares/${id}`, { role: 'admin' }) === 403 && await asWho('terminal', '', 'GET', '/api/shares') === 403);
  check('owner only: a background run is a team even as the owner', await asWho('background', 'Owner', 'GET', `/api/shares/${id}/inbound`) === 403);
  check('owner only: the CLI as the owner and the page may', await asWho('terminal', 'Owner', 'GET', `/api/shares/${id}/inbound`) === 200 && (await a.api('GET', `/api/shares/${id}/inbound`)).status === 200);
  check('owner only: the team\'s own door (show, /friend) stays open', t.code === 0 && await asWho('background', 'Bastion', 'GET', `/api/projects/juliet/cards/${j1.id}/friend`) === 200, t);
  check('owner only: nothing changed by the refused calls', (await a.ok('GET', '/api/shares?slug=juliet'))[0].role === 'member' && !(await a.ok('GET', '/api/projects/juliet')).cards[0].share);

  // B is told the role it was given (a label only).
  check('B sees the role A gave it', !!(await until(async () => (await b.ok('GET', '/api/shares?slug=kilo'))[0].theirRole === 'member')));

  // 🧪 Alpha tester for all my projects with B: bugs and ideas in, comments only on their own; nothing else.
  const al = await a.ok('PATCH', `/api/shares/${id}`, { role: 'alpha', scope: 'all' });
  check('alpha for all my projects: scope all, kept per person', al.role === 'alpha' && al.roleScope === 'all' && JSON.parse(fs.readFileSync(path.join(a.data, 'shares', 'people.json'), 'utf8'))[cb.id] === 'alpha', al);
  check('B is told: Alpha tester', !!(await until(async () => (await b.ok('GET', '/api/shares?slug=kilo'))[0].theirRole === 'alpha')));
  const sharedJ = await a.ok('POST', `/api/shares/${id}/cards`, { card: j1.id });
  const inbA = () => a.ok('GET', `/api/shares/${id}/inbound`), inbB = () => b.ok('GET', `/api/shares/${id}/inbound`);
  await until(async () => (await inbB()).cards.find(c => c.share === sharedJ.share.id));
  const before = (await a.ok('GET', '/api/shares?slug=juliet'))[0].refused;
  const kTask = await mkCard(b, 'kilo', 'A task from B', { type: 'task' }), kBug = await mkCard(b, 'kilo', 'A bug from B', { type: 'bug' });
  await b.ok('POST', `/api/shares/${id}/cards`, { card: kTask.id });
  const bugShare = (await b.ok('POST', `/api/shares/${id}/cards`, { card: kBug.id })).share.id;
  await b.ok('POST', `/api/shares/${id}/inbound/${sharedJ.share.id}/comments`, { text: 'Comment on your card' });
  await b.ok('POST', `/api/shares/${id}/cards`, { card: kBug.id });   // wait marker: an update after the others
  const got = await until(async () => { const x = await inbA(); return x.cards.find(c => c.share === bugShare) ? x : null; });
  await sleep(600);
  const lA = (await a.ok('GET', '/api/shares?slug=juliet'))[0], x = await inbA();
  check('alpha live: their bug lands, their task and their comment on my card are refused', got && x.cards.length === 1 && x.cards[0].title === 'A bug from B' && !(x.comments[sharedJ.share.id] || []).length && lA.refused >= before + 2, [x, lA.refused, before]);
  await b.ok('POST', `/api/projects/kilo/cards/${kBug.id}/comments`, { author: 'Owner', text: 'More on my bug' });
  check('alpha live: a comment on their own card lands', !!(await until(async () => ((await inbA()).comments[bugShare] || []).some(m => m.text === 'More on my bug'))));
  check('alpha: no tests handed to them', (await a.api('POST', `/api/shares/${id}/test`, { card: j1.id, text: 'try it' })).status === 409);

  // Reporter on this project only: sees only their own, so my cards are not shared with them.
  const rp = await a.ok('PATCH', `/api/shares/${id}`, { role: 'reporter', scope: 'project' });
  const j2 = await mkCard(a, 'juliet', 'Juliet two');
  const r2 = await a.api('POST', `/api/shares/${id}/cards`, { card: j2.id });
  check('reporter (this project): scope project, my cards are not shared with them', rp.role === 'reporter' && rp.roleScope === 'project' && r2.status === 409 && /their own/.test(r2.body.error), [rp.roleScope, r2]);

  // Member: 🙋 Assign tells them; a test needs a Tester.
  await a.ok('PATCH', `/api/shares/${id}`, { role: 'member' });
  const as = await a.ok('PATCH', `/api/shares/${id}/cards/${j1.id}`, { assigned: true });
  check('member: 🙋 assign marks my card and tells them', as.assigned && (await a.ok('GET', '/api/projects/juliet')).cards.find(c => c.id === j1.id).share.assigned === true
    && !!(await until(async () => (await inbB()).cards.find(c => c.share === sharedJ.share.id && c.forYou))));
  check('member: no tests handed to them (needs a Tester)', (await a.api('POST', `/api/shares/${id}/test`, { card: j1.id, text: 'try it' })).status === 409);
  check('a role that is not on the list is refused', (await a.api('PATCH', `/api/shares/${id}`, { role: 'owner' })).status === 400);

  // The allow/deny table: every role against everything a friend can send (lib/share.js receive, scratch data).
  const r = spawnSync(process.execPath, ['-e', `
    const fs = require('fs'), path = require('path'), share = require(${JSON.stringify(path.join(ROOT, 'lib', 'share.js'))});
    const dir = path.join(process.env.AIGILE_DATA, 'shares'), mine = { send: true, take: true, comments: true, status: true, files: true, teamRead: false };
    fs.mkdirSync(dir, { recursive: true });
    const c = { id: 'aaaaaaaaaaaa', checked: true }, env = { ts: Date.now() }, out = {}, b64 = Buffer.from('hi').toString('base64');
    ${JSON.stringify(Object.keys(TABLE))}.forEach((role, i) => {
      const L = (role + 'x'.repeat(22)).slice(0, 22).replace(/[^A-Za-z0-9]/g, 'x');
      fs.writeFileSync(path.join(dir, L + '.json'), JSON.stringify({ v: 1, id: L, contact: c.id, slug: 'p', state: 'live', mine, theirs: mine, role, on: true, seqOut: 0, seqIn: 0, created: new Date().toISOString(), exp: 0,
        outbound: { MYSHARE123: { card: 'P-1', assigned: true, test: { text: 't', open: true } }, MYSHARE456: { card: 'P-2' } }, inbound: { cards: { THEIRS1234: { share: 'THEIRS1234', title: 'x', updated: new Date().toISOString() } } } }));
      let seq = 0;
      const o = p => { const v = share.receive(c, env, { t: 'share', link: L, seq: ++seq, ...p }); return v.startsWith('share-') ? 'ok' : v; };
      out[role] = [
        o({ kind: 'card', share: 'NEWBUG0001', title: 'b', type: 'bug' }), o({ kind: 'card', share: 'NEWFEAT001', title: 'f', type: 'feature' }), o({ kind: 'card', share: 'NEWTASK001', title: 't', type: 'task' }),
        o({ kind: 'comment', share: 'THEIRS1234', text: 'c' }), o({ kind: 'comment', share: 'MYSHARE123', text: 'c' }),
        o({ kind: 'status', share: 'THEIRS1234', status: 'doing' }), o({ kind: 'status', share: 'MYSHARE456', status: 'doing' }), o({ kind: 'status', share: 'MYSHARE123', status: 'doing' }),
        o({ kind: 'test', share: 'THEIRS1234', text: 'try' }), o({ kind: 'file', share: 'THEIRS1234', name: 'a.txt', data: b64 }),
        o({ kind: 'verdict', share: 'MYSHARE123', verdict: 'accept' }),
      ];
      out[role + ':seq'] = JSON.parse(fs.readFileSync(path.join(dir, L + '.json'), 'utf8')).seqIn;
    });
    console.log(JSON.stringify(out));`], { env: { ...process.env, AIGILE_DATA: tmp('shareroles') }, encoding: 'utf8' });
  let w = {}; try { w = JSON.parse(r.stdout); } catch {}
  for (const [role, want] of Object.entries(TABLE)) {
    const bad = KINDS.filter((k, i) => (w[role] || [])[i] !== want[i]).map(k => `${k}: ${(w[role] || [])[KINDS.indexOf(k)]}`);
    check(`role table: ${role} (${KINDS.filter((k, i) => want[i] === 'ok').join(', ') || 'nothing'})`, bad.length === 0, [bad, r.stderr]);
  }
  check('role table: refused messages still move the seq on', Object.keys(TABLE).every(role => w[role + ':seq'] === KINDS.length), w);

  // The page: the role picker in the 🔗 dialog; 🙋 Assign and 🧪 on a shared card follow the role.
  const page = await openPage(ctx, '#/p/juliet');
  await page.waitForSelector('#shareBtn');
  await page.click('#shareBtn');
  await page.waitForSelector('#shareRole');
  check('🔗 dialog: the role picker shows Member, with what it allows', await page.inputValue('#shareRole') === 'member' && /only counts on cards you assign/.test(await page.textContent('#shareRoleHelp')) && /never wakes your team/.test(await page.textContent('#shareRoleHelp')));
  await page.selectOption('#shareRole', 'tester');
  check('🔗 dialog: picking Tester saves it', !!(await until(async () => (await a.ok('GET', '/api/shares?slug=juliet'))[0].role === 'tester')));
  await page.waitForSelector('#shareRole');
  await page.click('#dialog button[onclick="closeDialog()"]').catch(() => {});
  await page.goto(BASE + `/#/p/juliet/${j1.id}`);
  await page.waitForSelector('#shareAssignBtn', { timeout: 8000 }).catch(() => {});
  check('card panel: 🙋 assigned, and 🧪 for a Tester', /Assigned to Beatrix/.test(await page.textContent('#shareAssignBtn').catch(() => '')) && await page.locator('#shareTestBtn').count() === 1);
  await page.locator('#shareAssignBtn').evaluate(x => x.click());   // in the Reply pane, which may be behind its tab
  check('card panel: 🙋 again takes it back', !!(await until(async () => !(await a.ok('GET', '/api/projects/juliet')).cards.find(c => c.id === j1.id).share.assigned)));
  await a.ok('PATCH', `/api/shares/${id}`, { role: 'viewer' });
  await page.reload();
  await page.waitForSelector('.share-cmts', { timeout: 3000 }).catch(() => {});
  await sleep(500);
  check('card panel: a Viewer gets neither 🙋 nor 🧪', await page.locator('#shareAssignBtn').count() === 0 && await page.locator('#shareTestBtn').count() === 0);
  noErrors(page);
  await page.close();
}
