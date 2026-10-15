/* ---------- languages (AIG-124, AIG-487): every screen text lives in public/lang/<code>.json (see docs/i18n.md) ---------- */
// t('card.accept') gives the text in the chosen language, then English, then the key itself (so a missing
// string shows up as its key and never as a blank). {name} placeholders are filled from vars (not escaped:
// callers esc() user data). Keys ending in .html hold markup. {{dev:word}} marks a developer word for the
// glossary card; for now it renders as the word itself. A value may be a plural object { one, few, other, ... }:
// Intl.PluralRules picks the form for vars.count in the language's locale (AIG-487).
// public/lang/languages.json lists every language (code, picker label, own name, Intl locale, dir, region/notRegion/base, fun).
// Only the ones whose file is in count (GET /api/langs), so translations can arrive one at a time.
let LANG_LIST = [{ code: 'en', label: 'EN', name: 'English', locale: 'en-GB' }];
const LANGS = { en: 'English' };   // code -> own name, for the languages whose file is in
// AIG-528: ← and → mean previous and next in left-to-right writing, and the other way round in right-to-left.
// Gives 1 for next, -1 for previous, 0 for any other key.
const arrowStep = e => { const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; return document.documentElement.dir === 'rtl' ? -k : k; };
const i18n = { lang: 'en', locale: 'en-GB', dir: 'ltr', dict: {}, en: {}, ready: false };   // ready: the language file is in, so polls and timers may draw
const langOf = c => LANG_LIST.find(l => l.code === c);
// The language picked in Setup, and the one on screen: English while the quick English switch is flipped (AIG-124).
const ls = k => { try { return localStorage.getItem(k); } catch { return null; } };
// Regions (as LocoRadio): an entry with "region": "BE" is only offered there, "notRegion": "BE" is hidden there. You are in a
// region when a browser language tag names it (nl-BE, en-BE), else by the time zone (Belgium: Europe/Brussels).
// AIG-1286: "anywhere": true (en-US, es-MX, fr-CA, de-CH) is still picked by region, but listed for everyone.
const prefsList = () => { try { return navigator.languages && navigator.languages.length ? [...navigator.languages] : [navigator.language || 'en']; } catch { return ['en']; } };
const tagRegion = p => (String(p).split(/[-_]/).slice(1).find(x => /^[A-Za-z]{2}$/.test(x)) || '').toUpperCase();
const ZONES = { BE: ['Europe/Brussels'], CH: ['Europe/Zurich'],
  US: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Detroit', 'America/Indiana/Indianapolis', 'America/Boise'],
  MX: ['America/Mexico_City', 'America/Monterrey', 'America/Merida', 'America/Cancun', 'America/Chihuahua', 'America/Tijuana', 'America/Hermosillo', 'America/Mazatlan', 'America/Matamoros', 'America/Bahia_Banderas'],
  CA: ['America/Toronto', 'America/Montreal', 'America/Moncton', 'America/Halifax', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Regina', 'America/St_Johns'] };
const inRegion = r => prefsList().some(p => tagRegion(p) === r) || (() => { try { return (ZONES[r] || []).includes(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return false; } })();
const regional = l => (!l.region || l.anywhere || inRegion(l.region)) && !(l.notRegion && inRegion(l.notRegion));
// No pick saved yet (AIG-352): the first device language that has a file, with LocoRadio's fallbacks: nl-BE (or plain nl in
// Belgium) gets Flemish, nl-NL Dutch; zh-Hant/TW/HK/MO Traditional Chinese, pt-BR Brazilian, tl Filipino, nb/nn Norwegian, iw Hebrew.
// Fun languages are never picked by themselves; fr-BE with no French file gets English.
const deviceLang = () => {
  const has = c => LANGS[c] && !(langOf(c) || {}).fun ? c : null;
  for (const p of prefsList()) {
    const c = String(p).toLowerCase().split(/[-_]/)[0], r = tagRegion(p);
    const own = LANG_LIST.find(l => l.region && l.base === c && has(l.code) && (r ? r === l.region : inRegion(l.region)));
    if (own) return own.code;
    if (c === 'zh' && (/hant/i.test(p) || ['TW', 'HK', 'MO'].includes(r)) && has('zh-tw')) return 'zh-tw';
    if (c === 'pt' && r === 'BR' && has('pt-br')) return 'pt-br';
    const alias = { tl: 'fil', nb: 'no', nn: 'no', iw: 'he' }[c];
    if (alias && has(alias)) return alias;
    if (has(c)) return c;
  }
  return 'en';
};
// An explicit pick in Setup always wins over the device language.
const chosenLang = () => { const saved = ls('aigile.lang'); return saved ? (LANGS[saved] ? saved : 'en') : deviceLang(); };
const enSwitch = () => ls('aigile.enSwitch') === '1' && chosenLang() !== 'en';
const langCode = () => immLang() || (enSwitch() && ls('aigile.enNow') === '1' ? 'en' : chosenLang());
// Language immersion (AIG-722..725): the languages you are learning (aigile.learning), a language per weekday (aigile.langDays)
// and a random pick per day (aigile.langRandom). aigile.immNow = '1' while the board is in aigile.immPick. immAuto picks once a day.
const jsonLs = (k, d) => { try { const v = JSON.parse(ls(k)); return v == null ? d : v; } catch { return d; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const learning = () => { const a = jsonLs('aigile.learning', []); return Array.isArray(a) ? a.filter(c => LANGS[c] && c !== chosenLang()) : []; };
const immLang = () => { const p = ls('aigile.immPick'); return ls('aigile.immNow') === '1' && p && LANGS[p] && p !== chosenLang() && learning().includes(p) ? p : null; };
function immAuto() {
  const today = dayKey(); if (ls('aigile.immDay') === today) return;
  lsSet('aigile.immDay', today);
  const L = learning(), days = jsonLs('aigile.langDays', {});
  let pick = days[new Date().getDay()]; if (!L.includes(pick)) pick = null;
  if (!pick && ls('aigile.langRandom') === '1' && L.length) { let h = 0; for (const c of today) h = (h * 31 + c.charCodeAt(0)) >>> 0; pick = L[h % L.length]; }
  if (pick) { lsSet('aigile.immPick', pick); lsSet('aigile.immNow', '1'); lsSet('aigile.enNow', null); } else lsSet('aigile.immNow', null);
}
// Dates and times use the language's Intl locale (pass i18n.locale to toLocale*String); English follows the browser's English
// region (en-US, en-AU...), else British.
const localeOf = c => { if (c !== 'en') return (langOf(c) || {}).locale || c; const p = prefsList().find(x => /^en[-_][a-z]{2}$/i.test(x)); return p ? 'en-' + tagRegion(p) : 'en-GB'; };
// A text the server sends in English (Setup labels, permission ticks): the language file's version when there is one (AIG-174).
const tk = (key, fallback, vars) => (i18n.dict[key] ?? i18n.en[key]) != null ? t(key, vars) : fallback;
const pluralRules = {};
const plural = (v, vars) => {
  let cat = 'other';
  try { cat = (pluralRules[i18n.locale] = pluralRules[i18n.locale] || new Intl.PluralRules(i18n.locale)).select(Number(vars && vars.count != null ? vars.count : 1)); } catch {}
  return v[cat] ?? v.other ?? '';
};
function t(key, vars) {
  // No AI, ever (AIG-583): a key with a .noai twin reads that one while the choice is on.
  if (i18n.noai && key.slice(-5) !== '.noai') { const alt = i18n.dict[key + '.noai'] ?? i18n.en[key + '.noai']; if (alt != null) key += '.noai'; }
  let s = i18n.dict[key] ?? i18n.en[key] ?? key;
  if (s && typeof s === 'object') s = plural(s, vars);
  s = String(s);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
  return s.replace(/\{\{dev:([^}]+)\}\}/g, '$1');
}
const getJson = async url => { try { const r = await fetch(url); return r.ok ? await r.json() : {}; } catch { return {}; } };
// The files the page can't do without (AIG-517): a failed fetch, a 503 mid-update or a half-written file throws, so start-up retries.
const needJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); };
// Whose file is in: the server lists the files that parse; an older server (before a restart) has no list, so the files that answer as JSON count.
async function langFiles() {
  const r = await getJson('/api/langs');
  if (Array.isArray(r.codes)) return r.codes;
  const probe = await Promise.all(LANG_LIST.map(l => fetch('/lang/' + l.code + '.json', { method: 'HEAD' }).then(x => x.ok && /json/.test(x.headers.get('content-type') || '') ? l.code : null, () => null)));
  return probe.filter(Boolean);
}
// Loads the language list, English (the fallback) and the chosen language; runs before the first render.
async function loadLang() {
  const list = await needJson('/lang/languages.json');
  if (Array.isArray(list) && list.some(l => l && l.code === 'en')) LANG_LIST = list.filter(l => l && /^[a-z0-9]{2,12}(-[a-z]{2,4})?$/i.test(l.code || ''));
  const files = await langFiles();
  for (const l of LANG_LIST) if (l.code === 'en' || files.includes(l.code)) LANGS[l.code] = l.name;
  immAuto();
  i18n.lang = langCode();
  i18n.en = await needJson('/lang/en.json');
  i18n.dict = i18n.lang === 'en' ? i18n.en : await needJson('/lang/' + i18n.lang + '.json');
  i18n.locale = localeOf(i18n.lang);
  i18n.dir = (langOf(i18n.lang) || {}).dir === 'rtl' ? 'rtl' : 'ltr';
  // <html lang>: the code, or the locale when it says more (pt-br -> pt-BR, no -> nb-NO); <html dir> mirrors the layout (the CSS uses logical properties).
  const loc = i18n.locale.split('-u-')[0];
  document.documentElement.lang = loc.split('-')[0] === i18n.lang ? i18n.lang : loc;
  document.documentElement.dir = i18n.dir;
  // Static text in index.html: data-i18n (text), data-i18n-title, data-i18n-label.
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  paintEnBtn(); paintImm();
  // AIG-976: the 🐣 tag's tooltip ends with the version, so a friend can say which build they have (asked once, not awaited).
  (i18n.version ? Promise.resolve(i18n.version) : fetch('/api/version').then(r => r.ok ? r.json() : {}).then(j => (i18n.version = j.version)))
    .then(v => { const el = document.querySelector('.alpha-tag'); if (el && v) el.title = t('alpha.tip') + ' · v' + v; }).catch(() => {});
  i18n.ready = true;
  saveLang();
}
// The server writes some lines the owner reads (chat notes, demo cards, errors): tell it the chosen language, once per change (AIG-488).
function saveLang() {
  const l = chosenLang();
  if (ls('aigile.langSaved') === l) return;
  try { api('POST', '/api/setup', { prefs: { lang: l } }).then(() => { try { localStorage.setItem('aigile.langSaved', l); } catch {} }, () => {}); } catch {}
}
// Quick English switch (AIG-124): a small top-bar button (🌐 and the label) flips between your language and English in one click.
function paintEnBtn() {
  const b = document.getElementById('enBtn'); if (!b) return;
  b.hidden = !enSwitch();
  b.textContent = '🌐 ' + (i18n.lang === 'en' ? (langOf(chosenLang()) || { label: chosenLang().toUpperCase() }).label : 'EN');
  b.title = t(i18n.lang === 'en' ? 'lang.en.back' : 'lang.en.title', { name: LANGS[chosenLang()] });
}
async function toggleEn() {
  if (typeof okToLeave === 'function' && !(await okToLeave(t('lang.switch')))) return;
  try { i18n.lang === 'en' ? localStorage.removeItem('aigile.enNow') : localStorage.setItem('aigile.enNow', '1'); localStorage.removeItem('aigile.immNow'); } catch {}
  location.reload();
}
// The 🌍 button (AIG-723): one tap flips the board into your learning language, another goes back; with more than one, ▾ lists them.
function paintImm() {
  const w = document.getElementById('immWrap'), b = document.getElementById('immBtn'); if (!w || !b) return;
  const L = learning(); w.hidden = !L.length; if (!L.length) return;
  const on = immLang(), pick = ls('aigile.immPick'), tgt = on || (L.includes(pick) ? pick : L[0]);
  const lab = c => (langOf(c) || { label: c.toUpperCase() }).label;
  b.textContent = '🌍 ' + lab(on ? chosenLang() : tgt);
  b.title = t(on ? 'imm.back' : 'imm.title', { name: on ? LANGS[chosenLang()] : LANGS[tgt] });
  const more = document.getElementById('immMore'), list = document.getElementById('immList');
  more.hidden = L.length < 2; more.title = more.ariaLabel = t('imm.menu');
  list.setAttribute('aria-label', t('imm.menu'));
  list.innerHTML = L.map(c => `<button type="button" lang="${esc(c)}" dir="auto" data-imm="${esc(c)}" ${c === on ? 'aria-current="true"' : ''}>${esc(LANGS[c])}</button>`).join('') + (on ? `<button type="button" data-imm="">${esc(t('imm.back', { name: LANGS[chosenLang()] }))}</button>` : '');
}
async function immGo(code) {
  if (typeof okToLeave === 'function' && !(await okToLeave(t('lang.switch')))) return;
  lsSet('aigile.enNow', null);
  if (code) { lsSet('aigile.immPick', code); lsSet('aigile.immNow', '1'); } else lsSet('aigile.immNow', null);
  location.reload();
}
function toggleImm() { const L = learning(), p = ls('aigile.immPick'); immGo(immLang() ? '' : (L.includes(p) ? p : L[0])); }
function immMenu(close) {
  const list = document.getElementById('immList'), more = document.getElementById('immMore'); if (!list) return;
  const open = close === true ? false : list.hidden;
  list.hidden = !open; more.setAttribute('aria-expanded', String(open));
  if (open) (list.querySelector('[aria-current]') || list.querySelector('button')).focus(); else if (close === 'focus') more.focus();
}
document.addEventListener('click', e => {
  const list = document.getElementById('immList'); if (!list || list.hidden) return;
  const pick = e.target.closest('#immList button');
  if (pick) immGo(pick.dataset.imm); else if (!e.target.closest('#immMore')) immMenu(true);
});
document.addEventListener('keydown', e => { const l = document.getElementById('immList'); if (e.key === 'Escape' && l && !l.hidden) { e.stopPropagation(); immMenu('focus'); } }, true);
function setEnSwitch(on) {
  try { if (on) localStorage.setItem('aigile.enSwitch', '1'); else { localStorage.removeItem('aigile.enSwitch'); localStorage.removeItem('aigile.enNow'); } } catch {}
  if (!on && i18n.lang !== chosenLang()) { location.reload(); return; }
  paintEnBtn();
}
// The language picker (Setup, the setup wizard; AIG-487, as LocoRadio's): a 🌐 button with the label opens every language by its
// own name: the device language first, English second, the rest in languages.json order, the fun ones last.
// Only languages whose file is in, for your region; the current one always. fn: what a pick calls (setLang, or the wizard's advLang).
function langPickHtml(cls, fn = 'setLang') {
  const cur = langOf(chosenLang()) || LANG_LIST[0], first = deviceLang();
  const rank = l => l.fun ? 3 : l.code === first ? 0 : l.code === 'en' ? 1 : 2;
  const shown = LANG_LIST.filter(l => LANGS[l.code] && (l.code === cur.code || regional(l))).map((l, i) => [rank(l), i, l]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  const item = (l, i) => `${l.fun && !(shown[i - 1] || {}).fun ? `<div class="langfun" role="presentation">${esc(t('lang.fun'))}</div>` : ''}<button type="button" lang="${esc(l.code)}" dir="auto" data-lang="${esc(l.code)}" data-label="${esc(l.label)}" ${l.code === cur.code ? 'aria-current="true"' : ''}>${esc(l.name)}</button>`;
  return `<div class="langwrap lang-pick ${cls || ''}" data-fn="${fn}"><button type="button" class="langbtn" aria-haspopup="true" aria-expanded="false" title="${esc(t('lang.title'))}" aria-label="${esc(t('lang.title') + ': ' + cur.name)}"><span aria-hidden="true">🌐</span><span class="langlab">${esc(cur.label)}</span><span class="langarrow" aria-hidden="true">▾</span></button><div class="langlist" hidden aria-label="${esc(t('lang.title'))}">${shown.map(item).join('')}</div></div>`;
}
// Opening and closing the list: Esc, an outside click, choosing or tabbing out closes it; arrows, Home and End move; focus goes back to the button.
function langClose(list, focus) {
  if (!list || list.hidden) return;
  list.hidden = true; list.previousElementSibling.setAttribute('aria-expanded', 'false');
  if (focus) list.previousElementSibling.focus();
}
document.addEventListener('click', e => {
  const btn = e.target.closest('.langbtn'), pick = e.target.closest('.langlist button');
  document.querySelectorAll('.langlist:not([hidden])').forEach(l => { if (!l.parentNode.contains(e.target)) langClose(l); });
  if (btn) {
    e.preventDefault();
    const list = btn.nextElementSibling;
    if (!list.hidden) return langClose(list, true);
    list.hidden = false; btn.setAttribute('aria-expanded', 'true');
    (list.querySelector('[aria-current]') || list.querySelector('button')).focus();
  } else if (pick) {
    e.preventDefault();
    const wrap = pick.closest('.langwrap');
    langClose(wrap.querySelector('.langlist'), true);
    (wrap.dataset.fn === 'advLang' ? advLang : setLang)(pick.dataset.lang);
  }
});
document.addEventListener('keydown', e => {
  const list = e.target.closest && e.target.closest('.langlist'); if (!list) return;
  const items = [...list.querySelectorAll('button')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); langClose(list, true); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
  else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
}, true);
document.addEventListener('focusin', e => { document.querySelectorAll('.langlist:not([hidden])').forEach(l => { if (!l.parentNode.contains(e.target)) langClose(l); }); });
// A page of text built from strings is simplest to redo in full, so a change reloads (after asking, if something is unsent).
async function setLang(l) {
  if (!LANGS[l] || l === chosenLang()) return;
  if (typeof okToLeave === 'function' && !(await okToLeave(t('lang.switch')))) return;
  try { localStorage.setItem('aigile.lang', l); localStorage.removeItem('aigile.enNow'); } catch {}
  location.reload();
}
