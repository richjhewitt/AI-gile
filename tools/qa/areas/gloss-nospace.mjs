// QA area: glossnospace (AIG-518): glossary terms match inside Chinese/Thai text, whole words only in spaced scripts.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, def } from '../lib.mjs';

def('glossnospace', 'glossary regex: Han and Thai terms match inside a sentence, spaced words whole only (AIG-518)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const r = spawnSync(process.execPath, [path.join(root, 'tools/qa/areas/gloss-nospace.cjs'), root], { encoding: 'utf8' });
  let o = {}; try { o = JSON.parse(r.stdout.trim().split('\n').pop()); } catch {}
  check('Han term found inside a sentence', Array.isArray(o.han) && o.han.includes('冲刺'), r);
  check('Thai term found inside a sentence', Array.isArray(o.thai) && o.thai.includes('ตัวแทน'), o);
  check('spaced words stay whole-word', JSON.stringify(o.whole) === '["bug"]', o);
});
