// QA area: pushsetting (AIG-673). Setup choice "Pushing to GitHub: ask me first / just push": kept across a reload, and the
// brief, the background run's prompt and its permissions follow it (never a force push).
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, openPage, def } from '../lib.mjs';

def('pushsetting', 'Setup: git push ask first or just push; brief line, run prompt and permissions follow (AIG-673)', async (s, ctx) => {
  const folder = tmp('push');
  fs.mkdirSync(path.join(folder, '.claude'), { recursive: true });
  const sfile = path.join(folder, '.claude', 'settings.local.json');
  fs.writeFileSync(sfile, JSON.stringify({ permissions: { allow: ['Bash'], ask: ['Bash(git push:*)', 'PowerShell(git push:*)'] } }, null, 2));
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  const prefs = async () => (await s.ok('GET', '/api/setup')).prefs;
  const wake = async () => {
    for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/alpha')).presence.running; i++) await sleep(250);
    try { fs.unlinkSync(s.wakeOut); } catch {}
    await s.ok('POST', '/api/projects/alpha/wake', {});
    let out = '';
    for (let i = 0; i < 60 && !out.includes('Pushing:'); i++) { await sleep(250); try { out = fs.readFileSync(s.wakeOut, 'utf8').slice(0); } catch {} }
    await sleep(500); try { out = fs.readFileSync(s.wakeOut, 'utf8').slice(0); } catch {}
    return out;
  };
  check('default is ask first', (await prefs()).push === 'ask');
  const brief0 = s.cli(['brief', 'alpha']).out;
  check('brief says to ask the owner first', /Pushing: ask Owner on the board first \(aigile ask \.\.\. GO\?\), then push yourself after his yes/.test(brief0), brief0);
  const out0 = await wake();
  check('ask: run prompt has the ask line, no push allowance, force denied', /Pushing: ask Owner/.test(out0) && !/--allowedTools/.test(out0) && /git push --force/.test(out0), out0);

  // Real clicks in Setup
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#pushPref');
  check('Setup shows Ask me first', (await page.inputValue('#pushPref')) === 'ask');
  await page.selectOption('#pushPref', 'auto');
  await page.waitForFunction(() => /./.test((document.getElementById('lead-done') || {}).textContent || ''));
  check('stored as auto', (await prefs()).push === 'auto');
  await page.reload(); await page.waitForSelector('#pushPref');
  check('after a reload Just push is still chosen', (await page.inputValue('#pushPref')) === 'auto');

  const brief1 = s.cli(['brief', 'alpha']).out;
  check('brief says push after each tested batch', /Pushing: push after each tested batch and log it with aigile log/.test(brief1) && !/Pushing: ask/.test(brief1), brief1);
  const out1 = await wake();
  check('auto: prompt line, git push allowed, force still denied', /Pushing: push after each tested batch/.test(out1) && /--allowedTools/.test(out1) && /Bash\(git push:\*\)/.test(out1) && /git push --force/.test(out1) && /Never force-push/.test(out1), JSON.stringify(out1));
  const perms = JSON.parse(fs.readFileSync(sfile, 'utf8')).permissions;
  check('project settings: push allowed, not asked, force denied', perms.allow.includes('Bash(git push:*)') && !(perms.ask || []).includes('Bash(git push:*)') && perms.deny.includes('Bash(git push --force:*)') && perms.deny.includes('Bash(git push -f:*)'), JSON.stringify(perms));

  // And back
  await page.selectOption('#pushPref', 'ask');
  await page.waitForFunction(async () => (await (await fetch('/api/setup')).json()).prefs.push === 'ask');
  await wake();
  const back = JSON.parse(fs.readFileSync(sfile, 'utf8')).permissions;
  check('back to ask: push asks again, no force deny left over', (back.ask || []).includes('Bash(git push:*)') && !(back.allow || []).includes('Bash(git push:*)') && !(back.deny || []).length, JSON.stringify(back));
  const bad = await s.api('POST', '/api/setup', { prefs: { push: 'maybe' } });
  check('a wrong value is refused', bad.status === 400, bad.status);
}, true);
