/* ---------- shared page reads and visibility-aware timers ---------- */
// Revision checks are shared by all pollers in this window. Pop-outs invalidate each other's
// caches after an owner action; no board data is copied through browser storage.
const PagePoll = (() => {
  const reads = new Map(), flights = new Map(), signatures = new WeakMap();
  const SAFETY_MS = 30000, REV_MS = 3000;
  let epoch = 0, rev = null, revAt = 0, revFlight = null, retryRevAt = 0;
  function fingerprint(text) {
    // waitingMs is a clock, not a board change. Hash the downloaded text once, never
    // stringify all the cards on an idle tick. Two accumulators also cover equal lengths.
    text = text.replace(/"waitingMs"\s*:\s*\d+(?:\.\d+)?/g, '"waitingMs":0');
    let a = 2166136261, b = 5381;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c; }
    return text.length + ':' + (a >>> 0) + ':' + (b >>> 0);
  }
  function invalidate(broadcast = true) {
    epoch++;
    if (broadcast) try { localStorage.setItem('aigile.pageChange', Date.now() + ':' + Math.random()); } catch {}
  }
  window.addEventListener('storage', e => { if (e.key === 'aigile.pageChange') invalidate(false); });
  async function request(method, url, body) {
    const key = epoch + ':' + url;
    if (method === 'GET' && flights.has(key)) return flights.get(key);
    const work = (async () => {
      const r = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { throw new Error(r.statusText || 'Invalid response'); }
      if (!r.ok) throw new Error(j.error || r.statusText);
      if (j && typeof j === 'object') signatures.set(j, fingerprint(text));
      if (method !== 'GET') invalidate();
      return j;
    })();
    if (method !== 'GET') return work;
    flights.set(key, work);
    try { return await work; } finally { if (flights.get(key) === work) flights.delete(key); }
  }
  async function revision() {
    const now = Date.now();
    const cadence = typeof location !== 'undefined' && (/^#\/(?:p|pop)\/[^/]+\/[^/]+/.test(location.hash) || /^#\/(?:inbox$|pop-inbox\/[qkt]$)/.test(location.hash)) ? 1000 : REV_MS;
    if (now < retryRevAt || now - revAt < cadence) return rev;
    if (revFlight) return revFlight;
    revFlight = (async () => {
      try {
        const r = await fetch('/api/rev', { cache: 'no-store' });
        if (r.status === 404) { rev = null; retryRevAt = Date.now() + 60000; return null; }
        if (!r.ok) throw new Error(r.statusText);
        const j = await r.json();
        if (typeof j.rev !== 'string') throw new Error('Invalid revision');
        rev = j.rev; stamps = j.projects || {}; revAt = Date.now(); return rev;
      } catch { rev = null; retryRevAt = Date.now() + REV_MS; return null; }
      finally { revFlight = null; }
    })();
    return revFlight;
  }
  // DMs, shares, friends' questions and the all-hands chat live in data/ subfolders and relay memory, which /api/rev
  // does not see: those keep polling at the caller's pace. A project page waits on that project's own stamp, so a
  // swarm in another project doesn't re-download this one (AIG-920 review).
  const VOLATILE = /^\/api\/(?:dms|shares|ask|chats\/_allhands|discord|twitch|mail)\b/;
  let stamps = {};
  async function tokenFor(url) {
    const r = await revision();
    const m = /^\/api\/projects\/([a-z0-9-]+)$/.exec(url);
    return m && r !== null && stamps[m[1]] ? 'p:' + stamps[m[1]] : r;
  }
  async function get(url, { force = false, revision: useRev = true, maxAge = SAFETY_MS } = {}) {
    const token = useRev && !VOLATILE.test(url) ? await tokenFor(url) : null, generation = epoch, now = Date.now();
    const old = reads.get(url);
    if (old && old.flight && old.epoch === generation) return old.flight;
    // Old servers and volatile endpoints still poll at the caller's interval.
    if (!force && old && old.epoch === generation && now - old.at < maxAge && ((token !== null && old.rev === token) || now - old.at < 1000)) return old.data;
    const entry = { epoch: generation, rev: token, at: now };
    entry.flight = api('GET', url).then(data => {
      entry.data = data; entry.at = Date.now(); delete entry.flight; return data;
    }, e => { if (reads.get(url) === entry) reads.delete(url); throw e; });
    reads.set(url, entry);
    // Bound memory when the owner visits lots of projects/chats.
    if (reads.size > 80) reads.delete(reads.keys().next().value);
    return entry.flight;
  }
  function signature(value) {
    return JSON.stringify(value, (k, v) => k === 'waitingMs' ? undefined :
      v && typeof v === 'object' && signatures.has(v) ? { payload: signatures.get(v) } : v);
  }
  function every(fn, ms, { hidden = 0, immediate = false } = {}) {
    let timer, running = false, stopped = false;
    const schedule = () => { clearTimeout(timer); const delay = document.hidden ? hidden : ms; if (!stopped && delay) timer = setTimeout(tick, delay); };
    async function tick() {
      clearTimeout(timer);
      if (stopped || running) return;
      if (document.hidden && !hidden) return schedule();
      running = true;
      try { await fn(); } catch {} finally { running = false; schedule(); }
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) tick(); else schedule(); };
    document.addEventListener('visibilitychange', visible);
    if (immediate && (!document.hidden || hidden)) tick(); else schedule();
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }
  function remember(data) { if (data && typeof data === 'object' && !signatures.has(data)) signatures.set(data, fingerprint(JSON.stringify(data))); return data; }
  return { get, request, signature, remember, invalidate, every, revision, get generation() { return epoch; } };
})();
