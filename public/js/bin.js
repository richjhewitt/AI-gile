// 🗑 The Assistant's bin (#/bin, AIG-840): every message the firewall kept away (lib/firewall.js), newest first, with
// "Let it through" to post one anyway. Reached from a small link in the inbox head (inbox-items.js), not the top bar.
const Bin = (() => {
  const B = { data: { items: [], kept: 0, today: 0 }, err: '' };
  B.load = async () => { try { B.data = await api('GET', '/api/firewall'); } catch { B.data = { items: [], kept: 0, today: 0 }; } };
  const reasonText = e => t('bin.why.' + e.reason) !== 'bin.why.' + e.reason ? t('bin.why.' + e.reason) : e.reason;
  const head = () => t('bin.count', { n: B.data.kept, today: B.data.today });
  // The inbox link: "🗑 Bin (N)".
  B.paintLink = async () => {
    await B.load();
    const a = document.getElementById('ibBin'); if (a) a.textContent = t('bin.link', { n: B.data.kept });
  };
  B.render = () => {
    const items = B.data.items || [];
    const row = e => `<div class="uz-card bin-item" data-id="${esc(e.id)}" style="overflow-wrap:anywhere">
      <div class="muted">${esc(ago(e.at))} · ${esc(e.project)}${e.card ? ' · <a href="#/p/' + esc(e.project) + '/' + esc(e.card) + '">' + esc(e.card) + '</a>' : ''} · ${esc(e.author)}</div>
      <p class="bin-why"><b>${esc(reasonText(e))}</b></p>
      <p class="bin-text" style="white-space:pre-wrap;max-width:100%">${esc(e.text.length > 600 ? e.text.slice(0, 600) + '…' : e.text)}</p>
      <p><button class="bin-let" style="min-height:40px" onclick="Bin.let('${esc(e.id)}', this)">${esc(t('bin.let'))}</button></p></div>`;
    return `<div class="uz"><h2>${esc(t('bin.title'))}</h2><p class="muted bin-count">${esc(head())}</p><p class="muted">${esc(t('bin.intro'))}</p>`
      + (B.err ? `<p class="bin-err" style="color:var(--bad,#c33)">${esc(B.err)}</p>` : '')
      + (items.length ? items.map(row).join('') : `<p class="muted bin-empty">${esc(t('bin.empty'))}</p>`) + `</div>`;
  };
  B.let = async (id, btn) => {
    btn.disabled = true; B.err = '';
    try { await api('POST', '/api/firewall/' + encodeURIComponent(id) + '/release'); } catch (e) { B.err = e.message; }
    await B.load(); if (/^#\/bin/.test(location.hash)) $('app').innerHTML = B.render();
  };
  return B;
})();
