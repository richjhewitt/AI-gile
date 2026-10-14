/* ---------- 🌿 4:20 alarm (AIG-663, 664, 665) ---------- */
// A cheerful fun feature, off by default. Setup pref fourTwenty: off | day (4:20pm) | ampm (4:20 am and pm) | every (:20 each hour)
// | world (whenever one of the zones below is at 4:20, and it says where). fourTwentyBefore: 0..15 minutes of heads-up.
// Plain clock code in the page, no AI and no server timers. The toast is the app's own; a desktop alert only if the Inbox alerts are on.
// WeedGlance (AIG-665) is a small pop-out window counting down to the next one (#/pop-weed).
const Weed = (() => {
  const LEVELS = ['off', 'day', 'ampm', 'every', 'world'];
  // [lang key suffix, IANA zone]: the places that can be named when the level is "anywhere it's 4:20"
  const ZONES = [['auckland', 'Pacific/Auckland'], ['sydney', 'Australia/Sydney'], ['tokyo', 'Asia/Tokyo'], ['shanghai', 'Asia/Shanghai'], ['bangkok', 'Asia/Bangkok'], ['mumbai', 'Asia/Kolkata'], ['dubai', 'Asia/Dubai'], ['moscow', 'Europe/Moscow'], ['istanbul', 'Europe/Istanbul'], ['johannesburg', 'Africa/Johannesburg'], ['berlin', 'Europe/Berlin'], ['london', 'Europe/London'], ['saopaulo', 'America/Sao_Paulo'], ['newyork', 'America/New_York'], ['chicago', 'America/Chicago'], ['denver', 'America/Denver'], ['losangeles', 'America/Los_Angeles'], ['honolulu', 'Pacific/Honolulu']];
  const MIN = 60000;
  let prefs = { level: 'off', before: 5 }, toastEl = null, lastKey = '', lastSoon = '', cache = null, loadedAt = 0, started = false;
  const fmts = {};
  const fmt = tz => fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }));
  // Minutes since midnight in a zone (null tz = this computer's own clock).
  function mod(ms, tz) {
    if (!tz) { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
    const p = fmt(tz).formatToParts(ms); let h = 0, m = 0;
    for (const x of p) { if (x.type === 'hour') h = +x.value; else if (x.type === 'minute') m = +x.value; }
    return h * 60 + m;
  }
  const is420 = v => v === 4 * 60 + 20 || v === 16 * 60 + 20;
  // The places (zone key, or '' for here) whose clock says 4:20 at this minute for the chosen level; [] = none.
  function hits(level, ms) {
    const here = mod(ms, null);
    if (level === 'day') return here === 16 * 60 + 20 ? [''] : [];
    if (level === 'ampm') return is420(here) ? [''] : [];
    if (level === 'every') return here % 60 === 20 ? [''] : [];
    if (level === 'world') {
      const z = ZONES.filter(([, tz]) => is420(mod(ms, tz))).map(z => z[0]);
      return z.length ? z : is420(here) ? [''] : [];
    }
    return [];
  }
  // The next minute (strictly after this one) that fires, within a bit over a day: { at, places } or null.
  function next(level, from) {
    if (!LEVELS.includes(level) || level === 'off') return null;
    const start = Math.floor(from / MIN) * MIN + MIN;
    for (let i = 0; i <= 1500; i++) { const at = start + i * MIN, places = hits(level, at); if (places.length) return { at, places }; }
    return null;
  }
  const nowMs = () => Date.now();
  const placeName = keys => keys.filter(Boolean).slice(0, 3).map(k => t('fourtwenty.place.' + k)).join(', ');

  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div'); toastEl.id = 'weedToast'; toastEl.className = 'weed-toast'; toastEl.setAttribute('role', 'status');
    toastEl.innerHTML = `<span>${esc(msg)}</span><button type="button" aria-label="${esc(t('common.close'))}" onclick="Weed.dismiss()">✕</button>`;
    document.body.appendChild(toastEl);
    const mine = toastEl; setTimeout(() => { if (toastEl === mine) { mine.remove(); toastEl = null; } }, 12000);
  }
  function dismiss() { if (toastEl) { toastEl.remove(); toastEl = null; } }
  // A desktop alert only when the Inbox alerts are switched on and allowed (the same switch as the Inbox uses).
  function desktop(msg) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || localStorage.getItem('aigile.alerts') !== '1') return;
      const n = new Notification(msg, { tag: 'aigile-420' }); n.onclick = () => { try { window.focus(); } catch {} n.close(); };
    } catch {}
  }
  // Once per minute-event across all open windows of this browser.
  function claim(kind, at) {
    const key = kind + ':' + at;
    try { const raw = localStorage.getItem('aigile.420'); if (raw === key) return false; localStorage.setItem('aigile.420', key); } catch { if (key === lastKey) return false; }
    lastKey = key; return true;
  }
  function check() {
    if (location.hash.startsWith('#/pop-') || prefs.level === 'off') return;
    const now = nowMs(), minute = Math.floor(now / MIN) * MIN, hit = hits(prefs.level, now);
    if (hit.length) {
      if (claim('go', minute)) { const where = placeName(hit); const msg = where ? t('fourtwenty.toast.at', { place: where }) : t('fourtwenty.toast'); toast(msg); desktop(msg); }
      return;
    }
    if (prefs.before > 0) {
      const ev = next(prefs.level, now);
      if (ev && ev.at - now <= prefs.before * MIN && claim('soon', ev.at)) {
        const n = Math.max(1, Math.ceil((ev.at - now) / MIN)), where = placeName(ev.places);
        toast(where ? t('fourtwenty.soon.at', { n, place: where }) : t('fourtwenty.soon', { n }));
      }
    }
  }

  function applyPrefs(p) {
    const level = LEVELS.includes(p.fourTwenty) ? p.fourTwenty : 'off', b = parseInt(p.fourTwentyBefore, 10);
    prefs = { level, before: b >= 0 && b <= 15 ? b : 5 }; cache = null;
    const btn = document.getElementById('weedBtn'); if (btn) btn.classList.toggle('wd-off', level === 'off');
  }
  async function sync() {
    try { const s = await api('GET', '/api/setup'); state.setup = s; applyPrefs(s.prefs || {}); } catch {}
    loadedAt = nowMs();
  }
  function tick() {
    if (nowMs() - loadedAt > 10000) { loadedAt = nowMs(); sync(); }
    check(); paintPop();
  }
  function start() { if (started) return; started = true; sync(); setInterval(tick, 1000); }

  // WeedGlance: the countdown window.
  const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  function target() {
    const now = nowMs();
    if (!cache || cache.level !== prefs.level || cache.ev === null || cache.ev.at <= now) cache = { level: prefs.level, ev: next(prefs.level, now) };
    return cache.ev;
  }
  function popBody() {
    if (prefs.level === 'off') return `<p class="muted" id="weedOff">${esc(t('weed.off'))}</p>`;
    const ev = target(); if (!ev) return '';
    const where = placeName(ev.places);
    return `<div class="weed-lab">${esc(t('weed.next'))} ${esc(t('weed.in'))}</div><div class="weed-count" id="weedCount">${esc(clock(ev.at - nowMs()))}</div>${where ? `<div class="weed-where" id="weedWhere">${esc(t('weed.where', { place: where }))}</div>` : ''}<div class="muted weed-lvl">${esc(t('fourtwenty.lvl.' + prefs.level))}</div>`;
  }
  function paintPop() {
    const box = document.getElementById('weedPop'); if (!box) return;
    const html = popBody(), cnt = document.getElementById('weedCount');
    if (cnt && html.includes('id="weedCount"') && box.dataset.lvl === prefs.level + i18n.lang) { const ev = target(); if (ev) { cnt.textContent = clock(ev.at - nowMs()); const w = document.getElementById('weedWhere'); if (w) w.textContent = t('weed.where', { place: placeName(ev.places) }); } return; }
    box.dataset.lvl = prefs.level + i18n.lang; box.innerHTML = html;
  }
  const popHtml = () => { document.body.classList.add('poplist'); start(); return `<div class="weed-pop" id="weedPop"><h4>${esc(t('weed.h'))}</h4>${popBody()}</div>`; };
  function pop() { window.open('#/pop-weed', 'aigile-weed', 'width=300,height=220'); }

  return { start, sync, check, tick, dismiss, pop, popHtml, next, hits, applyPrefs, get prefs() { return prefs; } };
})();
