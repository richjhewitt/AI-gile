#!/usr/bin/env node
// Builds the website's language scripts (AIG-1226) from the JSON files translators edit:
//   site/lang/languages.js    every language the app has (public/lang/languages.json), for the language button
//   site/lang/en.timeline.json the English timeline texts by stage id, from site/timeline.json (the source translators copy)
//   site/lang/<code>.js       <code>.json + <code>.lines.json + <code>.timeline.json in one script (works over https and from a file)
// Run: node tools/gen/site-lang.mjs [code ...]   (no codes = every language that has a file; check: node tools/site-i18n-check.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE = path.join(ROOT, 'site'), LANG = path.join(SITE, 'lang');
// Written without spaces between words: slider lengths count characters there, 2 per word.
export const CHAR_LANGS = ['zh', 'zh-tw', 'ja', 'th', 'lo', 'km', 'my'];
export const CHARS_PER_WORD = 2;
const FIELDS = ['code', 'label', 'name', 'locale', 'dir', 'fun', 'region', 'notRegion', 'base'];

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const readIf = f => fs.existsSync(f) ? read(f) : null;
// Keys starting with _ are notes for people, never shipped.
const strip = o => o && Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

export function languages() { return read(path.join(ROOT, 'public', 'lang', 'languages.json')); }
export function languagesJs() {
  const list = languages().map(l => Object.fromEntries(FIELDS.filter(f => l[f] != null).map(f => [f, l[f]])));
  return '// Made by tools/gen/site-lang.mjs from public/lang/languages.json: do not edit by hand.\nwindow.SITE_LANGS = ' + JSON.stringify(list) + ';\n';
}
// The timeline texts translators translate: "<stage id>.name" and "<stage id>.line", done stages then planned ones.
export function enTimeline() {
  const t = read(path.join(SITE, 'timeline.json')), o = { _note: 'Made by tools/gen/site-lang.mjs from site/timeline.json (English, do not edit). Translations: <code>.timeline.json with the same keys; dates and card counts stay in timeline.json.' };
  for (const s of [...(t.stages || []), ...(t.planned || [])]) { o[s.id + '.name'] = s.name; o[s.id + '.line'] = s.line || ''; }
  return o;
}
export function codesWithFiles() {
  const out = new Set();
  for (const f of fs.readdirSync(LANG)) { const m = /^(.+?)(\.lines|\.timeline)?\.json$/.exec(f); if (m) out.add(m[1]); }
  return [...out].sort();
}
export function bundleJs(code) {
  const f = s => path.join(LANG, code + s);
  const data = { ui: strip(readIf(f('.json'))) || {}, lines: strip(readIf(f('.lines.json'))), timeline: strip(code === 'en' ? enTimeline() : readIf(f('.timeline.json'))) };
  return '// Made by tools/gen/site-lang.mjs from site/lang/' + code + '.json, .lines.json and .timeline.json: do not edit by hand.\n'
    + '(window.SITE_LANG_DATA = window.SITE_LANG_DATA || {})[' + JSON.stringify(code) + '] = ' + JSON.stringify(data) + ';\n';
}
export function build(codes) {
  fs.writeFileSync(path.join(LANG, 'languages.js'), languagesJs());
  fs.writeFileSync(path.join(LANG, 'en.timeline.json'), JSON.stringify(enTimeline(), null, 2) + '\n');
  const list = codes && codes.length ? codes : codesWithFiles();
  for (const c of list) fs.writeFileSync(path.join(LANG, c + '.js'), bundleJs(c));
  return list;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const done = build(process.argv.slice(2));
  console.log('site/lang: languages.js, en.timeline.json and ' + done.length + ' language script(s): ' + done.join(' '));
}
