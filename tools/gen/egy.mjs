// Generates public/lang/egy.json (Egyptian hieroglyphs, a fun language) from en.json.
// Usage: node tools/gen/egy.mjs
import fs from 'node:fs';
const en = JSON.parse(fs.readFileSync('public/lang/en.json', 'utf8'));

const SKIP = ['AI-gile','Claude','Opus','Sonnet','Haiku','GitHub','Git','VS Code','Discord','Giphy','Windows','Electron','npm','Node','Segoe'];
const U = { a:'𓄿', b:'𓃀', k:'𓎡', d:'𓂧', i:'𓇋', f:'𓆑', g:'𓎼', h:'𓉔', t:'𓏏', n:'𓈖', p:'𓊪', r:'𓂋', s:'𓋴', w:'𓅱', y:'𓇌', ch:'𓍿', sh:'𓈙', kh:'𓐍', j:'𓆓', q:'𓈎', m:'𓅓', l:'𓃭' };

// meaning dictionary: determinatives appended after the phonetic spelling
const GROUPS = [
 ['𓉐','home house room rooms project projects folder folders workspace app page site board place'],
 ['𓂋','say comment comments reply message messages chat talk tell told speak ask note notes mention voice read'],
 ['𓏞','write edit new add create rename change update setup settings save draft drafts'],
 ['𓁹','view show see look watch preview open find search check review test seen'],
 ['𓈖','water wait loading load sync refresh live flow stream'],
 ['𓀀','user users person people team member members you your me my who man owner'],
 ['𓁐','she her woman'],
 ['𓂻','go run running start move next back skip walk step drag drop'],
 ['𓂝','take give send pick choose select copy paste apply press click set hold'],
 ['𓏛','card cards list lists text file files doc docs log history report notes paper scroll'],
 ['𓇳','day today daily now time date morning sun clock hour hours'],
 ['𓇯','sky night tomorrow yesterday week month year later soon'],
 ['𓊹','claude god agent agents bot bots assistant ai model'],
 ['𓋹','life done ok yes good great ready alive healthy happy success complete finished'],
 ['𓆣','bug bugs error errors fail failed failure problem broken oops warning'],
 ['𓂀','watching guard protect safe lock locked secure private key password token'],
 ['𓏤','one single item items count number total all each every'],
 ['𓇾','land place folder directory path map branch branches repo repository'],
 ['𓃀','body copy head'],
 ['𓅃','fast quick speed top high up pin pinned important priority'],
 ['𓆼','busy work working doing task tasks job jobs'],
 ['𓌳','tool tools config option options mode theme language colour color'],
 ['𓏏','no not none never stop cancel close remove delete clear hide off disable disabled'],
];
const DICT = {};
for (const [g, ws] of GROUPS) for (const w of ws.split(' ')) if (!DICT[w]) DICT[w] = g;

function translit(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  let out = '', i = 0, last = '';
  const put = (k) => { if (k !== last) out += U[k]; last = k; };
  while (i < w.length) {
    const c = w[i], d = w.slice(i, i + 2), nx = w[i + 1];
    const first = i === 0;
    if (d === 'sh') { put('sh'); i += 2; continue; }
    if (d === 'ch') { put('ch'); i += 2; continue; }
    if (d === 'kh') { put('kh'); i += 2; continue; }
    if (d === 'ph') { put('f'); i += 2; continue; }
    if (d === 'ck') { put('k'); i += 2; continue; }
    if (d === 'th') { put('t'); put('h'); i += 2; continue; }
    if (d === 'wh') { put('w'); i += 2; continue; }
    if (d === 'kn' && first) { put('n'); i += 2; continue; }
    if (d === 'qu') { put('q'); put('w'); i += 2; continue; }
    if (c === 'c') { put(/[eiy]/.test(nx || '') ? 's' : 'k'); i++; continue; }
    if (c === 'x') { put('k'); put('s'); i++; continue; }
    if (c === 'z') { put('s'); i++; continue; }
    if (c === 'v') { put('f'); i++; continue; }
    if (c === 'u' || c === 'o') { put('w'); i++; continue; }
    if (c === 'e') { if (first || w.length <= 3) put('i'); i++; continue; }
    if (c === 'a' || c === 'i') { if (first || !/[aeiou]/.test(w[i - 1] || '')) put(c); i++; continue; }
    if (U[c]) { put(c); i++; continue; }
    i++;
  }
  return out;
}

function word(wd) {
  const key = wd.toLowerCase().replace(/'s$/, '');
  const base = translit(wd);
  const det = DICT[key] || (key.endsWith('s') && DICT[key.slice(0, -1)]) || (key.endsWith('ing') && DICT[key.slice(0, -3)]) || (key.endsWith('ed') && DICT[key.slice(0, -2)]) || '';
  return base + det;
}

const esc = (s) => s.split('').map(c => '.+?^$(){}[]|'.includes(c) ? '[' + c + ']' : c).join('');
const PROTECT = new RegExp([
  /\{\{dev:([^}]*)\}\}/.source, /\{[A-Za-z0-9_.]+\}/.source, /`[^`]*`/.source, /<[^>]*>/.source, /&[a-z#0-9]+;/.source,
  /https?:\/\/\S+/.source, /\b[A-Z]{2,6}-\d+\b/.source, /\b[\w.-]+\.(?:json|js|mjs|md|html|css|txt|cmd|bat|ps1)\b/.source,
  '\\b(?:' + SKIP.map(esc).join('|') + ')\\b',
  /\bnode [\w.\/-]+/.source,
].join('|'), 'g');
const WORD = /[A-Za-z]+(?:'[a-z]+)?/g;

function plain(s) { return s.replace(WORD, word); }
function tr(s) {
  let out = '', pos = 0, m;
  PROTECT.lastIndex = 0;
  while ((m = PROTECT.exec(s))) {
    out += plain(s.slice(pos, m.index));
    out += m[1] !== undefined ? '{{dev:' + plain(m[1]) + '}}' : m[0];
    pos = m.index + m[0].length;
  }
  return out + plain(s.slice(pos));
}

const out = {};
for (const [k, v] of Object.entries(en)) {
  if (typeof v === 'string') out[k] = tr(v);
  else out[k] = Object.fromEntries(Object.entries(v).map(([f, s]) => [f, tr(s)]));
}
fs.writeFileSync('public/lang/egy.json', JSON.stringify(out, null, 2) + '\n');
console.log(Object.keys(out).length, 'keys');
