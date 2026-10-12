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
