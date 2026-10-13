/* ---------- 🌍 public boards (AIG-602, AIG-605) ---------- */
// A project is Private (the default; 🔒 hides it while streaming) or Public (watched live at <relay>/b/<name>), never both.
// The Look dialog has the tick and the name; the board header has 🌍 Copy public link with the viewer count (from the relay's
// public JSON, via GET /api/projects/<slug>/public). lib/publicboard.js sends the snapshots; switching to Private deletes it.
const Pub = (() => {
  let info = null;
  const copyBtn = p => p.public ? `<button type="button" id="pubBtn" class="pub-btn" onclick="Pub.copy()" title="${esc(t('pub.copy.title'))}">🌍 ${esc(t('pub.copy'))} <span class="muted" id="pubViewers"></span></button>` : '';
  // The Look dialog part: ticks that exclude each other, the name, and the link button.
  function lookHtml(p) {
    return `<label class="chk"><input type="checkbox" id="look-personal" ${p.personal ? 'checked' : ''} onchange="Pub.tick('personal')"> 🏡 ${esc(t('pub.personal'))} <span class="muted">${esc(t('pub.personal.sub'))}</span></label>
      <label class="chk"><input type="checkbox" id="look-public" ${p.public ? 'checked' : ''} onchange="Pub.tick('public')"> 🌍 ${esc(t('pub.public'))} <span class="muted">${esc(t('pub.public.sub'))}</span></label>
      <label class="f" id="look-pubname-box" ${p.public ? '' : 'hidden'}><span>${esc(t('pub.name'))}</span><input type="text" id="look-pubname" value="${esc(p.publicName || '')}" placeholder="${esc(p.slug)}" maxlength="40" autocomplete="off"><small class="muted">${esc(t('pub.name.help'))}</small></label>
      ${p.public ? `<div><button type="button" id="look-pubcopy" onclick="Pub.copy(this)">🌍 ${esc(t('pub.copy'))}</button> <small class="muted" id="look-pubinfo"></small></div>` : ''}`;
  }
  function tick(which) {
    // Public, Private and Personal (AIG-637) exclude each other: the one just ticked wins.
    const pu = $('look-public'), pr = $('look-private'), pe = $('look-personal');
    const on = { public: pu, private: pr, personal: pe }[which];
    if (on && on.checked) for (const el of [pu, pr, pe]) if (el && el !== on) el.checked = false;
    const box = $('look-pubname-box'); if (box) box.hidden = !pu.checked;
  }
  async function status() { try { info = await api('GET', '/api/projects/' + slug() + '/public'); } catch { info = null; } return info; }
  async function copy(btn) {
    const s = await status(); if (!s || !s.on) return;
    const b = btn || $('pubBtn'), was = b.dataset.was || (b.dataset.was = b.innerHTML);
    try { await navigator.clipboard.writeText(s.url); b.textContent = '✔ ' + t('format.copied'); } catch (e) { b.textContent = s.url; }
    setTimeout(() => { b.innerHTML = was; }, 2000);
    if ($('look-pubinfo')) $('look-pubinfo').textContent = s.error || t('pub.viewers', { count: s.viewers });
  }
  // The viewer count on the board header, asked now and then while the project is open.
  async function paint() {
    const el = $('pubViewers'); if (!el) return;
    const s = await status(); if (!s || !$('pubViewers')) return;
    $('pubViewers').textContent = s.error ? '⚠ ' + s.error : s.live ? t('pub.viewers', { count: s.viewers }) : '';
  }
  PagePoll.every(() => { if ($('pubViewers')) return paint(); }, 5000);   // the board header is redrawn often; this fills the count in again
  return { copyBtn, lookHtml, tick, copy, paint };
})();
