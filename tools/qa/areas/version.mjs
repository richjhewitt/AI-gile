// QA area: version (AIG-976). One version number in package.json: /api/version returns it and the 🐣 tag's tooltip ends with it.
import fs from 'fs';
import path from 'path';
import { check, openPage, noErrors, def, ROOT } from '../lib.mjs';

def('version', 'The 🐣 tag tooltip ends with the version from package.json; /api/version returns it (AIG-976)', async (s, ctx) => {
  const want = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const r = await s.ok('GET', '/api/version');
  check('/api/version returns the package.json version', !!want && r.version === want, JSON.stringify(r));
  const page = await openPage(ctx, '#/');
  const tip = await page.waitForFunction(() => { const e = document.querySelector('.alpha-tag'); return e && / · v\d/.test(e.title) && e.title; }, null, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => '');
  check('the 🐣 tag tooltip ends with the version', tip.endsWith(' · v' + want), tip);
  noErrors(page);
}, true);
