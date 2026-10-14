// Server-side text in the owner's language (AIG-488): the lines the server writes that the owner reads on the page (chat notes,
// assumptions, demo cards, errors). The owner's language is `lang` in aigile.local.json (the page saves it when it changes);
// the strings are the page's own files, public/lang/<code>.json, so translators work in one place. A missing key or file
// falls back to English, then to the key. Lines written for agents (briefs, prompts, CLI output) are not here: they stay English.
// Stands alone (no store.js) so the pretend team program can use it too.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'lang');
const LOCAL = () => process.env.AIGILE_LOCAL || path.join(__dirname, '..', 'aigile.local.json');
const cache = {};   // code -> { at, dict }
function dict(code) {
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code || '')) return {};
  const file = path.join(DIR, code + '.json');
  try {
    const at = fs.statSync(file).mtimeMs, c = cache[code];
    if (c && c.at === at) return c.dict;
    return (cache[code] = { at, dict: JSON.parse(fs.readFileSync(file, 'utf8')) }).dict;
  } catch { return {}; }
}
// The owner's language code, 'en' until the page has saved one.
function lang() { try { return String(JSON.parse(fs.readFileSync(LOCAL(), 'utf8')).lang || 'en'); } catch { return 'en'; } }
// t('key', { n: 3 }, code?): the text in the owner's language (or code), then English, then the key. {name} placeholders as on the page.
function t(key, vars, code) {
  let s = dict(code || lang())[key] ?? dict('en')[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
  return s.replace(/\{\{dev:([^}]+)\}\}/g, '$1');
}
module.exports = { t, lang };
