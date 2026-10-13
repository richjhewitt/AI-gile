/* ---------- ⏸ Break modes (AIG-824, AIG-837) ----------
   One tap on the home page's ⏸ Break: Vape / meds (10 min) or Shower (30 min). While it lasts the owner's alerts, sound, desktop
   notifications and pop-outs stay quiet (html[data-break], the same kind of switch as data-focus / data-night); the team keeps working.
   The alerts are all raised in this page, so the end time lives in localStorage and a reload keeps the break. Shower also fills
   the window with a calm "Enjoy your shower" screen. QA can shorten the times with localStorage aigile.breakMs (ms for each kind). */
const Break = (() => {
  const KEY = 'aigile.break', MINS = { vape: 10, shower: 30 };
  let cur = null, sig = '';
  const read = () => { try { const b = JSON.parse(localStorage.getItem(KEY) || 'null'); return b && b.until > Date.now() && MINS[b.kind] ? b : null; } catch { return null; } };
  const left = () => {
    const s = Math.max(0, Math.ceil((cur.until - Date.now()) / 1000)), m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  };
  function start(kind) {
    const ms = Number(localStorage.getItem('aigile.breakMs')) || MINS[kind] * 60000;
    try { localStorage.setItem(KEY, JSON.stringify({ kind, from: Date.now(), until: Date.now() + ms })); } catch {}
    if (typeof closeDialog === 'function') closeDialog();
    sync();
  }
  function end() { const was = cur; try { localStorage.removeItem(KEY); } catch {} sync(); if (was) welcome(was); }
  // Back from a break (AIG-825): one line of what the team did meanwhile, from the inbox the page already loads (no AI).
  // A Vape / meds break also offers 💊 Taken; the day's ticks live in localStorage (aigile.meds.<date>), there is no Today place for ticks.
  const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const taken = () => { try { return Number(localStorage.getItem('aigile.meds.' + day())) || 0; } catch { return 0; } };
  function took() { try { localStorage.setItem('aigile.meds.' + day(), String(taken() + 1)); } catch {} paintBack(); }
  const plural = (k, n) => t(k + (n === 1 ? '.one' : '.many'), { n });
  let backB = null;
  // Comments since the break started, on every project card the page can get (not only the inbox ones).
  const notesIn = (cards, since) => { let n = 0; for (const c of cards || []) for (const m of c.comments || []) if (Date.parse(m.at) >= since && !/^(rich|owner)$/i.test(String(m.author || ''))) n++; return n; };
  async function allNotes(since, raw) {
    const slugs = (typeof state !== 'undefined' && state.projects || []).map(p => p.slug), got = new Set();
    const ps = await Promise.all(slugs.map(s => api('GET', '/api/projects/' + s).then(p => { got.add(s); return p; }).catch(() => null)));
    let n = 0;
    for (const p of ps) if (p) n += notesIn(p.cards, since);
    return n + notesIn(raw.filter(c => !got.has(c.project)), since);   // inbox cards of a project that could not be read
  }
  function summary(since, notes) {
    const raw = ((typeof IB !== 'undefined' && IB.raw) || []).filter(c => !c.lifeType), isT = c => c.status === 'verify';
    const tests = raw.filter(isT).length, qs = raw.filter(c => !isT(c) && IB.isQuestion(c)).length;
    const parts = [];
    if (tests) parts.push(plural('break.away.test', tests));
    if (notes) parts.push(plural('break.away.note', notes));
    if (qs) parts.push(plural('break.away.q', qs));
    return parts.length ? t('break.away', { parts: parts.join(', ') }) : t('break.away.none');
  }
  async function welcome(b) {
    try { if (typeof IB !== 'undefined' && IB.load) await IB.load(); } catch {}
    let notes = 0;
    try { notes = await allNotes(b.from || 0, ((typeof IB !== 'undefined' && IB.raw) || []).filter(c => !c.lifeType)); } catch {}
    backB = { kind: b.kind, line: summary(b.from || 0, notes) };
    paintBack();
  }
  function paintBack() {
    const e = box('breakBack');
    if (!backB) { e.hidden = true; e.innerHTML = ''; return; }
    const n = taken();
    e.hidden = false;
    e.innerHTML = `<span id="brkAway">${esc(backB.line)}</span>${backB.kind === 'vape' ? ` <button type="button" class="brk-took" onclick="Break.took()">${esc(t('break.taken'))}${n ? ' · ' + n : ''}</button>` : ''} <button type="button" onclick="Break.dismiss()" aria-label="${esc(t('break.dismiss'))}">✕</button>`;
  }
  function dismiss() { backB = null; paintBack(); }
  function menu() {
    openDialog(`<h2>${esc(t('break.h'))}</h2><p class="muted">${esc(t('break.sub'))}</p>
      <div class="brk-pick"><button class="primary" onclick="Break.start('vape')">${esc(t('break.vape'))}</button><button class="primary" onclick="Break.start('shower')">${esc(t('break.shower'))}</button></div>
      <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
  }
  const showerBtn = () => `<button onclick="Break.start('shower')" title="${esc(t('break.shower.btn.title'))}">${esc(t('break.shower.btn'))}</button>`;
  const btn = () => `<button onclick="Break.menu()" title="${esc(t('break.btn.title'))}">${esc(t('break.btn'))}</button>`;
  function box(id) {
    let e = document.getElementById(id);
    if (!e) { e = document.createElement('div'); e.id = id; e.hidden = true; document.body.appendChild(e); }
    return e;
  }
  const stored = () => { try { const b = JSON.parse(localStorage.getItem(KEY) || 'null'); return b && MINS[b.kind] ? b : null; } catch { return null; } };
  function sync() {
    cur = read();
    document.documentElement.toggleAttribute('data-break', !!cur);
    if (typeof i18n === 'undefined' || !i18n.ready) { setTimeout(sync, 100); return; }   // wait for the language files (reload during a break)
    if (!cur) {   // a break that ran out while the page was closed still gets its welcome-back line
      const old = stored();
      if (old) { try { localStorage.removeItem(KEY); } catch {} welcome(old); }
    }
    const chip = box('breakChip'), scr = box('showerScreen');
    chip.hidden = !cur; scr.hidden = !(cur && cur.kind === 'shower');
    if (!cur) { sig = ''; chip.innerHTML = ''; scr.innerHTML = ''; return; }
    const s = JSON.stringify([cur.kind, i18n.lang]);
    if (s !== sig) {
      sig = s;
      chip.innerHTML = `<span class="brk-kind">⏸ ${esc(t('break.kind.' + cur.kind))}</span> <b id="brkLeft"></b> <button type="button" onclick="Break.end()">${esc(t('break.back'))}</button>`;
      scr.innerHTML = cur.kind === 'shower' ? `<div class="brk-main"><h1>${esc(t('break.shower.h'))}</h1><div class="brk-time" id="brkBig"></div><div class="brk-sub">${esc(t('break.shower.sub'))}</div><button type="button" class="brk-back" id="brkBack" onclick="Break.end()">${esc(t('break.back'))}</button></div>` : '';
      if (cur.kind === 'shower') { const b = document.getElementById('brkBack'); if (b) b.focus(); }
    }
    tick();
  }
  function tick() {
    if (!cur) return;
    if (cur.until <= Date.now()) return end();
    const a = document.getElementById('brkLeft'), b = document.getElementById('brkBig');
    if (a) a.textContent = left();
    if (b) b.textContent = t('break.left', { left: left() });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur && cur.kind === 'shower') { e.preventDefault(); end(); } });
  window.addEventListener('storage', e => { if (e.key === KEY) sync(); });
  setInterval(() => { if (cur) tick(); else if (read()) sync(); }, 1000);
  sync();
  return { start, end, menu, btn, showerBtn, took, dismiss, sync, get on() { return !!cur; } };
})();
