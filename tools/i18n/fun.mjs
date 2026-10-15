// Fun languages made by script from en.json (AIG-499): leet, Morse and Aussie English (AIG-330). Re-run after English changes:
//   node tools/i18n/fun.mjs            (all)
//   node tools/i18n/fun.mjs leet
// Only plain words change. Kept as they are: {placeholders}, the {{dev:...}} marker (its word is converted), HTML tags and
// entities, `code`, URLs, card ids, emoji, **bold** markers and the names docs/i18n.md says never to translate.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LANG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'lang');
const KEEP = /(\{\{dev:[^}]*\}\}|\{[^{}]*\}|<[^>]*>|&[#\w]+;|`[^`]*`|https?:\/\/\S+|\b[A-Z][A-Z0-9]*-\d+\b|\b(?:AI-gile|Claude|Opus|Sonnet|Haiku|GitHub|Git|VS Code|Discord|Giphy|Windows|Electron|npm|Node|OBS|Twitch)\b)/g;

const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };
const leet = s => s.replace(/[aeiost]/gi, c => LEET[c.toLowerCase()]);

const MORSE = {
  a: '·−', b: '−···', c: '−·−·', d: '−··', e: '·', f: '··−·', g: '−−·', h: '····', i: '··', j: '·−−−', k: '−·−', l: '·−··', m: '−−',
  n: '−·', o: '−−−', p: '·−−·', q: '−−·−', r: '·−·', s: '···', t: '−', u: '··−', v: '···−', w: '·−−', x: '−··−', y: '−·−−', z: '−−··',
  0: '−−−−−', 1: '·−−−−', 2: '··−−−', 3: '···−−', 4: '····−', 5: '·····', 6: '−····', 7: '−−···', 8: '−−−··', 9: '−−−−·',
};
// A word becomes its letters' codes joined by spaces, words are split by " / "; anything else stays where it was.
const morse = s => s.replace(/(?<=[A-Za-z0-9]) (?=[A-Za-z0-9])/g, ' / ')
  .replace(/[A-Za-z0-9]+/g, w => [...w.toLowerCase()].map(c => MORSE[c]).join(' '));

// Aussie English (AIG-330): plain English with a light twist, a few whole-word swaps (capitals kept).
const AUSSIE = [['Hello', "G'day"], ['Hi', "G'day"], ['friends', 'mates'], ['friend', 'mate'], ['afternoon', 'arvo'], ['breakfast', 'brekkie'],
  ['Thank you', 'Cheers'], ['Thanks', 'Cheers'], ['great', 'ripper'], ['very good', 'bonzer'], ['excellent', 'bonzer'], ['complain', 'whinge'],
  ['tired', 'knackered'], ['presents', 'pressies'], ['sunglasses', 'sunnies'], ['barbecue', 'barbie'], ['mosquito', 'mozzie']];
const cap = (from, to) => (from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
const aussie = s => AUSSIE.reduce((t, [a, b]) => t.replace(new RegExp(`\\b${a}\\b`, 'gi'), m => cap(m, b)), s);

const FUN = { leet, morse, aussie };

function convert(text, fn) {
  return text.split(KEEP).map((part, i) => {
    if (i % 2 === 0) return fn(part);
    const dev = part.match(/^\{\{dev:([^}]*)\}\}$/);
    return dev ? `{{dev:${fn(dev[1])}}}` : part;
  }).join('');
}
const value = (v, fn) => typeof v === 'string' ? convert(v, fn)
  : Object.fromEntries(Object.entries(v).map(([k, s]) => [k, convert(s, fn)]));

const enText = fs.readFileSync(path.join(LANG, 'en.json'), 'utf8');
const eol = enText.includes('\r\n') ? '\r\n' : '\n';
const en = JSON.parse(enText);
for (const code of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FUN)) {
  if (!FUN[code]) { console.error(`No script for ${code} (have: ${Object.keys(FUN).join(', ')})`); process.exit(1); }
  const lines = Object.entries(en).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(value(v, FUN[code]))}`);
  fs.writeFileSync(path.join(LANG, `${code}.json`), `{${eol}${lines.join(`,${eol}`)}${eol}}${eol}`);
  console.log(`${code}.json: ${lines.length} keys`);
}
