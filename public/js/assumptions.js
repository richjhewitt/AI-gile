// 🌙 Assumptions page (#/assumptions, AIG-477): what the team guessed while you were away, newest first, by project.
// Buttons: 👍 fine (marks it ok) and ✋ plug this (a reply box; the reply goes to the card as your comment, which wakes the team).
const Assumptions = (() => {
  const A = { data: [], plugging: '' };
  const strip = s => String(s || '').replace(/^[\s>*_-]*Assumption:\s*/i, '');
  const find = k => { const [slug, id, at] = k.split('|'); return A.data.find(a => a.slug === slug && a.id === id && a.at === at); };
  const repaint = async () => { await A.load(); $('app').innerHTML = A.render(); };
  A.load = async () => { try { A.data = await api('GET', '/api/assumptions'); } catch { A.data = []; } A.badge(); };
  // The count of unreviewed entries on the top-bar link.
  A.badge = () => { const n = A.data.filter(a => !a.state).length, b = $('assumeBadge'); if (b) { b.textContent = n || ''; b.hidden = !n; } };
  A.watch = async () => { try { A.data = await api('GET', '/api/assumptions'); A.badge(); } catch {} };
  A.render = () => {
    if (!A.data.length) return `<div class="uz"><h2>${esc(t('assume.title'))}</h2><p class="muted">${esc(t('assume.empty'))}</p></div>`;
    const by = {}; A.data.forEach(a => (by[a.project] = by[a.project] || []).push(a));
    return `<div class="uz"><h2>${esc(t('assume.title'))}</h2><p class="muted">${esc(t('assume.intro'))}</p>`
      + Object.keys(by).map(pn => `<h3>${esc(pn)}</h3>` + by[pn].map(a => {
        const k = esc([a.slug, a.id, a.at].join('|'));
        const done = { ok: t('assume.done.ok'), plug: t('assume.done.plug') }[a.state];
        return `<div class="uz-card as-item"><div><a href="#/p/${esc(a.slug)}/${esc(a.id)}">${esc(a.id)}</a> ${esc(a.title)} <span class="muted">· ${esc(a.author)} · ${esc(ago(a.at))}</span></div>`
          + `<p>${esc(strip(a.text))}</p>`
          + (done ? `<p class="muted">${esc(done)} <button onclick="Assumptions.act('${k}','')">${esc(t('assume.undo'))}</button></p>`
            : A.plugging === k ? `<p><textarea class="as-reply" rows="2" placeholder="${esc(t('assume.reply.ph'))}"></textarea> <button class="good as-send" onclick="Assumptions.send('${k}', this)">${esc(t('assume.send'))}</button> <button onclick="Assumptions.plug('')">${esc(t('assume.cancel'))}</button></p>`
            : `<p><button class="good as-ok" onclick="Assumptions.act('${k}','ok')">${esc(t('assume.ok'))}</button> <button class="as-plug" onclick="Assumptions.plug('${k}')">${esc(t('assume.plug'))}</button></p>`)
          + `</div>`;
      }).join('')).join('') + `</div>`;
  };
  A.act = async (k, state) => {
    const a = find(k); if (!a) return;
    try { await api('POST', '/api/assumptions/resolve', { slug: a.slug, id: a.id, at: a.at, state }); await repaint(); } catch (e) { alert(e.message); }
  };
  A.plug = k => { A.plugging = k; $('app').innerHTML = A.render(); const r = document.querySelector('.as-reply'); if (r) r.focus(); };
  // The reply goes to the card as an owner comment, so the team is woken; the entry is marked plugged.
  A.send = async (k, btn) => {
    const a = find(k), note = (btn.parentNode.querySelector('.as-reply').value || '').trim(); if (!a || !note) return;
    try {
      await api('POST', `/api/projects/${a.slug}/cards/${a.id}/comments`, { author: me(), text: t('assume.plug.comment', { note, what: strip(a.text) }) });
      await api('POST', '/api/assumptions/resolve', { slug: a.slug, id: a.id, at: a.at, state: 'plug' });
      A.plugging = ''; await repaint();
    } catch (e) { alert(e.message); }
  };
  return A;
})();
