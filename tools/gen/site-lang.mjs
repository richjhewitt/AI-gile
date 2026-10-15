#!/usr/bin/env node
// Builds the website's language scripts (AIG-1226) from the JSON files translators edit:
//   site/lang/languages.js    every language the app has (public/lang/languages.json), for the language button
//   site/lang/en.timeline.json the English timeline texts by stage id, from site/timeline.json (the source translators copy)
//   site/lang/<code>.js       <code>.json + <code>.lines.json + <code>.timeline.json in one script (works over https and from a file),
//                             plus the app's dev words (gloss.* in public/lang/<code>.json) for the 📖 Dev words button (AIG-1285)
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
// AIG-1285: the app's dev words in one language, so the site has no second copy to translate. The ids, and the words that
// get no underline, come from public/js/glossary.js; each text is the language's own, else its base language's, else English.
const APP_LANG = path.join(ROOT, 'public', 'lang');
const glossarySrc = () => fs.readFileSync(path.join(ROOT, 'public', 'js', 'glossary.js'), 'utf8');
function glossaryIds(name) {
  const m = new RegExp('const ' + name + ' = \\[([^\\]]*)\\]').exec(glossarySrc());
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
}
// AIG-1296: the groups in order, each with its ids, from: const GLOSS_GROUPS = { build: ['repo', ...], ... };
export function glossaryGroups() {
  const m = /const GLOSS_GROUPS = \{([\s\S]*?)\n\};/.exec(glossarySrc().replace(/\r\n/g, '\n'));
  return m ? [...m[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map(g => ({ id: g[1], ids: [...g[2].matchAll(/'([^']+)'/g)].map(x => x[1]) })) : [];
}
// The dialog's texts, borrowed from the app: button, title, intro, search box, no match, close.
export const WORD_TEXTS = { button: 'scale.words', h: 'gloss.title', intro: 'gloss.about', search: 'gloss.search', none: 'gloss.none', close: 'common.close' };
export function devWords(code) {
  const base = (languages().find(l => l.code === code) || {}).base;
  const files = [code, base, 'en'].filter((c, i, a) => c && a.indexOf(c) === i).map(c => readIf(path.join(APP_LANG, c + '.json'))).filter(Boolean);
  const t = k => { for (const j of files) if (typeof j[k] === 'string' && j[k].trim()) return j[k]; return ''; };
  const noTip = glossaryIds('NO_TIP'), out = {};
  for (const [k, key] of Object.entries(WORD_TEXTS)) out[k] = t(key);
  // AIG-1296: "{count} words" (plural forms) for the search, and the groups: name and ids, every word tagged with its group.
  const tp = k => { for (const j of files) if (j[k] && typeof j[k] === 'object' && j[k].other) return j[k]; return null; };
  out.count = tp('gloss.count');
  const groups = glossaryGroups(), groupOf = {};
  out.groups = groups.map(g => { g.ids.forEach(id => { groupOf[id] = g.id; }); return { id: g.id, name: t('gloss.g.' + g.id) }; });
  out.list = groups.flatMap(g => g.ids).map(id => {
    const w = { id, g: groupOf[id], word: t('gloss.' + id + '.word'), text: t('gloss.' + id + '.text') }, also = t('gloss.' + id + '.also');
    if (also) w.also = also.split(',').map(x => x.trim()).filter(Boolean);
    if (noTip.includes(id)) w.noTip = 1;
    return w;
  }).filter(w => w.word && w.text);
  return out;
}
export function bundleJs(code) {
  const f = s => path.join(LANG, code + s);
  const data = { ui: strip(readIf(f('.json'))) || {}, lines: strip(readIf(f('.lines.json'))), timeline: strip(code === 'en' ? enTimeline() : readIf(f('.timeline.json'))), words: devWords(code) };
  return '// Made by tools/gen/site-lang.mjs from site/lang/' + code + '.json, .lines.json, .timeline.json and the dev words in public/lang: do not edit by hand.\n'
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
