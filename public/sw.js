// AI-gile service worker (AIG-410): lets the board install to a phone's home screen.
// It keeps a copy of the app shell (the page, CSS, JS, languages) only to open when the network is down.
// Network first, always: a new build is never hidden behind an old copy. /api/ is never touched, so no board data is ever cached.
const SHELL = 'aigile-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;   // the browser handles it as usual
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req.mode === 'navigate' ? '/' : req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then(hit => hit || Response.error()))
  );
});
