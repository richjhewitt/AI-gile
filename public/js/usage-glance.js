/* ---------- ⚡ Usage at a glance (AIG-356) ---------- */
// Two tiny bars inside the ⚡ Usage nav link: 5-hour and weekly % left. Same colour rule as the usage page (uzStatus:
// 50+ green, 20+ amber, else red). Once a minute from GET /api/limits/latest (a log read, no tokens).
// No reading: a grey dash. ⛔ when No Token Mode is on, a red dot when the token budget (AIG-353) is reached.
const UsageGlance = (() => {
  let d = null, shown = '';
  const left = w => {   // % left for one window, or null when unknown or reset since the reading
    if (!w || w.pct == null) return null;
    const r = w.resets == null ? 0 : new Date(typeof w.resets === 'number' && w.resets < 1e12 ? w.resets * 1000 : w.resets).getTime();
    if (r && r < Date.now()) return null;
    return Math.max(0, Math.min(100, Math.round(100 - w.pct)));
  };
  const cls = v => v >= 50 ? 'g' : v >= 20 ? 'a' : 'r';
  const bar = v => `<i class="ug-bar${v == null ? ' none' : ' ' + cls(v)}"><b style="width:${v == null ? 0 : Math.max(v, 8)}%"></b></i>`;
  // The same % left as the Usage page: both windows, or null when unknown (AIG-937). Home shows this instead of token totals.
  const vals = () => { const l = d && d.latest; return { h5: l ? left(l.h5) : null, wk: l ? left(l.wk) : null }; };
  const homeHtml = () => { const v = vals(); return v.h5 == null && v.wk == null ? '' : t('home.uz.html', { h5: v.h5 == null ? '–' : v.h5 + t('usage.pctleft'), wk: v.wk == null ? '–' : v.wk + t('usage.pctleft') }) + ' <span class="muted"> · <b>' + esc(t('home.usage.left')) + '</b></span>'; };
  function paintHome() { const h = document.getElementById('homeUsage'); if (!h) return; const html = homeHtml(); if (h.innerHTML !== html) h.innerHTML = html; h.hidden = !html || NoAi.on; }
  function paint() {
    paintHome();
    const el = document.getElementById('ugBars'), a = document.getElementById('usageNav'); if (!el || !a) return;
    const nt = NoTokens.on, l = d && d.latest, h5 = l ? left(l.h5) : null, wk = l ? left(l.wk) : null;
    const sv = d && d.saving, key = JSON.stringify([h5, wk, l && l.at, nt, d && d.over, sv, i18n.lang, Math.floor(Date.now() / 60e3)]);
    if (key === shown) return; shown = key;
    const nothing = h5 == null && wk == null, pc = v => v == null ? '–' : v + '%';
    const bar2 = document.getElementById('saverBar');   // 💾 usage saver (AIG-550)
    if (bar2) { bar2.hidden = !sv; bar2.textContent = sv ? t('saver.banner', { pct: sv.pct, name: sv.name, save: sv.save }) : ''; }
    el.innerHTML = (nothing ? '<span class="ug-dash">–</span>' : `<span class="ug-bars">${bar(h5)}${bar(wk)}</span>`)
      + (nt ? '<span class="ug-nt">⛔</span>' : '') + (d && d.over ? '<span class="ug-dot"></span>' : '');
    const tips = [nothing ? t('ug.none') : t('ug.title', { h5: pc(h5), wk: pc(wk), when: ago(l.at) })];
    if (nt) tips.push(t('ug.nt'));
    if (d && d.over) tips.push(t('ug.over'));
    a.title = tips.join('\n');
  }
  async function poll() { try { d = await api('GET', '/api/limits/latest'); } catch { return; } paint(); }
  function start() { poll(); setInterval(poll, 60e3); setInterval(paint, 2000); }
  return { start, poll, paint, vals, homeHtml };
})();
