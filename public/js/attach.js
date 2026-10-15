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
  const revoke = f => { const u = urls.get(f); if (u) { URL.revokeObjectURL(u); urls.delete(f); } };   // a removed or sent file frees its preview (AIG-1090)
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
    const show = () => { img.src = imgs[at].dataset.full || imgs[at].src; img.alt = imgs[at].alt || ''; };
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
  const boxHtml = key => `<span class="att" data-att-key="${esc(key)}"><button type="button" class="att-btn" title="${esc(t('attach.title'))}">${esc(t('attach.btn'))}</button><button type="button" class="att-gif" title="${esc(t('gif.title'))}" aria-label="${esc(t('gif.title'))}">${esc(t('gif.btn'))}</button><input type="file" multiple hidden><span class="att-list">${chips(key)}</span><span class="att-progw">${progHtml(key)}</span></span>`;
  const paint = key => document.querySelectorAll('.att').forEach(b => { if (b.dataset.attKey === key) b.querySelector('.att-list').innerHTML = chips(key); });
  const add = (key, files) => { pending.set(key, [...list(key), ...files.filter(f => f.size)]); paint(key); };
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  document.addEventListener('click', e => {
    const box = e.target.closest('.att'); if (!box) return;
    if (e.target.closest('.att-btn')) box.querySelector('input[type=file]').click();
    if (e.target.closest('.att-gif')) gifPicker(e.target.closest('.att-gif'), box);
    if (e.target.closest('[data-att-cancel]')) cancel(box.dataset.attKey);   // AIG-1165
    const view = e.target.closest('[data-att-view]');
    if (view) preview(view.dataset.full || view.src);
    const del = e.target.closest('[data-att-del]');
    if (del) { const k = box.dataset.attKey, l = list(k); l.splice(+del.dataset.attDel, 1).forEach(revoke); pending.set(k, l); paint(k); }
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

  // Resumable uploads (AIG-1165, lib/uploads.js): each file goes in pieces with a progress bar and Cancel in the box. A piece
  // that fails is tried again; sending again picks up where it stopped (the board says which pieces it has).
  const jobs = new Map();   // key -> { ctl, cancelled, name, total, before, sent }
  const started = new WeakMap();   // File -> { base, id, done? }: the same file sent again resumes, or reuses the finished upload
  const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const pctOf = j => j.total ? Math.min(100, Math.floor((j.before + j.sent) * 100 / j.total)) : 0;
  const progHtml = key => { const j = jobs.get(key); return j ? `<span class="att-prog"><progress max="100" value="${pctOf(j)}"></progress><span class="att-pct">${esc(t('attach.uploading', { name: j.name, pct: pctOf(j) }))}</span><button type="button" class="att-cancel" data-att-cancel>${esc(t('attach.cancel'))}</button></span>` : ''; };
  function paintProg(key) {
    const j = jobs.get(key);
    document.querySelectorAll('.att').forEach(b => {
      if (b.dataset.attKey !== key) return;
      const w = b.querySelector('.att-progw'), bar = w && w.querySelector('progress'); if (!w) return;
      if (j && bar) { bar.value = pctOf(j); w.querySelector('.att-pct').textContent = t('attach.uploading', { name: j.name, pct: pctOf(j) }); }
      else w.innerHTML = progHtml(key);
    });
  }
  function cancel(key) { const j = jobs.get(key); if (j) { j.cancelled = true; j.ctl.abort(); } }
  // One file to <base>/uploads (base: /api/projects/<slug> or /api/dms/contacts/<id>); returns what /done answers.
  async function sendOne(key, base, f, j, extra) {
    const signal = j.ctl.signal, s = started.get(f);
    if (s && s.base === base && s.done) return s.done;
    let st = null;
    try {
      if (s && s.base === base) st = await api('GET', `${base}/uploads/${s.id}`, undefined, { signal }).catch(e => { if (j.cancelled) throw e; return null; });   // gone or expired: start again
      if (!st) { st = await api('POST', `${base}/uploads`, { name: f.name, type: f.type, size: f.size }, { signal }); started.set(f, { base, id: st.id }); }
      const size = n => Math.min(f.size, (n + 1) * st.chunk) - n * st.chunk;
      for (let round = 0; ; round++) {
        const got = new Set(st.received);
        j.sent = [...got].reduce((a, n) => a + size(n), 0); paintProg(key);
        for (let n = 0; n < st.chunks; n++) {
          if (got.has(n)) continue;
          const data = await b64(f.slice(n * st.chunk, n * st.chunk + size(n)));
          for (let tries = 0; ; tries++) {
            try { await api('POST', `${base}/uploads/${st.id}/${n}`, { data }, { signal }); break; }
            catch (e) { if (j.cancelled || tries >= 2) throw e; await new Promise(r => setTimeout(r, 500 * (tries + 1))); }
          }
          got.add(n); j.sent += size(n); paintProg(key);
        }
        try { const done = await api('POST', `${base}/uploads/${st.id}/done`, extra || {}, { signal }); started.set(f, { base, id: st.id, done }); return done; }
        catch (e) { if (j.cancelled || round >= 2 || !/pieces missing/.test(e.message || '')) throw e; st = await api('GET', `${base}/uploads/${st.id}`, undefined, { signal }); }   // a piece went missing: send it again
      }
    } catch (e) {
      if (!j.cancelled) throw e;
      const u = started.get(f); started.delete(f);
      if (u && !u.done) api('DELETE', `${base}/uploads/${u.id}`).catch(() => {});   // the board drops the pieces
      throw new Error(t('attach.cancelled'));
    }
  }
  async function sendAll(key, base, each) {
    const files = list(key); if (!files.length) return [];
    for (const f of files) if (f.size > MAX) throw new Error(t('attach.toobig', { name: f.name }));
    const j = { ctl: new AbortController(), cancelled: false, name: '', total: files.reduce((a, f) => a + f.size, 0), before: 0, sent: 0 };
    jobs.set(key, j); paintProg(key);
    try {
      const out = [];
      for (const f of files) { j.name = f.name; j.sent = 0; out.push(await each(f, j)); j.before += f.size; }
      return out;
    } finally { jobs.delete(key); paintProg(key); }
  }
  // Uploads the pending files and returns them for the comment ({ id, type }); call clear(key) once it's sent.
  const upload = (key, slug) => sendAll(key, `/api/projects/${slug}`, async (f, j) => { const a = await sendOne(key, `/api/projects/${slug}`, f, j, await makeThumb(f, 320)); return { id: a.id, type: a.type }; });
  // For a private DM (AIG-111): the pending files uploaded to this board as { upload: id }; the message seals them in.
  const read = (key, contact) => sendAll(key, `/api/dms/contacts/${contact}`, async (f, j) => ({ upload: (await sendOne(key, `/api/dms/contacts/${contact}`, f, j)).upload }));
  const clear = key => { list(key).forEach(revoke); pending.delete(key); paint(key); };
  const has = key => list(key).length > 0;
  // Under a comment: thumbnails for images (click for full size), links for other files.
  const shown = (m, slug, base = `/api/projects/${slug}/attachments`) => m.attachments && m.attachments.length ? `<div class="att-shown">${m.attachments.map(a => {
    const u = `${base}/${encodeURIComponent(a.id)}`;
    return isImg(a) ? `<a href="${u}" target="_blank" title="${esc(a.name)}"><img src="${a.thumb ? u + '?thumb=1' : u}" data-full="${u}" alt="${esc(a.name)}" loading="lazy"></a>` : `<a href="${u}" target="_blank" class="att-file">📎 ${esc(a.name)}</a>`;
  }).join('')}</div>` : '';

  return { boxHtml, upload, read, clear, has, shown };
})();
