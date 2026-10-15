/* ---------- install to the home screen (AIG-410) ---------- */
// The service worker only makes the board installable; it never holds board data (see public/sw.js).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
// ❓ Help → "Add to home screen": a short hint for each kind of phone.
function installHint() {
  openDialog(`<h2>${esc(t('pwa.h'))}</h2><p class="muted">${esc(t('pwa.intro'))}</p>
    <p><b>${esc(t('pwa.ios'))}</b><br>${esc(t('pwa.ios.how'))}</p>
    <p><b>${esc(t('pwa.android'))}</b><br>${esc(t('pwa.android.how'))}</p>
    <p class="muted"><small>${esc(t('pwa.note'))}</small></p>
    <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
}

// AIG-1199: a phone's keyboard covers the input you tapped (a chat box sits at the bottom edge): once it is up, scroll the box into view
(() => {
  if (!window.visualViewport || !window.matchMedia || !matchMedia('(hover: none)').matches) return;
  let last = null;
  const show = () => { if (last && document.activeElement === last) { try { last.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch {} } };
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('textarea, input[type=text], input[type=search], input:not([type])')) { last = e.target; setTimeout(show, 350); } });
  visualViewport.addEventListener('resize', show);
})();
