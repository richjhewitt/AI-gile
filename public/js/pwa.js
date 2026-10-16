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

// AIG-1275 / AIG-1276: the home-screen icon's long-press shortcuts (/?launch=new|inbox|messages) and "Share to AI-gile" from another
// phone app (/?share=1&title=&text=&url=, a GET share target in manifest.webmanifest). Both are plain page loads, so the phone
// auth guard (server.js guardPhone: paired cookie) already covers them; the card itself is made by the usual dialog and POST.
(() => {
  const q = new URLSearchParams(location.search);
  // the phone's share sheet sends only title/text/url, so any of them (or share) means a share (AIG-1275)
  const launch = q.get('launch'), share = ['share', 'title', 'text', 'url'].some(k => q.has(k)) ? { title: (q.get('title') || '').trim(), text: (q.get('text') || '').trim(), url: (q.get('url') || '').trim() } : null;
  if (!share && !['new', 'inbox', 'messages'].includes(launch)) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch {}   // the shared text never stays in the address bar or history
  const parts = share ? [share.text, share.url].filter((x, i, a) => x && a.indexOf(x) === i) : [];
  const preset = share ? { title: (share.title || (share.text || share.url).split(/\r?\n/)[0]).slice(0, 120), description: parts.join('\n\n') } : null;
  let tries = 0;
  const go = () => {
    if (!(typeof i18n !== 'undefined' && i18n.ready && typeof state !== 'undefined' && state.route && typeof newCard === 'function')) { if (++tries < 150) setTimeout(go, 200); return; }
    if (share || launch === 'new') newCard(preset || {});
    else if (launch === 'inbox') location.hash = '#/inbox';
    else { const b = document.querySelector('#dmRail [data-dms]'); if (b) b.click(); else if (++tries < 150) setTimeout(go, 200); }   // the rail can paint after the page (one bundle, AIG-1393): wait for it
  };
  go();
})();
