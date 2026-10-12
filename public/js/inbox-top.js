// AI-gile inbox: the top-bar button, the tab title and new-question alerts (AIG-32..35).
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
(function () {
  'use strict';
  const { el, esc, isTask, isQuestion, isTest, lastAsk, keyOf, onInboxPage } = IB;
  const pref = {
    get() { try { return localStorage.getItem('aigile.alerts') === '1'; } catch { return false; } },
    set(on) { try { localStorage.setItem('aigile.alerts', on ? '1' : '0'); } catch {} },
  };
  const canNotify = () => typeof Notification !== 'undefined';
  const alertsOn = () => canNotify() && Notification.permission === 'granted' && pref.get();

  const baseTitle = document.title || 'AI-gile';

  /* ---------- top bar (AIG-32, AIG-34) ---------- */
  function slot() {
    let s = el('inboxTop');
    if (!s) {   // fallback if the page has no container
      s = document.createElement('span'); s.id = 'inboxTop';
      const live = el('live'); live.parentNode.insertBefore(s, live);
    }
    return s;
  }
  function counts() {
    return { q: IB.items.filter(isQuestion).length, k: IB.items.filter(isTask).length, t: IB.items.filter(isTest).length, f: IB.friends() };
  }
  function paintTop() {
    const { q, k, t: te, f } = counts();   // te: a local `t` would hide the t() text function
    const label = (q ? t(q === 1 ? 'inbox.sum.q.one' : 'inbox.sum.q.many', { n: q }) : '') + (k ? t(k === 1 ? 'inbox.sum.k.one' : 'inbox.sum.k.many', { n: k }) : '') + (te ? t('inbox.sum.t', { n: te }) : '') + (f ? t(f === 1 ? 'inbox.sum.f.one' : 'inbox.sum.f.many', { n: f }) : '') || t('inbox.sum.none');
    let alertBtn = '';
    if (canNotify()) {
      const on = alertsOn(), blocked = Notification.permission === 'denied';
      alertBtn = `<button class="ib-alerts ${on ? 'on' : ''}" id="ibAlerts" title="${esc(blocked ? t('inbox.alerts.blocked.title') : on ? t('inbox.alerts.off.title') : t('inbox.alerts.on.title'))}" ${blocked ? 'disabled' : ''}>${esc(blocked ? t('inbox.alerts.blocked') : on ? t('inbox.alerts.on') : t('inbox.alerts.turnon'))}</button>`;
    }
    const html = `<a class="ib-btn ${onInboxPage() ? 'on' : ''}" href="#/inbox" aria-label="${esc(t('inbox.btn.aria', { label }))}" title="${esc(label)}">${esc(t('inbox.btn'))}
        ${q ? `<span class="ib-badge q" data-only="q">${esc(t(q === 1 ? 'inbox.badge.q.one' : 'inbox.badge.q.many', { n: q }))}</span>` : ''}
        ${k ? `<span class="ib-badge k" data-only="k">${esc(t('inbox.badge.k', { n: k }))}</span>` : ''}
        ${te ? `<span class="ib-badge t" data-only="t">${esc(t('inbox.badge.t', { n: te }))}</span>` : ''}
        ${f ? `<span class="ib-badge q" data-friends="1">${esc(t('inbox.badge.f', { n: f }))}</span>` : ''}</a>${alertBtn}`;
    const s = slot();
    if (s.dataset.sig !== html) {
      s.dataset.sig = html; s.innerHTML = html;
      // A chip shows only that kind (AIG-187); the Inbox word itself shows everything.
      // The chip counts every project, so it opens the All tab: on one project's tab it could show nothing (AIG-288).
      s.querySelector('.ib-btn').onclick = e => { const b = e.target.closest('[data-only]'); IB.only = b ? b.dataset.only : ''; if (b) { IB.tab = 'all'; IB.kindFilter = ''; } if (el('ib')) IB.paintPage(); };
      const b = el('ibAlerts'); if (b) b.onclick = toggleAlerts;
    }
    // Everything waiting on the owner; the desktop app turns this count into its taskbar badge (AIG-76).
    // Going quiet (AIG-227): no count, so no purple diamond on the taskbar until the morning.
    const title = q + k + te + f && !document.documentElement.hasAttribute('data-night') && !document.documentElement.hasAttribute('data-focus') ? `(${q + k + te + f}) ${baseTitle}` : baseTitle;
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
    if (!alertsOn() || document.documentElement.hasAttribute('data-focus')) return;   // 🎯 focus mode: no sound, no pop-ups (AIG-395)
    beep();
    const one = fresh.length === 1 ? fresh[0] : null;
    const a = one && lastAsk(one);
    const n = new Notification(one ? t('inbox.notify.one', { who: a.author, id: one.id }) : t('inbox.notify.many', { n: fresh.length }), {
      body: one ? `${one.projectName}: ${String(a.text).replace(/\s+/g, ' ').slice(0, 160)}` : fresh.map(c => c.id + ' ' + c.title).join('\n').slice(0, 200),
      tag: 'aigile-question-' + (one ? keyOf(one) : 'many'),
    });
    n.onclick = () => {
      try { window.focus(); } catch {}
      IB.flashKey = one ? keyOf(one) : null;
      IB.tab = 'all';   // so the question is visible whatever tab was open
      if (onInboxPage()) IB.show(true); else location.hash = '#/inbox';
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
  Object.assign(IB, { paintTop, announce, toggleAlerts });
})();
