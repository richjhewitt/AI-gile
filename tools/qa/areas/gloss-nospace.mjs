// QA area: glossnospace (AIG-518): glossary terms match inside Chinese/Thai text, whole words only in spaced scripts.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, def } from '../lib.mjs';

def('glossnospace', 'glossary regex: Han and Thai terms match inside a sentence, spaced words whole only, also through Hindi/Kannada vowel signs (AIG-518, AIG-1453)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const r = spawnSync(process.execPath, [path.join(root, 'tools/qa/areas/gloss-nospace.cjs'), root], { encoding: 'utf8' });
  let o = {}; try { o = JSON.parse(r.stdout.trim().split('\n').pop()); } catch {}
  check('Han term found inside a sentence', Array.isArray(o.han) && o.han.includes('冲刺'), r);
  check('Thai term found inside a sentence', Array.isArray(o.thai) && o.thai.includes('ตัวแทน'), o);
  check('spaced words stay whole-word', JSON.stringify(o.whole) === '["bug"]', o);
  check('AIG-1453: Hindi term on its own is found, not inside a longer word (vowel sign after it)', JSON.stringify(o.hindi) === '["बग"]', o);
  check('AIG-1453: Kannada term on its own is found, not before a zero-width non-joiner', JSON.stringify(o.kannada) === '["ಏಜೆಂಟ್"]', o);
});
