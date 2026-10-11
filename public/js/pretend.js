/* ---------- pretend friend (AIG-322/323) ---------- */
// On the pretend board ("Davy", started from Setup on the real one): a bar on every page that says whose board this is, so the two windows
// never get mixed up, and Flemish unless a language was already picked here. Runs before app.js loads the language.
(function () {
  let me = null;
  try {
    const x = new XMLHttpRequest(); x.open('GET', '/api/pretend', false); x.send();
    const j = JSON.parse(x.responseText || '{}'); me = j.me ? j : null;
  } catch {}
  if (!me) return;
  try { if (!localStorage.getItem('aigile.lang')) localStorage.setItem('aigile.lang', me.lang || 'nl-BE'); } catch {}
  const bar = document.createElement('div');
  bar.id = 'pretendBar'; bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#f5a623;color:#222;font:600 14px system-ui,sans-serif;text-align:center;padding:6px 12px;border-top:2px solid #b36b00';
  const words = () => typeof t === 'function' && typeof i18n !== 'undefined' && i18n.ready ? t('pretend.banner', { name: me.name }) : "You're " + me.name + ' (pretend)';
  const paint = () => { bar.textContent = '🧪 ' + words(); document.title = '🧪 ' + me.name + ' · ' + document.title.replace(/^🧪 [^·]*· /, ''); };
  document.body.appendChild(bar); document.body.style.paddingBottom = '34px';
  paint();
  const iv = setInterval(() => { if (typeof i18n !== 'undefined' && i18n.ready) { clearInterval(iv); paint(); } }, 150);
  setInterval(() => { if (!document.title.startsWith('🧪')) paint(); }, 2000);
})();
