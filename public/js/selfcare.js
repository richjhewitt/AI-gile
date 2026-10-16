/* ---------- 💚 Self-care reminders (AIG-775, AIG-776, AIG-777) ----------
   No AI, works in No AI mode. 775: Setup box `#selfcareBox` (SelfCare.html): which reminders (eat, drink, stretch, steps, shower, toilet,
   eyes off screen, fresh air, bedtime + your own), how often in minutes, quiet hours, meds at set times. Saved in this browser
   (localStorage aigile.selfcare), like the other per-user page settings (Topbar, Break). 776: one small chip at the bottom (`#scChip`)
   with Done / Later (snooze 15 min) / Skip, never a popup over work; nothing shows while html[data-break], data-focus or data-night
   (or inside quiet hours, meds excepted). The shower reminder also offers "Let's go" = Break.start('shower'). 777: meds at set times
   (08:00, 20:00): the chip comes back every 10 min until Done; ticks share localStorage aigile.meds.<date> with break.js;
   📋 Today popover (`#scToday`) lists today's ticks. Day log: aigile.selfcare.log.<date>; timers: aigile.selfcare.run.
   QA stubs: aigile.scOffsetMs (added to the clock), aigile.scSnoozeMs, aigile.scRepeatMs. */
const SelfCare = (() => {
  const KEY = 'aigile.selfcare', RUN = 'aigile.selfcare.run', LOG = 'aigile.selfcare.log.';
  const ITEMS = [['eat', '🍽️', 240], ['water', '💧', 60], ['stretch', '🤸', 60], ['steps', '🚶', 90], ['shower', '🚿', 1440], ['toilet', '🚻', 180], ['eyes', '👀', 20], ['air', '🌿', 180], ['bedtime', '🛏️', 1440]];
  const num = k => Number(localStorage.getItem(k)) || 0;
  const nowMs = () => Date.now() + num('aigile.scOffsetMs');
  const snoozeMs = () => num('aigile.scSnoozeMs') || 15 * 60000, repeatMs = () => num('aigile.scRepeatMs') || 10 * 60000;
  const p2 = n => String(n).padStart(2, '0');
  const dayOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const hhmm = ms => { const d = new Date(ms); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const okTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
  const atToday = (hm, ms) => { const d = new Date(ms); d.setHours(+hm.slice(0, 2), +hm.slice(3), 0, 0); return d.getTime(); };
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : d; } catch { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const clampMins = v => Math.max(1, Math.min(2880, Math.round(Number(v)) || 1));
  // Config, always filled up with defaults so old or half-saved data never breaks it.
  function load() {
    const o = rd(KEY, {}), c = { on: !!o.on, items: {}, custom: [], quiet: { on: false, from: '22:00', to: '07:00' }, meds: { on: false, times: ['08:00', '20:00'] } };
    for (const [id, , def] of ITEMS) { const i = (o.items && o.items[id]) || {}; c.items[id] = { on: !!i.on, mins: i.mins ? clampMins(i.mins) : def }; }
    if (Array.isArray(o.custom)) c.custom = o.custom.filter(x => x && typeof x.text === 'string' && x.text.trim()).map((x, n) => ({ id: 'c' + (x.id || n), text: x.text.trim().slice(0, 80), on: x.on !== false, mins: clampMins(x.mins || 60) }));
    if (o.quiet && typeof o.quiet === 'object') c.quiet = { on: !!o.quiet.on, from: okTime(o.quiet.from) ? o.quiet.from : '22:00', to: okTime(o.quiet.to) ? o.quiet.to : '07:00' };
    if (o.meds && typeof o.meds === 'object') c.meds = { on: !!o.meds.on, times: Array.isArray(o.meds.times) ? [...new Set(o.meds.times.filter(okTime))].sort() : ['08:00', '20:00'] };
    return c;
  }
  let cfg = load(), cur = null, shownAt = 0, nudges = 0;
  const save = () => { const o = { ...cfg, custom: cfg.custom.map(x => ({ ...x, id: x.id.slice(1) })) }; wr(KEY, o); };
  const run = () => { const r = rd(RUN, {}); r.due = r.due || {}; r.medNext = r.medNext || {}; return r; };
  const log = ms => { const l = rd(LOG + dayOf(ms), []); return Array.isArray(l) ? l : []; };
  const medsKey = ms => 'aigile.meds.' + dayOf(ms);
  const medsTaken = ms => num(medsKey(ms));
  const label = id => { const c = cfg.custom.find(x => x.id === id); return c ? c.text : t('sc.item.' + id); };
  const emoji = id => (ITEMS.find(i => i[0] === id) || [0, id === 'meds' ? '💊' : '💚'])[1];
  const paused = () => { const h = document.documentElement; return h.hasAttribute('data-break') || h.hasAttribute('data-focus') || h.hasAttribute('data-night'); };
  function inQuiet(ms) {
    if (!cfg.quiet.on) return false;
    const m = hm => +hm.slice(0, 2) * 60 + +hm.slice(3), d = new Date(ms), n = d.getHours() * 60 + d.getMinutes(), a = m(cfg.quiet.from), b = m(cfg.quiet.to);
    return a === b ? false : a < b ? n >= a && n < b : n >= a || n < b;
  }
  const settled = slot => rd(LOG + slot.slice(0, 10), []).some(e => e.slot === slot);   // by the slot's own day, fresh from storage (other tabs write it too)
  // Meds slot due now (they ignore quiet hours), or null.
  function pickMeds(ms) {
    const r = run();
    if (cfg.meds.on) for (const tm of cfg.meds.times) {
      const slot = dayOf(ms) + ' ' + tm;
      if (ms >= atToday(tm, ms) && !settled(slot) && ms >= (r.medNext[slot] || 0)) return { id: 'meds', slot, time: tm };
    }
    return null;
  }
  // Pick what is due now: meds first, else the reminder longest overdue.
  function pick(ms) {
    const r = run(), m = pickMeds(ms);
    if (m) return m;
    if (inQuiet(ms)) return null;
    let best = null, bd = Infinity, dirty = false;
    for (const it of [...ITEMS.map(i => ({ id: i[0], ...cfg.items[i[0]] })), ...cfg.custom]) {
      if (!it.on) continue;
      if (!r.due[it.id]) { r.due[it.id] = ms + it.mins * 60000; dirty = true; }
      if (ms >= r.due[it.id] && r.due[it.id] < bd) { best = { id: it.id, mins: it.mins }; bd = r.due[it.id]; }
    }
    if (dirty) wr(RUN, r);
    return best;
  }
  function tick() {
    const ms = nowMs();
    const off = !cfg.on || paused();
    if (!cfg.on) cur = null;
    if (cur && !stillThere(cur)) cur = null;   // its reminder or meds time was switched off or removed (or settled in another tab)
    if (!off && (!cur || cur.id !== 'meds')) {   // meds due now replace an ordinary reminder, even a hidden one
      const m = pickMeds(ms);
      if (m) { cur = m; shownAt = ms; nudges++; }
    }
    const dead = off || (cur && cur.id !== 'meds' && inQuiet(ms));
    if (!cur && !dead) { cur = pick(ms); if (cur) { shownAt = ms; nudges++; } }
    else if (cur && cur.id === 'meds' && !dead && ms - shownAt >= repeatMs()) { shownAt = ms; nudges++; }   // 777: nudge again every 10 min until Done
    paint(dead);
  }
  function stillThere(c) {
    if (c.id === 'meds') return cfg.meds.on && cfg.meds.times.includes(c.time) && !settled(c.slot);
    const i = find(c.id); return !!(i && i.on);
  }
  // 776: the chip.
  function box(id) { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; e.hidden = true; document.body.appendChild(e); } return e; }
  let sig = '';
  function paint(dead) {
    const e = box('scChip');
    if (!cur || dead) { e.hidden = true; if (!cur) { sig = ''; e.innerHTML = ''; } return; }
    const s = JSON.stringify([cur.id, cur.slot, nudges, i18n.lang]);
    if (s !== sig) {
      sig = s;
      const msg = cur.id === 'meds' ? t('sc.msg.meds', { time: cur.time }) : cfg.custom.some(x => x.id === cur.id) ? t('sc.msg.custom', { text: label(cur.id) }) : t('sc.msg.' + cur.id);
      const b = (k, c, f) => `<button type="button" class="sc-${c}" onclick="SelfCare.${f}">${esc(t(k))}</button>`;
      e.setAttribute('role', 'status'); e.dataset.n = nudges; e.dataset.id = cur.id;
      e.innerHTML = `<span class="sc-msg">${emoji(cur.id)} ${esc(msg)}</span><span class="sc-btns">${cur.id === 'shower' ? b('sc.letsgo', 'go', "act('go')") : ''}${b('sc.done', 'done', "act('done')")}${b('sc.later', 'later', "act('later')")}${b('sc.skip', 'skip', "act('skip')")}<button type="button" class="sc-td" onclick="SelfCare.today()" title="${esc(t('sc.today.btn'))}" aria-label="${esc(t('sc.today.btn'))}"><span aria-hidden="true">📋</span></button></span>`;
      e.classList.remove('sc-pulse'); void e.offsetWidth; e.classList.add('sc-pulse');
    }
    e.hidden = false;
  }
  function act(kind) {
    if (!cur) return;
    const ms = nowMs(), r = run(), n = cur; cur = null;
    if (n.id === 'meds' && kind !== 'later' && settled(n.slot)) { paint(); todayPaint(); return; }   // already settled in another tab: never count a dose twice
    if (kind === 'later') { if (n.id === 'meds') r.medNext[n.slot] = ms + snoozeMs(); else r.due[n.id] = ms + snoozeMs(); wr(RUN, r); paint(); return; }
    const skip = kind === 'skip', l = log(ms), ent = { id: n.id, at: ms, act: skip ? 'skip' : 'done' };
    if (n.id === 'meds') ent.slot = n.slot;
    if (cfg.custom.some(x => x.id === n.id)) ent.text = label(n.id);
    if (n.id === 'meds') { const k = LOG + n.slot.slice(0, 10), sl = rd(k, []); sl.push(ent); wr(k, Array.isArray(sl) ? sl : [ent]); } else { l.push(ent); wr(LOG + dayOf(ms), l); }
    if (n.id === 'meds') { if (!skip) { try { localStorage.setItem(medsKey(ms), String(medsTaken(ms) + 1)); } catch {} } }
    else { r.due[n.id] = ms + n.mins * 60000; wr(RUN, r); }
    paint();
    if (kind === 'go' && typeof Break !== 'undefined') Break.start('shower');
    todayPaint();
  }
  // 777: Today popover.
  function todayHtml() {
    const ms = nowMs(), l = log(ms), rows = [];
    if (cfg.meds.on) for (const tm of cfg.meds.times) {
      const slot = dayOf(ms) + ' ' + tm, e = l.find(x => x.slot === slot);
      const st = e ? (e.act === 'skip' ? 'sc.today.skipped' : 'sc.today.taken') : ms >= atToday(tm, ms) ? 'sc.today.due' : 'sc.today.coming';
      rows.push(`<li class="sc-r ${e ? e.act : ms >= atToday(tm, ms) ? 'due' : ''}"><b>${tm}</b> 💊 ${esc(t('sc.item.meds'))} <span class="muted">${esc(t(st))}${e ? ' ' + hhmm(e.at) : ''}</span></li>`);
    }
    for (const e of l) if (!e.slot) rows.push(`<li class="sc-r ${e.act}"><b>${hhmm(e.at)}</b> ${emoji(e.id)} ${esc(e.text || label(e.id))} <span class="muted">${esc(t(e.act === 'skip' ? 'sc.today.skipped' : 'sc.today.done'))}</span></li>`);
    const n = medsTaken(ms);
    return `<div class="sc-th"><b>${esc(t('sc.today.h'))}</b><button type="button" class="sc-x" onclick="SelfCare.todayClose()" aria-label="${esc(t('common.close'))}"><span aria-hidden="true">✕</span></button></div>
      <div class="sc-meds">💊 ${esc(t('sc.today.ticks', { n }))}</div>
      ${rows.length ? `<ul class="sc-list">${rows.join('')}</ul>` : `<p class="muted">${esc(t('sc.today.none'))}</p>`}`;
  }
  // AIG-797: today's meds times with no tick or skip yet (Start my day lists them).
  const medsLeft = () => { if (!cfg.meds.on) return []; const l = log(nowMs()), d = dayOf(nowMs()); return cfg.meds.times.filter(tm => !l.find(x => x.slot === d + ' ' + tm)); };
  function today() { const e = box('scToday'); if (!e.hidden) { e.hidden = true; return; } e.innerHTML = todayHtml(); e.hidden = false; }
  function todayClose() { box('scToday').hidden = true; }
  function todayPaint() { const e = box('scToday'); if (!e.hidden) e.innerHTML = todayHtml(); }
  // 775: Setup box.
  const row = (id, inner) => `<div class="sc-row" data-sc="${esc(id)}">${inner}</div>`;
  function html() {
    const onb = (on, fn, lbl) => `<input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}" aria-label="${esc(lbl)}">`;
    const mins = (id, v) => `<span class="sc-every">${esc(t('sc.every'))} <input type="number" min="1" max="2880" value="${v}" class="sc-mins" onchange="SelfCare.setMins('${id}',this.value)" aria-label="${esc(t('sc.minutes'))}"> ${esc(t('sc.min'))}</span>`;
    const items = ITEMS.map(([id, em]) => row(id, `<label class="sc-name">${onb(cfg.items[id].on, `SelfCare.setOn('${id}',this.checked)`, t('sc.item.' + id))} ${em} ${esc(t('sc.item.' + id))}</label>${mins(id, cfg.items[id].mins)}`)).join('');
    const cust = cfg.custom.map(x => row(x.id, `<label class="sc-name">${onb(x.on, `SelfCare.setOn('${x.id}',this.checked)`, x.text)} 💚 ${esc(x.text)}</label>${mins(x.id, x.mins)}<button type="button" class="sc-del" onclick="SelfCare.del('${x.id}')" aria-label="${esc(t('sc.remove', { name: x.text }))}" title="${esc(t('sc.remove', { name: x.text }))}"><span aria-hidden="true">✕</span></button>`)).join('');
    const times = cfg.meds.times.map(tm => `<span class="sc-tm">${tm}<button type="button" onclick="SelfCare.delTime('${tm}')" aria-label="${esc(t('sc.remove', { name: tm }))}"><span aria-hidden="true">✕</span></button></span>`).join('');
    return `<span>${esc(t('sc.h'))}</span><div class="sc-box">
      <label class="sc-main">${onb(cfg.on, 'SelfCare.setOn(\'\',this.checked)', t('sc.on'))} <b>${esc(t('sc.on'))}</b></label>
      <small class="muted">${esc(t('sc.help'))}</small>
      <div class="sc-rows" id="scRows">${items}${cust}</div>
      <div class="sc-add"><input type="text" id="scNew" maxlength="80" placeholder="${esc(t('sc.add.ph'))}" onkeydown="if(event.key==='Enter')SelfCare.add()"> <input type="number" id="scNewMins" min="1" max="2880" value="60" aria-label="${esc(t('sc.minutes'))}"> ${esc(t('sc.min'))} <button type="button" onclick="SelfCare.add()">${esc(t('sc.add'))}</button></div>
      <div class="sc-meds-box"><label class="sc-name">${onb(cfg.meds.on, 'SelfCare.setMeds(this.checked)', t('sc.item.meds'))} 💊 <b>${esc(t('sc.item.meds'))}</b></label><small class="muted">${esc(t('sc.meds.help'))}</small>
        <div class="sc-times">${times}<input type="time" id="scNewTime" aria-label="${esc(t('sc.meds.time'))}"> <button type="button" onclick="SelfCare.addTime()">${esc(t('sc.meds.add'))}</button></div></div>
      <div class="sc-quiet"><label class="sc-name">${onb(cfg.quiet.on, 'SelfCare.setQuiet(this.checked)', t('sc.quiet'))} 🌙 ${esc(t('sc.quiet'))}</label> <input type="time" value="${cfg.quiet.from}" onchange="SelfCare.setQuietTime('from',this.value)" aria-label="${esc(t('sc.quiet.from'))}"> – <input type="time" value="${cfg.quiet.to}" onchange="SelfCare.setQuietTime('to',this.value)" aria-label="${esc(t('sc.quiet.to'))}"><small class="muted">${esc(t('sc.quiet.help'))}</small></div>
      <div class="actions"><button type="button" onclick="SelfCare.today()">📋 ${esc(t('sc.today.btn'))}</button></div></div>`;
  }
  function paintBox() { const b = document.getElementById('selfcareBox'); if (b) b.innerHTML = html(); }
  function change(fn, again) { fn(); save(); if (again !== false) paintBox(); tick(); }
  const find = id => cfg.items[id] || cfg.custom.find(x => x.id === id);
  const setOn = (id, v) => change(() => { if (!id) cfg.on = !!v; else { const i = find(id); if (i) { i.on = !!v; const r = run(); delete r.due[id]; wr(RUN, r); } } });
  const setMins = (id, v) => change(() => { const i = find(id); if (i) { i.mins = clampMins(v); const r = run(); delete r.due[id]; wr(RUN, r); } });
  const add = () => { const x = document.getElementById('scNew'), m = document.getElementById('scNewMins'); if (!x || !x.value.trim()) return; change(() => cfg.custom.push({ id: 'c' + Date.now().toString(36), text: x.value.trim().slice(0, 80), on: true, mins: clampMins(m && m.value) })); };
  const del = id => change(() => { cfg.custom = cfg.custom.filter(x => x.id !== id); if (cur && cur.id === id) cur = null; });
  const setMeds = v => change(() => { cfg.meds.on = !!v; });
  const addTime = () => { const x = document.getElementById('scNewTime'); if (!x || !okTime(x.value)) return; change(() => { cfg.meds.times = [...new Set([...cfg.meds.times, x.value])].sort(); }); };
  const delTime = tm => change(() => { cfg.meds.times = cfg.meds.times.filter(x => x !== tm); });
  const setQuiet = v => change(() => { cfg.quiet.on = !!v; });
  const setQuietTime = (k, v) => change(() => { if (okTime(v)) cfg.quiet[k] = v; });
  window.addEventListener('storage', e => { if (e.key === KEY) { cfg = load(); paintBox(); } if (e.key === null || e.key === KEY || (e.key || '').startsWith(LOG)) { tick(); todayPaint(); } });
  setInterval(tick, 1000);
  tick();
  return { html, paintBox, setOn, setMins, add, del, setMeds, addTime, delTime, setQuiet, setQuietTime, act, today, medsLeft, todayClose, tick, get cur() { return cur; } };
})();
