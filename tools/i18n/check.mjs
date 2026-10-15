// Checks the language files against English (AIG-487; see docs/i18n.md):
//   node tools/i18n/check.mjs [code ...] [--dir <folder>] [--missing] [--json]
// For each public/lang/<code>.json (or just the codes given): invalid JSON, keys English doesn't have, {placeholders} that
// differ from English, values that are neither a string nor a plural object { one, other, ... }, and files missing from
// languages.json. Keys missing from a file are only counted (--missing lists them): the page shows English for those.
// Exits 1 when any file has a problem. The QA area i18n runs it over every shipped file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
const flag = n => { const i = args.indexOf(n); return i >= 0 ? !!args.splice(i, 1) : false; };
const dir = path.resolve(opt('--dir') || path.join(ROOT, 'public', 'lang'));
const showMissing = flag('--missing'), asJson = flag('--json');

const FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];
// {name} placeholders, not the {{dev:word}} markers; a plural object counts every form's.
const holders = v => new Set((typeof v === 'string' ? [v] : Object.values(v || {})).flatMap(s => String(s).replace(/\{\{[^}]*\}\}/g, '').match(/\{\w+\}/g) || []));
const badValue = v => typeof v === 'string' ? null
  : !v || typeof v !== 'object' || Array.isArray(v) ? 'is not a string or a plural object'
  : Object.keys(v).find(f => !FORMS.includes(f)) ? `has a plural form that does not exist: ${Object.keys(v).find(f => !FORMS.includes(f))} (use ${FORMS.join(', ')})`
  : Object.values(v).some(s => typeof s !== 'string') ? 'has a plural form that is not a string'
  : !('other' in v) ? 'is a plural object without "other"' : null;
const readJson = f => { try { return { data: JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')) }; } catch (e) { return { error: e.message }; } };

function checkFile(code, en, listed) {
  const r = { code, problems: [], missing: [] };
  const { data, error } = readJson(path.join(dir, code + '.json'));
  if (error) { r.problems.push('invalid JSON: ' + error); return r; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { r.problems.push('invalid JSON: not an object of keys'); return r; }
  if (listed && !listed.has(code)) r.problems.push('not in languages.json, so the picker never shows it');
  for (const [k, v] of Object.entries(data)) {
    if (!(k in en)) { r.problems.push('key English does not have: ' + k); continue; }
    const bad = badValue(v); if (bad) { r.problems.push(`${k} ${bad}`); continue; }
    const want = [...holders(en[k])].sort().join(' '), got = [...holders(v)].sort().join(' ');
    if (want !== got) r.problems.push(`${k}: placeholders ${got || '(none)'}, English has ${want || '(none)'}`);
  }
  r.missing = Object.keys(en).filter(k => !(k in data));
  return r;
}

const enRead = readJson(path.join(dir, 'en.json'));
if (enRead.error) { console.error('en.json: invalid JSON: ' + enRead.error); process.exit(1); }
const en = enRead.data, enProblems = Object.entries(en).map(([k, v]) => badValue(v) && `${k} ${badValue(v)}`).filter(Boolean);
const list = readJson(path.join(dir, 'languages.json'));
const listed = Array.isArray(list.data) ? new Set(list.data.map(l => l && l.code)) : null;
const listProblems = list.error ? ['invalid JSON: ' + list.error] : !listed ? ['not a list'] : list.data.flatMap((l, i) => !l || typeof l.code !== 'string' || !l.label || !l.name || !l.locale ? [`entry ${i + 1} needs code, label, name and locale`] : l.dir && l.dir !== 'rtl' ? [`${l.code}: dir can only be "rtl"`] : []);

const codes = args.length ? args : fs.readdirSync(dir).filter(f => f.endsWith('.json') && !['en.json', 'languages.json'].includes(f)).map(f => f.slice(0, -5)).sort();
const results = [{ code: 'en', problems: enProblems, missing: [] }, { code: 'languages', problems: listProblems, missing: [] }, ...codes.map(c => checkFile(c, en, listed))];
const failed = results.filter(r => r.problems.length);

if (asJson) console.log(JSON.stringify({ ok: !failed.length, keys: Object.keys(en).length, results }, null, 1));
else {
  for (const r of results) {
    const name = (r.code + '.json').padEnd(18);
    const miss = r.missing.length ? `  (${r.missing.length} of ${Object.keys(en).length} missing: English shows instead)` : '';
    console.log(r.problems.length ? `${name}✗ ${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}${miss}` : `${name}ok${miss}`);
    for (const p of r.problems) console.log('    ' + p);
    if (showMissing) for (const k of r.missing) console.log('    missing: ' + k);
  }
  console.log(failed.length ? `\n${failed.length} file(s) with problems.` : `\nAll ${results.length - 2} language file(s) pass.`);
}
process.exit(failed.length ? 1 : 0);
