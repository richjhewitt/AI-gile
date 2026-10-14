/* ---------- attachments (AIG-77): paste a screenshot or pick files in a reply box; uploaded on send ---------- */
// Pending files live here (key -> File[]), not in the page, so the 1s poll can't lose them.
// A reply box is any .reply or .verdict (card), .ib-item (inbox) or .dialog (new card) holding Attach.boxHtml(key).
const Attach = (() => {
  const MAX = 10 * 1024 * 1024;
  const pending = new Map();
  const list = key => pending.get(key) || [];
  const isImg = a => /^image\//.test(a.type || '') || /\.(png|jpe?g|gif|webp)$/i.test(a.name || '');
  // Images show a thumbnail; clicking it opens a full-size preview, to check it's the right one (AIG-129).
  const urls = new WeakMap(), urlOf = f => { if (!urls.has(f)) urls.set(f, URL.createObjectURL(f)); return urls.get(f); };
  const chips = key => list(key).map((f, i) => `<span class="att-chip">${isImg(f) ? `<img class="att-thumb" src="${urlOf(f)}" data-att-view="${i}" alt="" title="${esc(t('attach.preview'))}">` : '📎'} <span class="att-name" title="${esc(f.name)}">${esc(f.name)}</span><button type="button" data-att-del="${i}" title="${esc(t('attach.remove'))}">✕</button></span>`).join('');
  function preview(src) {
    const lb = document.createElement('div');
    lb.className = 'att-lightbox'; lb.title = t('attach.close');
    lb.innerHTML = `<img src="${src}" alt="">`;
    const close = () => { lb.remove(); document.removeEventListener('keydown', esc_, true); };
    const esc_ = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    lb.onclick = close; document.addEventListener('keydown', esc_, true);
    document.body.appendChild(lb);
  }
  // Any picture under a comment, card, DM or AI tester evidence (.att-shown) opens full size; arrows move between the item's pictures.
  function gallery(imgs, at) {
    const lb = document.createElement('div');
    lb.className = 'att-lightbox'; lb.title = t('attach.close');
    const img = document.createElement('img'); lb.appendChild(img);
    const show = () => { img.src = imgs[at].src; img.alt = imgs[at].alt || ''; };
    const close = () => { lb.remove(); document.removeEventListener('keydown', key_, true); };
    const key_ = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (arrowStep(e) && imgs.length > 1) { e.preventDefault(); e.stopPropagation(); at = (at + (arrowStep(e) > 0 ? 1 : imgs.length - 1)) % imgs.length; show(); }
    };
    lb.onclick = close; document.addEventListener('keydown', key_, true);
    show(); document.body.appendChild(lb);
  }
  document.addEventListener('click', e => {
    const img = e.target.closest('.att-shown a > img, img.gif-inline'); if (!img || e.button) return;
    e.preventDefault(); e.stopPropagation();
    const scope = img.closest('.ib-item, .ib-fl, .comment, .dm-msg, .ai-ev, .att-shown') || img.parentNode;
    const imgs = [...scope.querySelectorAll('.att-shown a > img, img.gif-inline')];
    gallery(imgs, Math.max(0, imgs.indexOf(img)));
  }, true);
  const boxHtml = key => `<span class="att" data-att-key="${esc(key)}"><button type="button" class="att-btn" title="${esc(t('attach.title'))}">${esc(t('attach.btn'))}</button><button type="button" class="att-gif" title="${esc(t('gif.title'))}" aria-label="${esc(t('gif.title'))}">${esc(t('gif.btn'))}</button><input type="file" multiple hidden><span class="att-list">${chips(key)}</span></span>`;
  const paint = key => document.querySelectorAll('.att').forEach(b => { if (b.dataset.attKey === key) b.querySelector('.att-list').innerHTML = chips(key); });
  const add = (key, files) => { pending.set(key, [...list(key), ...files.filter(f => f.size)]); paint(key); };
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  document.addEventListener('click', e => {
    const box = e.target.closest('.att'); if (!box) return;
    if (e.target.closest('.att-btn')) box.querySelector('input[type=file]').click();
    if (e.target.closest('.att-gif')) gifPicker(e.target.closest('.att-gif'), box);
    const view = e.target.closest('[data-att-view]');
    if (view) preview(view.src);
    const del = e.target.closest('[data-att-del]');
    if (del) { const k = box.dataset.attKey, l = list(k); l.splice(+del.dataset.attDel, 1); pending.set(k, l); paint(k); }
  });
  document.addEventListener('change', e => {
    const box = e.target.closest && e.target.closest('.att');
    if (box && e.target.type === 'file') { add(box.dataset.attKey, [...e.target.files]); e.target.value = ''; }
  });
  // 🎞️ GIF search (AIG-343): the board's server asks Giphy and downloads the pick; it joins the box like an attached file.
  let gifEl = null, gifKey = null;
  function closeGif() { if (gifEl) gifEl.remove(); gifEl = null; document.removeEventListener('keydown', gifKey, true); document.removeEventListener('mousedown', gifOut, true); }
  const gifOut = e => { if (gifEl && !gifEl.contains(e.target) && !e.target.closest('.att-gif')) closeGif(); };
  async function gifPicker(btn, box) {
    if (gifEl) { closeGif(); return; }
    const el = gifEl = document.createElement('div'); el.className = 'gif-picker';
    const r = btn.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - 360)) + 'px';
    if (r.bottom + 380 > innerHeight && r.top > 380) el.style.bottom = (innerHeight - r.top + 4) + 'px'; else el.style.top = (r.bottom + 4) + 'px';
    gifKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeGif(); } };
    document.addEventListener('keydown', gifKey, true); document.addEventListener('mousedown', gifOut, true);
    document.body.appendChild(el);
    let has = false; try { has = (await api('GET', '/api/giphy')).key; } catch {}
    if (gifEl !== el) return;
    if (!has) { el.innerHTML = `<div class="gif-nokey"><a href="#/setup">${esc(t('gif.nokey'))}</a></div>`; el.querySelector('a').onclick = closeGif; return; }
    el.innerHTML = `<input type="search" class="gif-q" maxlength="50" placeholder="${esc(t('gif.search'))}"><div class="gif-msg muted"></div><div class="gif-grid"></div><div class="gif-foot"><span>${esc(t('gif.powered'))}</span><button type="button" class="gif-more" hidden>${esc(t('gif.more'))}</button></div>`;
    const q = el.querySelector('.gif-q'), grid = el.querySelector('.gif-grid'), msg = el.querySelector('.gif-msg'), more = el.querySelector('.gif-more');
    let next = null, seq = 0;
    const load = async (append) => {
      const my = ++seq; msg.textContent = t('gif.loading');
      try {
        const j = await api('POST', '/api/giphy/search', { q: q.value, offset: append ? next : 0 });
        if (my !== seq || gifEl !== el) return;
        if (!append) grid.innerHTML = '';
        grid.insertAdjacentHTML('beforeend', j.results.map(g => `<button type="button" class="gif-tile" data-id="${esc(g.id)}" title="${esc(g.title)}"><img src="${esc(g.preview)}" alt="${esc(g.title)}" loading="lazy" referrerpolicy="no-referrer"></button>`).join(''));
        next = j.next; more.hidden = next === null; msg.textContent = grid.children.length ? '' : t('gif.none');
      } catch (err) { if (my === seq) msg.textContent = err.message; }
    };
    let timer; q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => load(false), 400); };
    q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); load(false); } };
    more.onclick = () => load(true);
    grid.onclick = async e => {
      const tile = e.target.closest('.gif-tile'); if (!tile || tile.disabled) return;
      tile.disabled = true; msg.textContent = t('gif.adding');
      try {
        const g = await api('POST', '/api/giphy/pick', { id: tile.dataset.id });
        const bin = atob(g.data), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        add(box.dataset.attKey, [new File([bytes], g.name, { type: g.type })]); closeGif();
      } catch (err) { tile.disabled = false; msg.textContent = err.message; }
    };
    q.focus(); load(false);
  }
  // Pasting an image into a reply box attaches it; pasted text still goes in as text.
  // The DM chat composer (.dm-compose, AIG-474) takes pasted and dropped files too.
  const dropBox = e => { const c = e.target.closest && e.target.closest('.dm-compose'); return c && c.querySelector('.att'); };
  document.addEventListener('dragover', e => { if (dropBox(e) && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    const box = dropBox(e), files = box && [...e.dataTransfer.files]; if (!files || !files.length) return;
    e.preventDefault(); add(box.dataset.attKey, files);
  });
  document.addEventListener('paste', e => {
    const ta = e.target.closest && e.target.closest('textarea, input[type=text]'), scope = ta && ta.closest('.reply, .verdict, .ib-item, .dialog, .dm-compose'), box = scope && scope.querySelector('.att');
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
      if (f.size > MAX) throw new Error(t('attach.toobig', { name: f.name }));
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      const a = await api('POST', `/api/projects/${slug}/attachments`, { name: f.name, type: f.type, data });
      out.push({ id: a.id, type: a.type });
    }
    return out;
  }
  // For a private DM (AIG-111): the pending files as { name, type, data } to send inside the sealed message.
  async function read(key) {
    const out = [];
    for (const f of list(key)) {
      if (f.size > MAX) throw new Error(t('attach.toobig', { name: f.name }));
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      out.push({ name: f.name, type: f.type, data });
    }
    return out;
  }
  const clear = key => { pending.delete(key); paint(key); };
  const has = key => list(key).length > 0;
  // Under a comment: thumbnails for images (click for full size), links for other files.
  const shown = (m, slug, base = `/api/projects/${slug}/attachments`) => m.attachments && m.attachments.length ? `<div class="att-shown">${m.attachments.map(a => {
    const u = `${base}/${encodeURIComponent(a.id)}`;
    return isImg(a) ? `<a href="${u}" target="_blank" title="${esc(a.name)}"><img src="${u}" alt="${esc(a.name)}" loading="lazy"></a>` : `<a href="${u}" target="_blank" class="att-file">📎 ${esc(a.name)}</a>`;
  }).join('')}</div>` : '';

  return { boxHtml, upload, read, clear, has, shown };
})();
