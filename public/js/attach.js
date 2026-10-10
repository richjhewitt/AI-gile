/* ---------- attachments (AIG-77): paste a screenshot or pick files in a reply box; uploaded on send ---------- */
// Pending files live here (key -> File[]), not in the page, so the 1s poll can't lose them.
// A reply box is any .reply (card) or .ib-item (inbox) holding Attach.boxHtml(key).
const Attach = (() => {
  const MAX = 10 * 1024 * 1024;
  const pending = new Map();
  const list = key => pending.get(key) || [];
  const isImg = a => /^image\//.test(a.type || '') || /\.(png|jpe?g|gif|webp)$/i.test(a.name || '');
  const chips = key => list(key).map((f, i) => `<span class="att-chip">${isImg(f) ? '🖼' : '📎'} ${esc(f.name)} <button type="button" data-att-del="${i}" title="Remove">✕</button></span>`).join('');
  const boxHtml = key => `<span class="att" data-att-key="${esc(key)}"><button type="button" class="att-btn" title="Attach a file, or paste a screenshot into the reply box">📎 Attach</button><input type="file" multiple hidden><span class="att-list">${chips(key)}</span></span>`;
  const paint = key => document.querySelectorAll('.att').forEach(b => { if (b.dataset.attKey === key) b.querySelector('.att-list').innerHTML = chips(key); });
  const add = (key, files) => { pending.set(key, [...list(key), ...files.filter(f => f.size)]); paint(key); };
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  document.addEventListener('click', e => {
    const box = e.target.closest('.att'); if (!box) return;
    if (e.target.closest('.att-btn')) box.querySelector('input[type=file]').click();
    const del = e.target.closest('[data-att-del]');
    if (del) { const k = box.dataset.attKey, l = list(k); l.splice(+del.dataset.attDel, 1); pending.set(k, l); paint(k); }
  });
  document.addEventListener('change', e => {
    const box = e.target.closest && e.target.closest('.att');
    if (box && e.target.type === 'file') { add(box.dataset.attKey, [...e.target.files]); e.target.value = ''; }
  });
  // Pasting an image into a reply box attaches it; pasted text still goes in as text.
  document.addEventListener('paste', e => {
    const ta = e.target.closest && e.target.closest('textarea'), scope = ta && ta.closest('.reply, .ib-item'), box = scope && scope.querySelector('.att');
    const files = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (!box || !files.length) return;
    e.preventDefault();
    add(box.dataset.attKey, files.map((f, i) => !f.name || f.name === 'image.png'
      ? new File([f], `screenshot-${stamp()}${files.length > 1 ? '-' + (i + 1) : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }) : f));
  });

  // Uploads the pending files and returns them for the comment ({ id, type }); call clear(key) once it's sent.
  async function upload(key, slug) {
    const out = [];
    for (const f of list(key)) {
      if (f.size > MAX) throw new Error(f.name + ' is over 10 MB');
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      const a = await api('POST', `/api/projects/${slug}/attachments`, { name: f.name, type: f.type, data });
      out.push({ id: a.id, type: a.type });
    }
    return out;
  }
  const clear = key => { pending.delete(key); paint(key); };
  const has = key => list(key).length > 0;
  // Under a comment: thumbnails for images (click for full size), links for other files.
  const shown = (m, slug) => m.attachments && m.attachments.length ? `<div class="att-shown">${m.attachments.map(a => {
    const u = `/api/projects/${slug}/attachments/${encodeURIComponent(a.id)}`;
    return isImg(a) ? `<a href="${u}" target="_blank" title="${esc(a.name)}"><img src="${u}" alt="${esc(a.name)}" loading="lazy"></a>` : `<a href="${u}" target="_blank" class="att-file">📎 ${esc(a.name)}</a>`;
  }).join('')}</div>` : '';

  return { boxHtml, upload, clear, has, shown };
})();
