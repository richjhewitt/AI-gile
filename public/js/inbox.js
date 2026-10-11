// AI-gile inbox: top-bar button, #/inbox page, and new-question alerts.
// Self-contained (no dependencies). Loaded before the main scripts in index.html.
// Needs from the page: state, $, api (all top-level in js/core.js), a <header> with #live.
/* ---------- module ---------- */
(function () {
  'use strict';

  /* ---------- styles ---------- */
  // Questions = strong blue, tests = pale blue, blocked = red. Every use also carries an icon and a word.
  const css = `
  :root {
    --q-bg: #2563eb; --q-fg: #fff; --q-tint: #eef3ff; --q-line: #2563eb; --q-ink: #1d4ed8;
    --b-line: #c81e1e; --b-tint: #fdecec; --b-ink: #9b1212;
    --t-bg: #e4ecff; --t-fg: #1e40af; --t-tint: #f1f5ff; --t-line: #8fa8e8; --t-ink: #1e40af;
    --k-bg: #fff1d1; --k-fg: #7a4300; --k-tint: #fffaf0; --k-line: #e0a640; --k-ink: #7a4300;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme=light]) {
      --q-bg: #3b74f0; --q-fg: #fff; --q-tint: #162039; --q-line: #5b8cf5; --q-ink: #9dbbff;
      --b-line: #ef5350; --b-tint: #2c1618; --b-ink: #ff9b97;
      --t-bg: #22305a; --t-fg: #bcd0ff; --t-tint: #181e2e; --t-line: #4a5f9a; --t-ink: #a9c1ff;
      --k-bg: #3d2e10; --k-fg: #ffd591; --k-tint: #221c10; --k-line: #a0762a; --k-ink: #ffcf7a;
    }
  }
  :root[data-theme=dark] {
      --q-bg: #3b74f0; --q-fg: #fff; --q-tint: #162039; --q-line: #5b8cf5; --q-ink: #9dbbff;
      --b-line: #ef5350; --b-tint: #2c1618; --b-ink: #ff9b97;
      --t-bg: #22305a; --t-fg: #bcd0ff; --t-tint: #181e2e; --t-line: #4a5f9a; --t-ink: #a9c1ff;
      --k-bg: #3d2e10; --k-fg: #ffd591; --k-tint: #221c10; --k-line: #a0762a; --k-ink: #ffcf7a;
  }
  #inboxTop { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ib-btn { display: inline-flex; align-items: center; gap: 8px; padding: 4px 8px 4px 12px; border: 1px solid var(--line); border-radius: 99px; background: var(--panel); font-weight: 600; }
  .ib-btn:hover { border-color: var(--accent); }
  .ib-btn.on { outline: 2px solid var(--accent); outline-offset: 1px; }
  .ib-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 99px; font-weight: 700; font-size: 13px; white-space: nowrap; }
  .ib-badge.q { background: var(--q-bg); color: var(--q-fg); }
  .ib-badge.t { background: var(--t-bg); color: var(--t-fg); font-weight: 600; border: 1px solid var(--t-line); }
  .ib-badge.k { background: var(--k-bg); color: var(--k-fg); font-weight: 600; border: 1px solid var(--k-line); }
  .ib-sec.k h3, .k .ib-tag { color: var(--k-ink); }
  .ib-item.k { border-left: 6px solid var(--k-line); background: var(--k-tint); }
  .ib-item.k textarea { min-height: 36px; }
  @media (prefers-reduced-motion: no-preference) {
    .ib-badge.q { animation: ibglow 2.8s ease-in-out infinite; }
    @keyframes ibglow { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--q-bg) 30%, transparent); } }
  }
  .ib-alerts { font-size: 12px; padding: 3px 10px; border-radius: 99px; color: var(--muted); }
  .ib-alerts.on { color: var(--text); }

  .ib { max-width: 860px; margin: 0 auto; }
  .ib-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .ib-head h2 { margin: 0; font-size: 20px; }
  .ib-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 6px; margin: -4px 0 6px; border-bottom: 1px solid var(--line); }
  .ib-tab { flex: none; border-radius: 99px; padding: 5px 12px; font-weight: 600; display: inline-flex; gap: 6px; align-items: center; }
  .ib-tab.on { background: var(--text); color: var(--panel); border-color: var(--text); }
  .ib-tab .n { font-weight: 400; opacity: .7; }
  .ib-tab .nm { max-width: 13ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }   /* long names cut short; the emoji tells them apart (AIG-101) */
  .ib-tab .tq, .ib-tab .tk, .ib-tab .tt { font-size: 12px; font-weight: 600; }
  .ib-tab .tq { color: var(--q-ink); } .ib-tab.on .tq, .ib-tab.on .tk, .ib-tab.on .tt { color: inherit; }
  .ib-tab .tk { color: var(--k-ink); } .ib-tab .tt { color: var(--t-ink); }
  .ib-toast { min-height: 20px; color: var(--muted); font-size: 13px; margin: -8px 0 10px; }
  .ib-sec h3 { display: flex; align-items: center; gap: 8px; margin: 22px 0 10px; font-size: 15px; }
  .ib-sec.q h3 { color: var(--q-ink); font-size: 17px; }
  .ib-sec.t h3 { color: var(--t-ink); }
  .ib-sec h3 .ib-badge { font-size: 12px; }
  .ib-item { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; box-shadow: var(--shadow); }
  .ib-item.q { border: 2px solid var(--q-line); border-left-width: 8px; background: var(--q-tint); }
  .ib-item.t { border-left: 6px solid var(--t-line); background: var(--t-tint); }
  .ib-item.flash { animation: ibflash 1.6s ease-out 1; }
  @keyframes ibflash { 0% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 45%, transparent); } 100% { box-shadow: var(--shadow); } }
  .ib-top { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .ib-tag { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
  .ib-item.q.blk { border-color: var(--b-line); background: var(--b-tint); } .q.blk .ib-tag { color: var(--b-ink); }
  .q .ib-tag { color: var(--q-ink); } .t .ib-tag { color: var(--t-ink); }
  .ib-chat { display: flex; gap: 14px; align-items: flex-start; }
  .ib-chats { flex: 0 0 230px; display: flex; flex-direction: column; gap: 6px; position: sticky; top: 70px; }
  .ib-chatbtn { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-left: 5px solid var(--proj, var(--line)); border-radius: 10px; background: var(--panel); cursor: pointer; }
  .ib-chatbtn.on { background: color-mix(in srgb, var(--proj, var(--accent)) 14%, var(--panel)); border-color: var(--proj, var(--accent)); }
  .ib-chatbtn .av { font-size: 22px; }
  .ib-chatbtn .nm { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .ib-chatbtn .nm .ib-hint { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ib-thread { flex: 1; min-width: 0; }
  .ib-thread .ib-item.q { border-radius: 16px 16px 16px 4px; }
  @media (max-width: 720px) { .ib-chat { flex-direction: column; } .ib-chats { position: static; flex-basis: auto; width: 100%; } }
  .ib-proj { font-weight: 700; color: #fff; background: var(--proj, var(--muted)); border-radius: 999px; padding: 1px 9px; font-size: 13px; }
  .ib-item.q, .ib-item.t, .ib-item.k, .ib-item { border-left: 8px solid var(--proj, var(--line)); }
  .ib-tab[style] { border-bottom: 3px solid var(--proj); }
  .ib-item.q.blk { border-left-color: var(--proj, var(--b-line)); }
  .ib-title { font-weight: 600; margin: 3px 0 2px; font-size: 15px; }
  .ib-title a:hover { text-decoration: underline; }
  .ib-id { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--muted); }
  .ib-who { font-size: 13px; color: var(--muted); margin: 2px 0 6px; }
  .ib-question { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 6px 0 10px; max-height: 40vh; overflow: auto; }
  .ib-item textarea { min-height: 56px; }
  .ib-item .actions { margin-top: 8px; }
  .ib-steps { margin: 8px 0 4px; }
  .ib-steps summary { cursor: pointer; font-weight: 600; color: var(--t-ink); }
  .ib-steps .body { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-top: 6px; max-height: 40vh; overflow: auto; }
  .ib-empty { text-align: center; padding: 56px 16px; }
  .ib-empty .big { font-size: 26px; font-weight: 700; }
  .ib-empty p { color: var(--muted); margin: 8px 0 0; }
  .ib-err { color: var(--danger); font-size: 13px; margin-top: 6px; }
  .ib-hint { font-size: 12px; color: var(--muted); }
  @media (max-width: 760px) {
    .ib-btn { padding: 3px 6px 3px 10px; gap: 5px; }
    .ib-badge { padding: 2px 8px; }
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- helpers ---------- */
  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ago() and t() are the page's (js/core.js, js/i18n.js); they are only called after everything has loaded.
  const post = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  };
  // Server sends three kinds: tasks (assigned to Rich: something only he can do), questions, and verify cards.
  const isTask = c => String(c.assignee || '').trim().toLowerCase() === 'rich';
  const isQuestion = c => !isTask(c) && c.status !== 'verify';
  const isTest = c => !isTask(c) && c.status === 'verify';
  const kindOf = c => isTask(c) ? 'k' : isQuestion(c) ? 'q' : 't';
  const lastAsk = c => [...(c.comments || [])].reverse().find(m => String(m.author).trim().toLowerCase() !== 'rich')
    || { author: c.assignee || 'The team', at: c.updated, text: c.description || c.title };
  const keyOf = c => c.project + '/' + c.id;
  // Escape, then link web addresses and card ids (e.g. AIG-12) in the same project.
  const linkify = (text, c) => withCode(text, t => mdLinks(esc(t)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener" style="text-decoration:underline">${u}</a>`)
    .replace(/(^|[^\w/#-])([A-Z]{1,6}-\d+)\b/g, (m, pre, id) => `${pre}<a href="#/p/${c.project}/${id}" style="text-decoration:underline">${id}</a>`), c.project), c.project);

  const pref = {
    get() { try { return localStorage.getItem('aigile.alerts') === '1'; } catch { return false; } },
    set(on) { try { localStorage.setItem('aigile.alerts', on ? '1' : '0'); } catch {} },
  };
  const canNotify = () => typeof Notification !== 'undefined';
  const alertsOn = () => canNotify() && Notification.permission === 'granted' && pref.get();

  /* ---------- state ---------- */
  let items = [], raw = [], hidden = 0, loaded = false, inflight = null, seen = new Set(), flashKey = null;
  const baseTitle = document.title || 'AI-gile';

  /* ---------- data ---------- */
  function load() {
    if (inflight) return inflight;
    inflight = fetch('/api/inbox', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then(list => { inflight = null; apply(list); return true; })
      .catch(e => { inflight = null; throw e; });
    return inflight;
  }
  // Going quiet (night mode): no tests or tasks, and only the 3 newest questions.
  const isQuiet = () => document.documentElement.hasAttribute('data-night');
  function view() {
    if (!isQuiet()) { hidden = 0; return raw; }
    const all = raw.filter(isQuestion);
    const qs = all.slice().sort((a, b) => lastAsk(b).at.localeCompare(lastAsk(a).at)).slice(0, 3);
    hidden = all.length - qs.length;
    return raw.filter(c => qs.includes(c));
  }
  function apply(list) {
    if (typeof i18n === 'undefined' || !i18n.ready) { setTimeout(() => load().catch(() => {}), 100); return; }   // wait for the language file (AIG-124)
    raw = list;
    items = view();
    const qs = items.filter(c => !isTest(c));   // questions and tasks both alert (only those shown)
    // New questions only: never on the first load. A fresh question on the same card counts as new.
    const key = c => keyOf(c) + '@' + lastAsk(c).at;
    if (loaded) {
      const fresh = qs.filter(c => !seen.has(key(c)));
      if (fresh.length) announce(fresh);
    }
    seen = new Set(raw.filter(c => !isTest(c)).map(key));   // hidden ones are not new when quiet ends
    loaded = true;
    paintTop();
    if (onInboxPage()) paintPage();
  }
  function repaint() { if (!loaded) return; items = view(); paintTop(); if (onInboxPage() && el('ib')) paintPage(); }

  /* ---------- top bar (AIG-32, AIG-34) ---------- */
  function slot() {
    let s = el('inboxTop');
    if (!s) {   // fallback if the page has no container
      s = document.createElement('span'); s.id = 'inboxTop';
      const live = el('live'); live.parentNode.insertBefore(s, live);
    }
    return s;
  }
  const onInboxPage = () => location.hash === '#/inbox';
  function counts() {
    return { q: items.filter(isQuestion).length, k: items.filter(isTask).length, t: items.filter(isTest).length };
  }
  function paintTop() {
    const { q, k, t: te } = counts();   // te: a local `t` would hide the t() text function
    const label = (q ? t(q === 1 ? 'inbox.sum.q.one' : 'inbox.sum.q.many', { n: q }) : '') + (k ? t(k === 1 ? 'inbox.sum.k.one' : 'inbox.sum.k.many', { n: k }) : '') + (te ? t('inbox.sum.t', { n: te }) : '') || t('inbox.sum.none');
    let alertBtn = '';
    if (canNotify()) {
      const on = alertsOn(), blocked = Notification.permission === 'denied';
      alertBtn = `<button class="ib-alerts ${on ? 'on' : ''}" id="ibAlerts" title="${esc(blocked ? t('inbox.alerts.blocked.title') : on ? t('inbox.alerts.off.title') : t('inbox.alerts.on.title'))}" ${blocked ? 'disabled' : ''}>${esc(blocked ? t('inbox.alerts.blocked') : on ? t('inbox.alerts.on') : t('inbox.alerts.turnon'))}</button>`;
    }
    const html = `<a class="ib-btn ${onInboxPage() ? 'on' : ''}" href="#/inbox" aria-label="${esc(t('inbox.btn.aria', { label }))}" title="${esc(label)}">${esc(t('inbox.btn'))}
        ${q ? `<span class="ib-badge q">${esc(t(q === 1 ? 'inbox.badge.q.one' : 'inbox.badge.q.many', { n: q }))}</span>` : ''}
        ${k ? `<span class="ib-badge k">${esc(t('inbox.badge.k', { n: k }))}</span>` : ''}
        ${te ? `<span class="ib-badge t">${esc(t('inbox.badge.t', { n: te }))}</span>` : ''}</a>${alertBtn}`;
    const s = slot();
    if (s.dataset.sig !== html) {
      s.dataset.sig = html; s.innerHTML = html;
      const b = el('ibAlerts'); if (b) b.onclick = toggleAlerts;
    }
    // Everything waiting on Rich; the desktop app turns this count into its taskbar badge (AIG-76).
    const title = q + k + te ? `(${q + k + te}) ${baseTitle}` : baseTitle;
    if (document.title !== title) document.title = title;
  }

  /* ---------- alerts (AIG-35) ---------- */
  let audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      [[660, 0], [880, 0.16]].forEach(([f, d]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.3);
      });
    } catch {}
  }
  function announce(fresh) {
    if (!alertsOn()) return;
    beep();
    const one = fresh.length === 1 ? fresh[0] : null;
    const a = one && lastAsk(one);
    const n = new Notification(one ? t('inbox.notify.one', { who: a.author, id: one.id }) : t('inbox.notify.many', { n: fresh.length }), {
      body: one ? `${one.projectName}: ${String(a.text).replace(/\s+/g, ' ').slice(0, 160)}` : fresh.map(c => c.id + ' ' + c.title).join('\n').slice(0, 200),
      tag: 'aigile-question-' + (one ? keyOf(one) : 'many'),
    });
    n.onclick = () => {
      try { window.focus(); } catch {}
      flashKey = one ? keyOf(one) : null;
      tab = 'all';   // so the question is visible whatever tab was open
      if (onInboxPage()) show(true); else location.hash = '#/inbox';
      n.close();
    };
  }
  async function toggleAlerts() {
    if (!canNotify()) return;
    if (alertsOn()) { pref.set(false); paintTop(); return; }
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();   // created inside the click so sound is allowed later
      audio.resume();
    } catch {}
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') { pref.set(true); beep(); }
    paintTop();
  }

  /* ---------- inbox page (AIG-33) ---------- */
  function qHtml(c) {
    const a = lastAsk(c), acts = c.blocked ? [] : askActions(a, 'question');
    return `<div class="ib-top"><span class="ib-tag">${esc(c.blocked ? t('inbox.q.blocked') : t('inbox.q.question'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>${queueChips(c)}
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-who">${t(c.blocked ? 'inbox.q.isblocked.html' : 'inbox.q.asked.html', { who: esc(a.author), when: ago(a.at) })}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>${actionsHtml(acts, c.project, c.id)}
      <textarea rows="2" data-draft="${esc(c.project + '/' + c.id)}/reply" placeholder="${esc(t('inbox.q.ph'))}" aria-label="${esc(t('inbox.q.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions">${c.blocked || acts.length ? '' : `<button class="good" data-act="go" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>`}<button class="primary" data-act="send">${esc(t('inbox.q.send'))}</button><button data-act="wait" title="${esc(t('inbox.later.title'))}">${esc(t('inbox.later'))}</button>${Attach.boxHtml(c.project + '/' + c.id)}<span class="ib-hint">${esc(t('inbox.q.hint'))}</span></div>`;
  }
  function kHtml(c) {
    const a = lastAsk(c);
    return `<div class="ib-top"><span class="ib-tag">${esc(t('inbox.k.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>${queueChips(c)}
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-who">${t('inbox.k.asked.html', { who: esc(a.author), when: ago(a.at) })}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>
      <textarea rows="1" data-draft="${esc(c.project + '/' + c.id)}/task" placeholder="${esc(t('inbox.k.ph'))}" aria-label="${esc(t('inbox.k.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions"><button class="good" data-act="taskdone">${esc(t('inbox.k.done'))}</button>${Attach.boxHtml(c.project + '/' + c.id)}<span class="ib-hint">${esc(t('inbox.k.hint'))}</span></div>`;
  }
  function tHtml(c) {
    return `<div class="ib-top"><span class="ib-tag">${esc(t('inbox.t.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span><span class="ib-hint">${esc(t('inbox.t.waiting', { when: ago(c.updated, true) }))}</span></div>
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      ${c.testSteps ? `<details class="ib-steps"><summary>${esc(t('inbox.t.how'))}</summary><div class="body">${linkify(c.testSteps, c)}</div></details>` : `<div class="ib-hint">${esc(t('inbox.t.nosteps'))}</div>`}
      <div class="ib-err"></div>
      <div class="actions">${c.openUrl ? `<button class="primary" data-act="open" data-cmd="${esc(c.startCmd || '')}" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button>` : ''}<button class="good" data-act="accept">${esc(t('card.accept'))}</button><button data-act="wait" title="${esc(t('inbox.t.wait.title'))}">${esc(t('card.wait'))}</button>
      <a href="#/p/${c.project}/${c.id}" class="ib-hint" style="text-decoration:underline">${esc(t('inbox.t.sendback'))}</a></div>`;
  }
  const sigOf = c => !isTest(c) ?[c.title, c.blocked, lastAsk(c).at, lastAsk(c).text, i18n.lang].join('|') : [c.title, c.updated, c.testSteps].join('|');

  function skeleton() {
    el('app').innerHTML = `<div class="ib" id="ib">
      <div class="ib-head"><h2>${esc(t('inbox.h'))}</h2><span class="ib-hint">${esc(t('inbox.sub'))}</span></div>
      <div class="ib-tabs" id="ibTabs" role="tablist"></div>
      <div class="ib-next" id="ibNext"></div>
      <div class="ib-kinds" id="ibKinds"></div>
      <div class="ib-toast" id="ibToast" role="status" aria-live="polite"></div>
      <div id="ibEmpty"></div>
      <section class="ib-sec q" id="ibQ"><h3>${esc(t('inbox.messages'))} <span class="ib-badge q" id="ibQn"></span></h3><div class="ib-chat"><div class="ib-chats" id="ibChats"></div><div class="list ib-thread"></div></div><div class="ib-hint" id="ibMore" hidden></div></section>
      <section class="ib-sec k" id="ibK"><h3>${esc(t('inbox.tasks'))} <span class="ib-badge k" id="ibKn"></span><span class="ib-hint" style="font-weight:400">${esc(t('inbox.tasks.sub'))}</span></h3><div class="list"></div></section>
      <section class="ib-sec t" id="ibT"><h3>${esc(t('inbox.t.tag'))} <span class="ib-badge t" id="ibTn"></span><span class="ib-hint" style="font-weight:400">${esc(t('inbox.t.sub'))}</span></h3><div class="list"></div></section>
    </div>`;
    el('ib').addEventListener('click', onClick);
    el('ib').addEventListener('keydown', onKey);
  }

  // Keeps existing item elements (and whatever is typed in them) and only adds, removes or updates the rest.
  // A reply box that is focused or holds text is never touched, so the 1s poll can't wipe it.
  function syncList(list, data) {
    const have = new Map([...list.children].map(n => [n.dataset.key, n]));
    const want = new Set(data.map(keyOf));
    for (const [k, n] of have) if (!want.has(k) && !n.dataset.sending) { n.remove(); have.delete(k); }
    data.forEach((c, i) => {
      const k = keyOf(c), sig = sigOf(c);
      let n = have.get(k);
      const typing = n && [...n.querySelectorAll('textarea')].some(t => t.value || t === document.activeElement);
      if (n && n.dataset.sig !== sig && !typing) { n.remove(); n = null; }
      if (!n) {
        n = document.createElement('div');
        const kind = kindOf(c);
        n.className = 'ib-item ' + kind + (kind === 'q' && c.blocked ? ' blk' : '');
        n.dataset.key = k; n.dataset.sig = sig; n.dataset.project = c.project; n.dataset.id = c.id;
        if (c.projectColor) n.style.setProperty('--proj', c.projectColor);   // project stripe and badge (AIG-86)
        n.innerHTML = kind === 'q' ? qHtml(c) : kind === 'k' ? kHtml(c) : tHtml(c);
      }
      if (list.children[i] !== n) list.insertBefore(n, list.children[i] || null);
    });
  }

  /* ---------- project tabs (AIG-37): All + one per project with something waiting; remembers the last tab ---------- */
  const tabPref = {
    get() { try { return localStorage.getItem('aigile.inboxTab') || 'all'; } catch { return 'all'; } },
    set(t) { try { localStorage.setItem('aigile.inboxTab', t); } catch {} },
  };
  let tab = tabPref.get();
  let chat = null;   // the project whose questions show in the Messages thread (AIG-87)
  let fromProject = null, selectPinned = false;   // set when the inbox is opened from a project page
  function tabCounts(list) {
    const q = list.filter(isQuestion).length, k = list.filter(isTask).length, t = list.filter(isTest).length;
    return `${q ? `<span class="tq">❓${q}</span>` : ''}${k ? `<span class="tk">📋${k}</span>` : ''}${t ? `<span class="tt">🧪${t}</span>` : ''}`;
  }
  function mostRecentMessageTime(projectSlug) {
    const projectItems = items.filter(c => c.project === projectSlug);
    let latest = null;
    for (const item of projectItems) {
      if (item.comments && item.comments.length > 0) {
        for (const comment of item.comments) {
          if (!latest || comment.at > latest) latest = comment.at;
        }
      }
      if (!latest || item.updated > latest) latest = item.updated;
    }
    return latest || new Date(0).toISOString();
  }
  let tabOrder = [];
  function paintTabs() {
    // Opened from a project page: that project first (selected once, on arrival) and All last, for the
    // whole visit. Other projects are ordered by their most recent message, newest first.
    const projects = [...new Map(items.map(c => [c.project, c.projectName])).entries()]
      .sort((a, b) => mostRecentMessageTime(b[0]).localeCompare(mostRecentMessageTime(a[0])));
    const pinned = fromProject && projects.find(([p]) => p === fromProject);
    if (pinned && selectPinned) tab = fromProject;
    selectPinned = false;
    const orderedProjects = pinned ? [pinned, ...projects.filter(([p]) => p !== fromProject)] : projects;
    const allAtEnd = !!pinned;
    if (tab !== 'all' && !orderedProjects.some(([p]) => p === tab)) tab = 'all';   // that project's inbox emptied
    const lookOf = p => items.find(c => c.project === p) || {};
    const btn = (key, name, list) => { const l = key === 'all' ? {} : lookOf(key);
      return `<button class="ib-tab ${tab === key ? 'on' : ''}" data-tab="${esc(key)}" role="tab" aria-selected="${tab === key}" title="${esc(name)}"${l.projectColor ? ` style="--proj:${esc(l.projectColor)}"` : ''}>${l.projectLogo || l.projectEmoji ? pic(l.projectLogo, l.projectEmoji) + ' ' : ''}<span class="nm">${esc(name)}</span> <span class="n">${list.length}</span> ${tabCounts(list)}</button>`; };
    tabOrder = orderedProjects.map(([p]) => p);
    const projectBtns = orderedProjects.map(([p, name]) => btn(p, name, items.filter(c => c.project === p))).join('');
    const html = allAtEnd
      ? projectBtns + btn('all', t('inbox.all'), items)  // "All" at the end when showing a project first
      : btn('all', t('inbox.all'), items) + projectBtns;  // "All" at the beginning otherwise
    const box = el('ibTabs');
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = orderedProjects.length < 2;
  }

  /* ---------- messages (AIG-87): questions as DMs, one chat per project lead ---------- */
  // Left: a chat per project with questions (newest message first). Right: that chat's questions as bubbles,
  // oldest at the top and newest at the bottom, each with 👍 Go and a reply box (the usual question item).
  function paintChats(qs) {
    const chats = [...new Map(qs.map(c => [c.project, c])).keys()]
      .map(p => { const list = qs.filter(c => c.project === p); return { p, list, last: list.reduce((m, c) => lastAsk(c).at > m ? lastAsk(c).at : m, '') }; })
      .sort((a, b) => b.last.localeCompare(a.last));
    if (!chats.some(x => x.p === chat)) chat = chats.length ? chats[0].p : null;
    const html = chats.map(({ p, list, last }) => {
      const c = list[0], who = lastAsk(list.find(x => lastAsk(x).at === last) || c).author;
      return `<button class="ib-chatbtn ${p === chat ? 'on' : ''}" data-chat="${esc(p)}" style="--proj:${esc(c.projectColor || '')}">
        <span class="av">${pic(c.projectLogo, c.projectEmoji || '💬')}</span><span class="nm"><b>${esc(c.projectName)}</b><span class="ib-hint">${esc(who)} · ${ago(last)}</span></span><span class="ib-badge q">${list.length}</span></button>`;
    }).join('');
    const box = el('ibChats');
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = chats.length < 2;
    syncList(el('ibQ').querySelector('.list'), qs.filter(c => c.project === chat).sort((a, b) => lastAsk(a).at.localeCompare(lastAsk(b).at)));
  }

  let kindFilter = '';
  function paintQueue(shown) {
    const n = k => shown.filter(c => kindOfItem(c) === k).length, mins = shown.filter(c => !kindFilter || kindOfItem(c) === kindFilter).reduce((s, c) => s + (c.mins || 0), 0);
    const chips = [['', t('queue.all')], ...Object.keys(QKINDS).filter(k => n(k)).map(k => [k, QKINDS[k] + ' ' + t('queue.kind.' + k)])]
      .map(([k, label]) => `<button class="ib-kind ${kindFilter === k ? 'on' : ''}" data-kind="${k}">${esc(label)} <span class="n">${k ? n(k) : shown.length}</span></button>`).join('')
      + (mins ? `<span class="ib-hint">⏱ ${esc(t('queue.total', { n: mins }))}</span>` : '');
    const kb = el('ibKinds'); if (kb.dataset.sig !== chips) { kb.dataset.sig = chips; kb.innerHTML = chips; }
    const next = [...shown].sort(queueRank)[0];
    const nx = next ? `<b>▶ ${esc(t('queue.next'))}</b> <a href="#/p/${esc(next.project)}/${esc(next.id)}">${pic(next.projectLogo, next.projectEmoji)} ${esc(next.id)} ${esc(next.title)}</a> ${queueChips(next)}` : '';
    const nb = el('ibNext'); if (nb.dataset.sig !== nx) { nb.dataset.sig = nx; nb.innerHTML = nx; } nb.hidden = !next;
  }
  function paintPage() {
    if (!el('ib')) skeleton();
    paintTabs();
    // All tab: items grouped by project, in tab order, each group still longest-waiting first (AIG-86).
    const shown = tab === 'all' ? [...items].sort((a, b) => tabOrder.indexOf(a.project) - tabOrder.indexOf(b.project)) : items.filter(c => c.project === tab);
    // Your queue (AIG-159..162): filter by kind, sort by your priority / what it holds up / time, and pick Next up.
    paintQueue(shown);
    const pick = shown.filter(c => !kindFilter || kindOfItem(c) === kindFilter).sort(queueRank);
    const qs = pick.filter(isQuestion), ks = pick.filter(isTask), ts = pick.filter(isTest);
    // A link to one question (alerts, the home list) opens its chat.
    if (flashKey) { const f = qs.find(c => keyOf(c) === flashKey); if (f) chat = f.project; }
    paintChats(qs);
    syncList(el('ibK').querySelector('.list'), ks);
    syncList(el('ibT').querySelector('.list'), ts);
    el('ibQ').hidden = !qs.length; el('ibK').hidden = !ks.length; el('ibT').hidden = !ts.length;
    el('ibQn').textContent = qs.length; el('ibKn').textContent = ks.length; el('ibTn').textContent = ts.length;
    el('ibMore').hidden = !hidden; el('ibMore').textContent = t('inbox.more', { n: hidden });
    if (hidden) el('ibQ').hidden = false;
    el('ibEmpty').innerHTML = items.length || hidden ? '' : `<div class="ib-empty"><div class="big">${esc(t('inbox.empty.title'))}</div><p>${esc(t('inbox.empty.text'))}</p></div>`;
    if (flashKey) {
      const n = [...document.querySelectorAll('.ib-item')].find(x => x.dataset.key === flashKey);
      if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); const t = n.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); flashKey = null; }
    }
  }
  const toast = msg => { const t = el('ibToast'); if (t) t.textContent = msg; };

  function onKey(e) {
    if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const n = e.target.closest('.ib-item');
      if (n.classList.contains('k')) taskDone(n); else send(n);
    }
  }
  function onClick(e) {
    const cb = e.target.closest('button[data-chat]');
    if (cb) { chat = cb.dataset.chat; paintPage(); return; }
    const kb = e.target.closest('button[data-kind]');
    if (kb) { kindFilter = kb.dataset.kind; paintPage(); return; }
    const tb = e.target.closest('button[data-tab]');
    if (tb) { tab = tb.dataset.tab; tabPref.set(tab); paintPage(); return; }
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const n = b.closest('.ib-item'), act = b.dataset.act;
    if (act === 'open') { openIt(n.dataset.project, n.dataset.id, b); return; }
    if (act === 'send') send(n); else if (act === 'go') send(n, 'GO'); else if (act === 'accept') accept(n); else if (act === 'wait') waitAndSee(n); else if (act === 'taskdone') taskDone(n);
  }
  const base = n => `/api/projects/${n.dataset.project}/cards/${n.dataset.id}`;
  const fail = (n, e) => { n.querySelector('.ib-err').textContent = e.message || String(e); n.dataset.sending = ''; n.querySelectorAll('button').forEach(b => b.disabled = false); };
  const lock = n => { n.dataset.sending = '1'; n.querySelector('.ib-err').textContent = ''; n.querySelectorAll('button').forEach(b => b.disabled = true); };
  const done = (n, msg) => { n.remove(); raw = raw.filter(c => keyOf(c) !== n.dataset.key); items = view(); paintTop(); paintPage(); toast(msg); load().catch(() => {}); };

  // fixed: a one-tap answer (👍 Go, AIG-75) instead of the typed one.
  async function send(n, fixed) {
    if (n.dataset.sending) return;
    const ta = n.querySelector('textarea'), text = fixed || ta.value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    if (!text && !Attach.has(key)) { n.querySelector('.ib-err').textContent = t('dms.empty'); return; }
    lock(n);
    try {
      const attachments = fixed ? [] : await Attach.upload(key, n.dataset.project);
      await post('POST', base(n) + '/comments', { author: me(), text, attachments });
      if (!fixed) Attach.clear(key);
      clearDraft(key + '/reply');
      done(n, t('inbox.toast.sent', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  async function taskDone(n) {
    if (n.dataset.sending) return;
    const text = n.querySelector('textarea').value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    lock(n);
    try {
      const attachments = await Attach.upload(key, n.dataset.project);
      await post('POST', base(n) + '/taskdone', { text, attachments });
      Attach.clear(key);
      clearDraft(key + '/task');
      done(n, t('inbox.toast.done', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  async function accept(n) {
    lock(n);
    try { await post('POST', base(n) + '/verdict', { accept: true }); done(n, t('inbox.toast.accepted', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  async function waitAndSee(n) {
    lock(n);
    try { await post('POST', base(n) + '/snooze'); n.dataset.sending = ''; await load(); toast(t('inbox.toast.hidden', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }

  /* ---------- hooks used by js/core.js ---------- */
  // Called from refresh() whenever the route is #/inbox. Takes over the page body.
  async function show(force) {
    try { await load(); } catch (e) {
      el('live').className = 'live off'; el('live').textContent = t('live.offline', { msg: e.message }); return;
    }
    el('live').className = 'live'; el('live').textContent = t('live.ok');
    el('crumb').textContent = '/ ' + t('inbox.crumb');
    el('modal').innerHTML = '';
    if (typeof state !== 'undefined') state.lastSig = state.lastBoardSig = null;   // so other views redraw when Rich leaves
    if (force || !el('ib')) { if (!el('ib')) skeleton(); fromProject = (typeof state !== 'undefined' && state.lastProject) || null; selectPinned = true; }
    paintTop(); paintPage();
  }

  // Own poll so counts, tab title and alerts keep working on every page, even in a background tab.
  setInterval(() => { load().catch(() => {}); }, 1000);
  window.addEventListener('hashchange', paintTop);
  load().catch(() => {});

  window.Inbox = { show, repaint };
})();
