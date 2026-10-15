#!/usr/bin/env node
// Checks the website's languages (AIG-1226): every site/lang/<code>*.json against English.
//   node tools/site-i18n-check.mjs [code ...] [--quiet]   (no codes = every language with a file; exit 1 on any error)
// Texts (<code>.json): every English key, same {placeholders}, same HTML tags in .html keys, nothing empty.
// Plural keys (key.one, key.other...): key.other is needed, other forms are free (key.few, key.many... as the language needs).
// Slider lines (<code>.lines.json): the same lengths as English, 2+ texts each, each within 20% of its length
// (words; characters for languages without spaces, 2 per word), unit "chars" exactly for those languages.
// Timeline (<code>.timeline.json): every stage id's name and line. Scripts: lang/<code>.js up to date (tools/gen/site-lang.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANG, CHAR_LANGS, CHARS_PER_WORD, languages, languagesJs, enTimeline, codesWithFiles, bundleJs } from './gen/site-lang.mjs';

const args = process.argv.slice(2), quiet = args.includes('--quiet'), wanted = args.filter(a => !a.startsWith('--'));
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const PLURAL = /\.(zero|one|two|few|many|other)$/;
const notes = o => Object.keys(o).filter(k => !k.startsWith('_'));
const holders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const tags = s => [...String(s).matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)].map(m => m[0].toLowerCase()).sort().join(',');

export const words = t => t.trim().split(/\s+/).filter(w => /[^\s\p{P}]/u.test(w)).length;
export const chars = t => (t.match(/\p{L}/gu) || []).length;   // letters only, as the slider's label counts them
export function target(n, unit) {
  if (unit === 'chars') { const c = n * CHARS_PER_WORD; return { want: c, lo: c - Math.max(1, Math.round(c * 0.2)), hi: c + Math.max(1, Math.round(c * 0.2)) }; }
  const tol = Math.round(n * 0.2); return { want: n, lo: n - tol, hi: n + tol };
}

const en = read(path.join(LANG, 'en.json')), enLines = read(path.join(LANG, 'en.lines.json')), enTl = enTimeline();
// English groups: a plural key's base (pitch.words) or the key itself.
const base = k => PLURAL.test(k) ? k.replace(PLURAL, '') : k;
const enGroups = new Map();
for (const k of notes(en)) { const b = base(k); if (!enGroups.has(b)) enGroups.set(b, []); enGroups.get(b).push(k); }
const known = new Set(languages().map(l => l.code));

function checkUi(code, ui, err, warn) {
  let have = 0;
  for (const [b, keys] of enGroups) {
    const plural = keys.some(k => PLURAL.test(k));
    if (!plural) {
      const v = ui[b];
      if (v == null) { err('missing key ' + b); continue; }
      if (typeof v !== 'string' || !v.trim()) { err('empty ' + b); continue; }
      have++;
      if (holders(v) !== holders(en[b])) err(`${b}: placeholders {${holders(v)}} should be {${holders(en[b])}}`);
      if (/\.html$/.test(b) && tags(v) !== tags(en[b])) err(`${b}: HTML tags [${tags(v)}] should be [${tags(en[b])}]`);
      continue;
    }
    const forms = Object.keys(ui).filter(k => base(k) === b && PLURAL.test(k)), other = en[b + '.other'];
    if (!ui[b + '.other']) { err('missing key ' + b + '.other'); continue; }
    have++;
    for (const k of forms) {
      const v = ui[k];
      if (typeof v !== 'string' || !v.trim()) { err('empty ' + k); continue; }
      const want = holders(other), got = holders(v);
      // key.one may leave the number out ("a card"); every other form keeps the placeholders.
      if (k.endsWith('.one') || k.endsWith('.zero') || k.endsWith('.two') ? got.split(',').some(x => x && !want.split(',').includes(x)) : got !== want) err(`${k}: placeholders {${got}} should be {${want}}`);
      if (/\.html(\.|$)/.test(k) && tags(v) !== tags(other)) err(`${k}: HTML tags [${tags(v)}] should be [${tags(other)}]`);
    }
  }
  for (const k of notes(ui)) if (!enGroups.has(base(k))) warn('extra key ' + k + ' (not in en.json)');
  return have + '/' + enGroups.size;
}

function checkLines(code, d, err, warn) {
  const unit = d.unit || 'words', mustChars = CHAR_LANGS.includes(code);
  if (unit !== 'words' && unit !== 'chars') err('unit must be "words" or "chars"');
  if (mustChars && unit !== 'chars') err(code + ' is written without spaces: set "unit": "chars"');
  if (!mustChars && unit === 'chars') err(code + ' uses spaces: "unit" should be "words"');
  const sizes = Array.isArray(d.sizes) ? d.sizes : [], ns = sizes.map(z => z.n), enNs = enLines.sizes.map(z => z.n);
  if (ns.join() !== enNs.join()) err(`lengths ${ns.join(',')} should be ${enNs.join(',')}`);
  let ok = 0, all = 0;
  const flat = [];
  for (const z of sizes) {
    const texts = Array.isArray(z.texts) ? z.texts : [];
    if (texts.length < 2) err(`length ${z.n}: ${texts.length} text(s), needs 2 or more (English has ${(enLines.sizes.find(e => e.n === z.n) || { texts: [] }).texts.length})`);
    const { want, lo, hi } = target(z.n, unit);
    for (const t of texts) {
      all++;
      const got = unit === 'chars' ? chars(t) : words(t);
      if (got < lo || got > hi) err(`length ${z.n}: ${got} ${unit} (want ${want}, ${lo}-${hi}): "${t.slice(0, 60)}${t.length > 60 ? '…' : ''}"`); else ok++;
      if (code !== 'en' && enLines.sizes.some(e => e.texts.includes(t))) warn(`length ${z.n}: text is still the English one`);
      flat.push({ n: z.n, t: t.replace(/[\s\p{P}]+$/u, '') });
    }
  }
  // Each length is written fresh: a short text should not just be the start of a longer one.
  for (const a of flat) for (const b of flat) if (b.n > a.n && a.n >= 3 && b.t.startsWith(a.t)) warn(`length ${a.n} looks cut from length ${b.n}: "${a.t.slice(0, 40)}"`);
  for (const q of Object.keys(d.quips || {})) if (!ns.includes(+q)) warn('quip for ' + q + ' but there is no such length');
  return ok + '/' + all;
}

function checkTimeline(code, d, err, warn) {
  let have = 0;
  for (const k of notes(enTl)) { if (d[k] == null) err('timeline: missing ' + k); else if (enTl[k] && !String(d[k]).trim()) err('timeline: empty ' + k); else have++; }
  for (const k of notes(d)) if (!(k in enTl)) warn('timeline: extra ' + k + ' (stage gone from timeline.json)');
  return have + '/' + notes(enTl).length;
}

let errors = 0, warnings = 0;
const rows = [];
const text = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout may have CRLF
if (text(path.join(LANG, 'languages.js')) !== languagesJs()) { console.log('ERROR languages.js is out of date: run node tools/gen/site-lang.mjs'); errors++; }

// English itself: every key the pages and scripts use is in en.json.
{
  const used = new Set();
  for (const f of fs.readdirSync(SITE).filter(f => /\.(html|js)$/.test(f))) {
    const s = fs.readFileSync(path.join(SITE, f), 'utf8'), page = f.endsWith('.html');   // i18n.js only names the attributes in comments
    if (page) for (const m of s.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
    if (page) for (const m of s.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(';')) used.add(p.split(':')[1].trim());
    for (const m of s.matchAll(/\b(?:T|t_|SiteI18n\.t)\("([\w.]+)"/g)) used.add(m[1]);
    for (const m of s.matchAll(/"([a-z]\w*\.[\w.]+)"/gi)) if (enGroups.has(m[1])) used.add(m[1]);   // a key picked in code: t(d ? "theme.toLight" : "theme.toDark")
  }
  for (const k of used) if (!enGroups.has(k) && en[k] == null) { console.log('ERROR en.json has no key ' + k + ' (used by a page or script)'); errors++; }
  for (const b of enGroups.keys()) if (!used.has(b)) { if (!quiet) console.log('warn  en.json key ' + b + ' is not used by any page or script'); warnings++; }
}

const codes = wanted.length ? wanted : codesWithFiles();
for (const code of codes) {
  const e = [], w = [], err = m => e.push(m), warn = m => w.push(m);
  if (!known.has(code)) err('not a language in public/lang/languages.json');
  const f = s => path.join(LANG, code + s), row = { code, ui: '-', lines: '-', timeline: '-', script: '-' };
  const load = (s, what) => { if (!fs.existsSync(f(s))) { if (code !== 'en') warn(what + ': no ' + code + s + ' yet (English is shown)'); return null; } try { return read(f(s)); } catch (x) { err(code + s + ': not valid JSON (' + x.message + ')'); return null; } };
  const ui = load('.json', 'texts'), lines = load('.lines.json', 'slider'), tl = code === 'en' ? null : load('.timeline.json', 'timeline');
  if (ui) row.ui = checkUi(code, ui, err, warn);
  if (lines) row.lines = checkLines(code, lines, err, warn);
  if (tl) row.timeline = checkTimeline(code, tl, err, warn);
  if (code === 'en') row.timeline = 'source';
  if (!fs.existsSync(f('.js'))) err(code + '.js missing: run node tools/gen/site-lang.mjs ' + code);
  else if (text(f('.js')) !== bundleJs(code)) err(code + '.js is out of date: run node tools/gen/site-lang.mjs ' + code);
  else row.script = 'ok';
  row.errors = e.length; row.warnings = w.length; errors += e.length; warnings += w.length; rows.push(row);
  if (!quiet) { for (const m of e) console.log(`ERROR ${code}: ${m}`); for (const m of w) console.log(`warn  ${code}: ${m}`); }
}

console.log('\ncode        texts    slider   timeline script errors warnings');
for (const r of rows) console.log([r.code.padEnd(11), r.ui.padEnd(8), r.lines.padEnd(8), r.timeline.padEnd(8), r.script.padEnd(6), String(r.errors).padEnd(6), r.warnings].join(' '));
console.log(`\n${rows.length} language(s), ${errors} error(s), ${warnings} warning(s)` + (errors ? '' : ': all good'));
process.exit(errors ? 1 : 0);
