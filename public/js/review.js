/* ---------- 📆 Monthly service review (#/review/<slug>?month=YYYY-MM, AIG-1155) ----------
   Plain-code numbers from GET /api/projects/:slug/review?month=: incidents, time to fix, reply targets, uptime, tokens, servers.
   The ✍️ Summary button asks the on-call agent for two lines (POST .../review/summary); it is off with No Token Mode / AI off. */
const ReviewPage = (() => {
  const R = { data: null, slug: '', month: '', summary: null, busy: false };
  R.load = async (slug, month) => {
    if (R.slug !== slug || R.month !== month) { R.slug = slug; R.month = month; R.data = null; R.summary = null; }
    try { R.data = await api('GET', `/api/projects/${slug}/review${month ? '?month=' + encodeURIComponent(month) : ''}`); } catch (e) { R.data = { error: e.message || true }; }
  };
  R.go = m => { location.hash = `#/review/${R.slug}?month=${m}`; };
  R.ask = async () => {
    R.busy = true; R.summary = null; state.lastSig = state.lastBoardSig = null; render();
    try { R.summary = await api('POST', `/api/projects/${R.slug}/review/summary`, { month: R.data.month }); } catch (e) { R.summary = { ok: false, why: 'failed' }; }
    R.busy = false; state.lastSig = state.lastBoardSig = null; render();
  };
  const dur = min => min == null ? t('rev.none') : min < 60 ? t('rev.dur.min', { n: min }) : min < 2880 ? t('rev.dur.h', { n: +(min / 60).toFixed(1) }) : t('rev.dur.d', { n: +(min / 1440).toFixed(1) });
  const num = n => Number(n || 0).toLocaleString(i18n.locale);
  const tile = (id, v, k) => `<div class="st-tile" data-rev="${id}"><div class="st-v">${esc(v)}</div><div class="st-k">${esc(k)}</div></div>`;
  R.render = () => {
    const d = R.data, back = `<a href="#/p/${esc(R.slug)}">${esc(t('ci.back'))}</a>`;
    if (!d) return `<div class="uz rev-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz rev-page"><p>${back}</p><p class="muted" id="rev-error">${esc(t('rev.error'))}</p></div>`;
    const i = d.incidents, tk = d.tokens;
    const step = n => { const [y, m] = d.month.split('-').map(Number), x = new Date(y, m - 1 + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
    const prev = step(-1), next = d.month < d.months[0] ? step(1) : '';
    const nav = `<div class="rev-nav"><button type="button" id="rev-prev" ${prev ? `onclick="ReviewPage.go('${prev}')"` : 'disabled'}>${esc(t('rev.prev'))}</button>
      <select id="rev-month" onchange="ReviewPage.go(this.value)">${[...new Set([...d.months, d.month])].sort().reverse().map(m => `<option value="${m}"${m === d.month ? ' selected' : ''}>${m}</option>`).join('')}</select>
      <button type="button" id="rev-next" ${next ? `onclick="ReviewPage.go('${next}')"` : 'disabled'}>${esc(t('rev.next'))}</button></div>`;
    const srv = d.servers.length ? `<h3>${esc(t('rev.servers'))}</h3><ul class="st-rec" id="rev-servers">${d.servers.map(s => `<li data-server="${esc(s.name)}"><b>${esc(s.name)}</b>: ${s.readings ? esc(t('rev.server.peaks', { cpu: s.cpu, disk: s.disk, n: s.readings })) : esc(t('rev.server.none'))}</li>`).join('')}</ul>` : '';
    const sum = R.busy ? `<p class="muted" id="rev-summary">${esc(t('rev.summary.busy'))}</p>` : R.summary ? (R.summary.ok ? `<pre class="rev-sum" id="rev-summary">${esc(R.summary.text)}</pre>` : `<p class="muted" id="rev-summary">${esc(t(R.summary.why === 'noai' ? 'rev.summary.noai' : 'rev.summary.failed'))}</p>`) : '';
    return `<div class="uz rev-page"><p>${back}</p><h2>${esc(t('rev.h', { name: d.name }))}</h2>${nav}
      <div class="st-tiles">
        ${tile('opened', i.opened, t('rev.opened'))}${tile('closed', i.closed, t('rev.closed'))}${tile('fix', dur(i.avgFixMin), t('rev.fix'))}
        ${tile('replies', d.replies.of ? `${d.replies.met} / ${d.replies.of}` : t('rev.none'), t('rev.replies'))}
        ${tile('uptime', d.uptime == null ? t('rev.none') : d.uptime + '%', d.uptime == null ? t('rev.uptime.none') : t('rev.uptime', { n: dur(d.downMin) }))}
        ${tile('tokens', num(tk.in + tk.out), t('rev.tokens', { n: tk.runs }))}
      </div>
      ${i.list.length ? `<h3>${esc(t('rev.incidents'))}</h3><ul class="st-rec" id="rev-incidents">${i.list.map(c => `<li><a href="#/p/${esc(R.slug)}/${esc(c.id)}">${esc(c.id)}</a> ${esc(c.title)} <span class="pill">${esc(c.status)}</span></li>`).join('')}</ul>` : `<p class="muted">${esc(t('rev.incidents.none'))}</p>`}
      ${srv}
      <p><button type="button" id="rev-sum" onclick="ReviewPage.ask()" ${d.ai && !R.busy ? '' : 'disabled'} title="${esc(d.ai ? t('rev.summary.title') : t('rev.summary.noai'))}" aria-label="${esc(d.ai ? t('rev.summary.title') : t('rev.summary.noai'))}">${esc(t('rev.summary'))}</button></p>${sum}</div>`;
  };
  return R;
})();
