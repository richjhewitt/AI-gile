// QA area: editor (AIG-536): the small code editor stays inside the project folder, keeps a backup, refuses bad JSON and stale saves.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, tmp, def } from '../lib.mjs';

def('editor', 'editor lib: only inside the project folder, .git refused, invalid JSON refused, stale save refused, backup kept (AIG-536)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), d = tmp('ed');
  const r = spawnSync(process.execPath, [path.join(root, 'tools/qa/areas/editor-stub.cjs'), root, d], { env: { ...process.env, AIGILE_DATA: path.join(d, 'data'), AIGILE_LOCAL: path.join(d, 'l.json') }, encoding: 'utf8' });
  let o = {}; try { o = JSON.parse(r.stdout.trim().split('\n').pop()); } catch {}
  check('reads the permission file', o.read === '{"permissions":{}}', r);
  check('.. and absolute paths outside the folder are refused', o.escape && o.escape.err && o.abs && o.abs.err, o);
  check('.git is refused', o.git && o.git.err, o);
  check('invalid JSON is not saved', o.badjson && /not valid JSON/.test(o.badjson.err || ''), o);
  check('a good save lands and keeps one backup', o.save && o.save.ok && o.save.ok.backedUp && /Bash\(ls\)/.test(o.after) && o.backups === 1, o);
  check('a stale save is refused', o.stale && /changed on disk/.test(o.stale.err || ''), o);
  check('a new file is created', o.newfile && o.newfile.ok && o.newfile.ok.ok, o);
  check('quick buttons list the permission files', Array.isArray(o.quick) && o.quick[0] === '.claude/settings.local.json:true', o.quick);
});
