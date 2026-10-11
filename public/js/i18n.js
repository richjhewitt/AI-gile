/* ---------- languages (AIG-124): every screen text lives in public/lang/<code>.json ---------- */
// t('card.accept') gives the text in the chosen language, then English, then the key itself (so a missing
// string shows up as its key and never as a blank). {name} placeholders are filled from vars (not escaped:
// callers esc() user data). Keys ending in .html hold markup. {{dev:word}} marks a developer word for the
// glossary card; for now it renders as the word itself.
const LANGS = { en: 'English', nl: 'Nederlands', 'nl-BE': 'Vlaams' };
const i18n = { lang: 'en', dict: {}, en: {}, ready: false };   // ready: the language file is in, so polls and timers may draw
// The language picked in Setup, and the one on screen: English while the quick English switch is flipped (AIG-124).
const ls = k => { try { return localStorage.getItem(k); } catch { return null; } };
const chosenLang = () => { const l = ls('aigile.lang') || 'en'; return LANGS[l] ? l : 'en'; };
const enSwitch = () => ls('aigile.enSwitch') === '1' && chosenLang() !== 'en';
const langCode = () => enSwitch() && ls('aigile.enNow') === '1' ? 'en' : chosenLang();
function t(key, vars) {
  let s = i18n.dict[key] ?? i18n.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
  return s.replace(/\{\{dev:([^}]+)\}\}/g, '$1');
}
const getJson = async url => { try { const r = await fetch(url); return r.ok ? await r.json() : {}; } catch { return {}; } };
// Loads English (the fallback) and the chosen language; runs before the first render.
async function loadLang() {
  i18n.lang = langCode();
  i18n.en = await getJson('/lang/en.json');
  i18n.dict = i18n.lang === 'en' ? i18n.en : await getJson('/lang/' + i18n.lang + '.json');
  document.documentElement.lang = i18n.lang;
  // Static text in index.html: data-i18n (text), data-i18n-title, data-i18n-label.
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  document.querySelectorAll('.lang-pick').forEach(el => { el.value = chosenLang(); });
  paintEnBtn();
  i18n.ready = true;
}
// Quick English switch (AIG-124): a small top-bar button flips between your language and English.
function paintEnBtn() {
  const b = document.getElementById('enBtn'); if (!b) return;
  b.hidden = !enSwitch();
  b.textContent = '🌐 ' + (i18n.lang === 'en' ? chosenLang().split('-')[0].toUpperCase() : 'EN');
  b.title = t(i18n.lang === 'en' ? 'lang.en.back' : 'lang.en.title', { name: LANGS[chosenLang()] });
}
function toggleEn() {
  if (typeof okToLeave === 'function' && !okToLeave(t('lang.switch'))) return;
  try { i18n.lang === 'en' ? localStorage.removeItem('aigile.enNow') : localStorage.setItem('aigile.enNow', '1'); } catch {}
  location.reload();
}
function setEnSwitch(on) {
  try { if (on) localStorage.setItem('aigile.enSwitch', '1'); else { localStorage.removeItem('aigile.enSwitch'); localStorage.removeItem('aigile.enNow'); } } catch {}
  if (!on && i18n.lang !== chosenLang()) { location.reload(); return; }
  paintEnBtn();
}
// The language <select> (Setup page).
const langPickHtml = cls => `<select class="lang-pick ${cls || ''}" onchange="setLang(this.value)" title="${esc(t('lang.title'))}" aria-label="${esc(t('lang.title'))}">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === chosenLang() ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
// A page of text built from strings is simplest to redo in full, so a change reloads (after asking, if something is unsent).
function setLang(l) {
  if (!LANGS[l] || l === chosenLang()) return;
  if (typeof okToLeave === 'function' && !okToLeave(t('lang.switch'))) { document.querySelectorAll('.lang-pick').forEach(el => { el.value = chosenLang(); }); return; }
  try { localStorage.setItem('aigile.lang', l); localStorage.removeItem('aigile.enNow'); } catch {}
  location.reload();
}
