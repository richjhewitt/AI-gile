// 🌙 Assumptions page (#/assumptions, AIG-477): what the team guessed while you were away, newest first, by project.
// Buttons: OK (fine as is), Change this (tells the team on the card), Make a card (a backlog card from it).
const Assumptions = (() => {
  const A = { data: [] };
  const strip = s => String(s || '').replace(/^[\s>*_-]*Assumption:\s*/i, '');
  const find = k => { const [slug, id, at] = k.split('|'); return A.data.find(a => a.slug === slug && a.id === id && a.at === at); };
  const repaint = async () => { await A.load(); $('app').innerHTML = A.render(); };
  A.load = async () => { try { A.data = await api('GET', '/api/assumptions'); } catch { A.data = []; } };
  A.render = () => {
    if (!A.data.length) return `<div class="uz"><h2>🌙 Assumptions</h2><p class="muted">Nothing yet. When the team guesses while you're away, it shows here.</p></div>`;
    const by = {}; A.data.forEach(a => (by[a.project] = by[a.project] || []).push(a));
    return `<div class="uz"><h2>🌙 Assumptions</h2><p class="muted">What the team guessed while you were away. OK it, change it, or make a card.</p>`
      + Object.keys(by).map(pn => `<h3>${esc(pn)}</h3>` + by[pn].map(a => {
        const k = esc([a.slug, a.id, a.at].join('|'));
        const done = { ok: '✅ OK', change: '✏️ Change asked', card: '🗂️ Card made' }[a.state];
        return `<div class="uz-card"><div><a href="#/p/${esc(a.slug)}/${esc(a.id)}">${esc(a.id)}</a> ${esc(a.title)} <span class="muted">· ${esc(a.author)} · ${esc(ago(a.at))}</span></div>`
          + `<p>${esc(strip(a.text))}</p>`
          + (done ? `<p class="muted">${done} <button onclick="Assumptions.act('${k}','')">undo</button></p>`
            : `<p><button class="good" onclick="Assumptions.act('${k}','ok')">OK</button> <button onclick="Assumptions.change('${k}')">Change this</button> <button onclick="Assumptions.act('${k}','card')">Make a card</button></p>`)
          + `</div>`;
      }).join('')).join('') + `</div>`;
  };
  A.act = async (k, state) => {
    const a = find(k); if (!a) return;
    try {
      if (state === 'card') await api('POST', `/api/projects/${a.slug}/cards`, { title: 'Assumption: ' + strip(a.text).slice(0, 80), description: `- From ${a.id}\n\n- ${strip(a.text)}`, status: 'backlog' });
      await api('POST', '/api/assumptions/resolve', { slug: a.slug, id: a.id, at: a.at, state });
      await repaint();
    } catch (e) { alert(e.message); }
  };
  A.change = async k => {
    const a = find(k); if (!a) return;
    const note = prompt('What should change?'); if (!note) return;
    try {
      await api('POST', `/api/projects/${a.slug}/cards/${a.id}/comments`, { author: me(), text: 'Change this assumption: ' + note + '\n\n(' + strip(a.text) + ')' });
      await api('POST', '/api/assumptions/resolve', { slug: a.slug, id: a.id, at: a.at, state: 'change' });
      await repaint();
    } catch (e) { alert(e.message); }
  };
  return A;
})();
