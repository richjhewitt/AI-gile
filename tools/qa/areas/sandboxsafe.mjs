// QA area: sandboxsafe (AIG-944): a server run as the tester's sandbox (AIGILE_SANDBOX=1) never writes a notes block, hooks or
// permissions, saves a file, or runs git in a project folder outside the temp dir; a temp folder still works.
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, def, ROOT } from '../lib.mjs';

def('sandboxsafe', '🧱 the tester sandbox cannot write notes, connect a folder or run git in a real folder', async (s) => {
  const real = fs.mkdtempSync(path.join(ROOT, 'tools', 'qa', '.sbreal-'));   // not under the OS temp dir = "a real folder"
  try {
    await mkProject(s, 'SbReal', 'SBR', { path: real });
    const c = await s.api('POST', '/api/projects/sbreal/connect', { path: real });
    check('connect a real folder is refused (409)', c.status === 409, JSON.stringify(c.body));
    check('no notes block or settings written', fs.readdirSync(real).length === 0, fs.readdirSync(real).join(','));
    const g = await s.api('POST', '/api/projects/sbreal/connect', { path: path.join(real, 'sub'), create: true });
    check('creating a new folder there is refused too', g.status === 409 && !fs.existsSync(path.join(real, 'sub')));
    const pm = await s.api('PUT', '/api/projects/sbreal/permissions', { allow: ['Bash'] });
    check('permissions write is refused', pm.status === 409 || pm.status === 400, pm.status);
    check('no .claude folder made', !fs.existsSync(path.join(real, '.claude')));
    const pr = await s.api('POST', '/api/projects/sbreal/cards', { title: 'x' });
    const pf = await s.api('POST', '/api/projects/sbreal/cards/' + (pr.body.id || 'SBR-1') + '/proof', { commit: 'abcd1234' });
    check('git proof in a real folder is refused (409)', pf.status === 409, pf.status + ' ' + JSON.stringify(pf.body));
    check('no .git made', !fs.existsSync(path.join(real, '.git')));
    const ok = tmp('sbtemp');
    const t = await s.api('POST', '/api/projects/sbreal/connect', { path: ok });
    check('a temp folder is still connectable (not 409)', t.status !== 409, t.status + ' ' + JSON.stringify(t.body));
  } finally { fs.rmSync(real, { recursive: true, force: true }); }
}, false, { AIGILE_SANDBOX: '1' });
