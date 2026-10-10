/* ---------- languages (AIG-124): every screen text lives in public/lang/<code>.json ---------- */
// t('card.accept') gives the text in the chosen language, then English, then the key itself (so a missing
// string shows up as its key and never as a blank). {name} placeholders are filled from vars (not escaped:
// callers esc() user data). Keys ending in .html hold markup. {{dev:word}} marks a developer word for the
// glossary card; for now it renders as the word itself.
const LANGS = { en: 'English', nl: 'Nederlands', 'nl-BE': 'Vlaams' };
const i18n = { lang: 'en', dict: {}, en: {}, ready: false };   // ready: the language file is in, so polls and timers may draw
const langCode = () => { let l = 'en'; try { l = localStorage.getItem('aigile.lang') || 'en'; } catch {} return LANGS[l] ? l : 'en'; };
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
  document.querySelectorAll('.lang-pick').forEach(el => { el.value = i18n.lang; });
  i18n.ready = true;
}
// The language <select> (header and Setup page).
const langPickHtml = cls => `<select class="lang-pick ${cls || ''}" onchange="setLang(this.value)" title="${esc(t('lang.title'))}" aria-label="${esc(t('lang.title'))}">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === i18n.lang ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
// A page of text built from strings is simplest to redo in full, so a change reloads (after asking, if something is unsent).
function setLang(l) {
  if (!LANGS[l] || l === i18n.lang) return;
  if (typeof okToLeave === 'function' && !okToLeave(t('lang.switch'))) { document.querySelectorAll('.lang-pick').forEach(el => { el.value = i18n.lang; }); return; }
  try { localStorage.setItem('aigile.lang', l); } catch {}
  location.reload();
}
