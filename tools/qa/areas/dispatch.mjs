// QA area: dispatch (AIG-364): who is woken for the owner's new card or comment. Rules first, Haiku only when unclear.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, say, def } from '../lib.mjs';

// The stub agent stands in for Haiku: when called with --model haiku it notes the call and answers "Pixel".
const dir = tmp('dispatch'), marker = path.join(dir, 'haiku-calls.txt'), stub = path.join(dir, 'haiku-stub.bat'), local = path.join(dir, 'local.json');
fs.writeFileSync(path.join(dir, 'haiku-stub.js'), `if (process.argv.includes('haiku')) { require('fs').appendFileSync(${JSON.stringify(marker)}, 'x\\n'); console.log('Pixel'); }`);
fs.writeFileSync(stub, `@echo off
node "${path.join(dir, 'haiku-stub.js')}" %*
exit /b 0
`);
fs.writeFileSync(local, '{ "owner": "Owner" }');
const calls = () => { try { return fs.readFileSync(marker, 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } };

def('dispatch', 'who answers the owner: rules first (verify -> tester, @name, DM -> lead, building -> assignee), Haiku only when unclear, Setup modes, logged', async (s) => {
  const folder = tmp('dispatchp');
  await mkProject(s, 'Disp', 'DSP', { path: folder });
  for (const [name, role] of [['Lead', 'lead'], ['Pixel', 'Frontend'], ['Forge', 'Backend'], ['Tess', 'QA tester']]) await s.ok('POST', '/api/projects/disp/team', { name, role });
  check('Setup default is Rules + Haiku', (await s.ok('GET', '/api/setup')).prefs.dispatch === 'haiku');
  check('a bad mode is refused', (await s.api('POST', '/api/setup', { prefs: { dispatch: 'nope' } })).status === 400);
  const logOf = async id => ((await s.ok('GET', '/api/projects/disp')).log || []).filter(e => e.author === 'Dispatcher' && e.text.startsWith(id + ' sent to ')).map(e => e.text);
  // Make a card, let the owner comment, and read the dispatcher's decision for it from the team log.
  const ask = async (title, extra, text) => {
    const c = await mkCard(s, 'disp', title, extra);
    await until(async () => (await logOf(c.id)).length);   // a new card from the owner is dispatched too
    const before = (await logOf(c.id)).length;
    await say(s, 'disp', c.id, 'Owner', text);
    await until(async () => (await logOf(c.id)).length > before);
    return (await logOf(c.id)).pop() || '';
  };

  let r = await ask('Verify me', { status: 'verify', testSteps: '1. look' }, 'looks odd to me');
  check('comment on a verify card goes to the tester', /sent to Tess$/.test(r), r);
  r = await ask('Busy', { status: 'doing', assignee: 'Pixel' }, 'thanks, how is it going?');
  check('plain comment on an in-progress card for Frontend goes to the lead', /sent to Lead$/.test(r), r);
  check('the log line is plain words, no rule name (AIG-1081)', /sent to Lead$/.test(r) && !/rule|->/.test(r), r);
  r = await ask('Busy 2', { status: 'doing', assignee: 'Pixel' }, 'please fix the button colour');
  check('a comment about building it goes to the assignee', /sent to Pixel$/.test(r), r);
  r = await ask('Named', {}, '@Forge could you look at this');
  check('@Forge goes to Forge', /sent to Forge$/.test(r), r);
  r = await ask('Named 2', { status: 'verify', testSteps: '1. x' }, 'Pixel, the heading is cut off');
  check('"Pixel, ..." goes to Pixel even on a verify card', /sent to Pixel$/.test(r), r);
  r = await ask('💬 hello there', {}, 'good morning');
  check('a DM (💬) always goes to the lead', /sent to Lead$/.test(r), r);
  check('no AI call so far (rules decided everything)', calls() === 0, calls());

  // Unclear: two assignees. Rules + Haiku asks the (stub) Haiku once; Rules only never does.
  r = await ask('Two owners', { status: 'doing', assignee: 'Pixel, Forge' }, 'who is on this?');
  check('unclear: Haiku picks once', /sent to Pixel \(haiku \(several assignees\)\)/.test(r) && calls() === 1, r + ' / calls ' + calls());
  await s.ok('POST', '/api/setup', { prefs: { dispatch: 'rules' } });
  const b = calls();
  r = await ask('Two owners b', { status: 'doing', assignee: 'Pixel, Forge' }, 'who is on this?');
  check('Rules only: unclear goes to the lead and never calls the AI', /sent to Lead \(several assignees, rules only: lead\)/.test(r) && calls() === b, r + ' / calls ' + calls());
  await s.ok('POST', '/api/setup', { prefs: { dispatch: 'lead' } });
  r = await ask('Verify again', { status: 'verify', testSteps: '1. look' }, 'looks odd to me');
  check('Lead decides everything: always the lead, even on a verify card', /sent to Lead \(lead decides everything\)/.test(r) && calls() === b, r);
  r = await ask('Named 3', {}, '@Forge please');
  check('Lead decides everything ignores @names too', /sent to Lead \(lead decides everything\)/.test(r), r);
  check('Setup remembers the mode', (await s.ok('GET', '/api/setup')).prefs.dispatch === 'lead');
  await sleep(100);
}, false, { AIGILE_AGENT_COMMAND: stub, AIGILE_LOCAL: local, AIGILE_NO_WINDOWS: '1' });
