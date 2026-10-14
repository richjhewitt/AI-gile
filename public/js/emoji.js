/* ---------- Twemoji pictures for emoji the system font cannot draw (AIG-691) ----------
   Only Emoji 15+ glyphs have a picture (public/img/twemoji, CC-BY 4.0, see LICENSE.txt there). Whether the font draws a glyph is
   tested once per glyph on a canvas (tofu box or blank = no) and cached. The text stays the real character; only the display changes.
   window.EMOJI_FORCE_IMG = true (test hook) behaves as if the font draws none of them. */
(function () {
  const FILES = new Set(["1f6dc","1fa75","1fa76","1fa77","1fa87","1fa88","1fa89","1fa8f","1faad","1faae","1faaf","1fabb","1fabc","1fabd","1fabe","1fabf","1fac6","1face","1facf","1fada","1fadb","1fadc","1fadf","1fae8","1fae9","1faf7","1faf8"]), cache = new Map();
  const file = g => [...g].map(c => c.codePointAt(0)).filter(c => c !== 0xfe0f).map(c => c.toString(16)).join("-");
  let cv = null, tofu = null;
  const px = g => { cv.getContext("2d").clearRect(0, 0, 40, 40); const x = cv.getContext("2d"); x.font = "28px \"Segoe UI Emoji\",\"Apple Color Emoji\",\"Noto Color Emoji\",sans-serif"; x.textBaseline = "top"; x.fillText(g, 2, 2); return x.getImageData(0, 0, 40, 40).data; };
  const same = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const blank = a => { for (let i = 3; i < a.length; i += 4) if (a[i]) return false; return true; };
  function drawn(g) {
    try {
      if (!cv) { cv = document.createElement("canvas"); cv.width = cv.height = 40; tofu = px("􏿾"); }
      const a = px(g); return !blank(a) && !same(a, tofu);
    } catch (x) { return true; }
  }
  // the picture file name when g (a glyph, optional fe0f) needs one, else ""
  function need(g) {
    const f = file(g); if (!FILES.has(f)) return "";
    if (window.EMOJI_FORCE_IMG) return f;
    if (!cache.has(f)) cache.set(f, !drawn(g));
    return cache.get(f) ? f : "";
  }
  const re = new RegExp("(?:" + [...FILES].filter(f => f.indexOf("-") < 0).map(f => "\\u{" + f + "}").join("|") + ")\\uFE0F?", "gu");
  // g as html: the real glyph, or an <img> of it when the font cannot draw it
  window.emojiGlyphHtml = g => { const f = need(g); return f ? `<img class="emoji-img" src="img/twemoji/${f}.svg" alt="${g}">` : g; };
  // html text (already escaped): glyphs the font cannot draw become pictures; tags are left alone
  window.emojiFallback = html => html.split(/(<[^>]*>)/).map(p => p[0] === "<" && p.length > 1 ? p : p.replace(re, window.emojiGlyphHtml)).join("");
  const st = document.createElement("style");
  st.textContent = ".emoji-img{height:1.2em;width:1.2em;vertical-align:-.2em;display:inline-block}";
  document.head.appendChild(st);
})();
/* ---------- :emoji: shortcodes (AIG-342) ----------
   One helper for every text box (event delegation on document, no per-box wiring).
   Typing ":" plus 2+ letters opens a small popup of matching emoji (EMOJI_DATA, js/emoji-data.js);
   arrows move, Enter / Tab / click pick, Esc closes. A full ":smile:" typed (or pasted) becomes the emoji at once,
   so what is sent is already the emoji. Texts: emoji.hint. */
(function () {
  window.emojiMineSet = l => { MINE = l; };   // dms.js: after a friend's emoji was saved
  const EM = { box: null, ta: null, list: [], q: '', at: 0, from: 0 };
  let MAP = null, MINE = null, MINE_LOADING = false;   // MINE: your own emojis (AIG-648), loaded on first use
  const loadMine = () => {
    if (MINE_LOADING) return; MINE_LOADING = true;
    api('GET', '/api/emojis').then(l => { MINE = l; setCustomEmojis(l); if (EM.box && EM.ta) refind(); }).catch(() => { MINE = MINE || []; }).then(() => { MINE_LOADING = false; });
  };
  const map = () => MAP || (MAP = new Map(EMOJI_DATA));
  const isBox = n => n && !n.readOnly && !n.disabled && (n.tagName === 'TEXTAREA' || (n.tagName === 'INPUT' && n.type === 'text'));

  const style = document.createElement('style');
  style.textContent = `.emj{position:fixed;z-index:10000;min-width:220px;max-width:320px;background:var(--panel,#fff);color:var(--text,#222);border:1px solid var(--border,#ccc);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);padding:4px;font-size:14px}
.emj-row{display:flex;gap:8px;align-items:center;padding:3px 8px;border-radius:5px;cursor:pointer}
.emj-row.on{background:var(--accent,#3b82f6);color:#fff}
.emj-row b{font-size:18px;font-weight:400;width:1.6em;text-align:center}
.emj-sec{font-size:11px;opacity:.65;padding:4px 8px 1px;text-transform:uppercase}
.emj-row img{width:22px;height:22px;object-fit:contain;margin-inline:.3em}
.emj-row .emj-x{margin-inline-start:auto;opacity:.6;padding:0 4px}
.emj-row .emj-x:hover{opacity:1}
.emj-add{border-top:1px solid var(--border,#ccc);margin-top:2px}
.emj-dlg label{display:block;margin:8px 0}
.emj-dlg img.emj-prev{width:64px;height:64px;object-fit:contain;display:block;margin:6px 0}
.emj-dlg img.emj-prev[hidden]{display:none}
.emj-hint{font-size:11px;opacity:.65;padding:3px 8px 1px}`;
  document.head.appendChild(style);

  function close() { if (EM.box) { EM.box.remove(); EM.box = null; } EM.ta = null; EM.list = []; }

  function find(q) {
    const starts = [], has = [];
    for (const r of EMOJI_DATA) {
      const i = r[0].indexOf(q);
      if (i === 0) starts.push(r); else if (i > 0) has.push(r);
    }
    starts.sort((a, b) => a[0].length - b[0].length);
    return starts.concat(has).slice(0, 8);
  }

  // What the popup shows: the built-in matches, your own (the "Yours" section), then the Add entry.
  function rowsFor(q) {
    const out = [];
    if (q.length >= 2) find(q).forEach(r => out.push({ k: 'std', r }));
    (MINE || []).filter(m => m.name.indexOf(q) >= 0).forEach(m => out.push({ k: 'mine', m }));
    out.push({ k: 'add' });
    return out;
  }
  function refind() { EM.list = rowsFor(EM.q); EM.at = Math.min(EM.at, EM.list.length - 1); paint(); }

  function paint() {
    if (!EM.box) {
      EM.box = document.createElement('div'); EM.box.className = 'emj';
      EM.box.addEventListener('mousedown', e => {
        e.preventDefault();
        const x = e.target.closest('.emj-x'); if (x) return delMine(x.dataset.del);
        const row = e.target.closest('.emj-row'); if (row) pick(+row.dataset.i);
      });
      EM.box.addEventListener('contextmenu', e => {
        const row = e.target.closest('.emj-row[data-mine]'); if (!row) return;
        e.preventDefault(); delMine(row.dataset.mine);
      });
      document.body.appendChild(EM.box);
    }
    let sec = false;
    EM.box.innerHTML = EM.list.map((x, i) => {
      const on = i === EM.at ? ' on' : '';
      if (x.k === 'std') return `<div class="emj-row${on}" data-i="${i}"><b>${emojiGlyphHtml(x.r[1])}</b>:${esc(x.r[0])}:</div>`;
      if (x.k === 'add') return `<div class="emj-row emj-add${on}" data-i="${i}"><b>➕</b>${esc(t('emoji.add'))}</div>`;
      const head = sec ? '' : `<div class="emj-sec">${esc(t('emoji.yours'))}</div>`; sec = true;
      return head + `<div class="emj-row${on}" data-i="${i}" data-mine="${esc(x.m.name)}"><img src="${esc(x.m.url)}" alt="">:${esc(x.m.name)}:<span class="emj-x" data-del="${esc(x.m.name)}" title="${esc(t('emoji.del'))}" role="button" aria-label="${esc(t('emoji.del'))}">✕</span></div>`;
    }).join('') + `<div class="emj-hint">${esc(t('emoji.hint'))}</div>`;
    const r = EM.ta.getBoundingClientRect(), h = EM.box.offsetHeight;
    const below = r.bottom + h + 6 < innerHeight;
    EM.box.style.left = Math.max(4, Math.min(r.left, innerWidth - EM.box.offsetWidth - 4)) + 'px';
    EM.box.style.top = (below ? r.bottom + 4 : Math.max(4, r.top - h - 4)) + 'px';
  }

  function put(ta, from, to, text) {
    ta.setRangeText(text, from, to, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function delMine(name) {
    try { MINE = await api('DELETE', '/api/emojis/' + encodeURIComponent(name)); setCustomEmojis(MINE); } catch (x) { return; }
    if (EM.box && EM.ta) refind();
  }

  // ➕ Add your own: a picture file shrunk here to 64x64 (a few KB), a :name:, then it is kept on this PC.
  function addDialog(ta) {
    const d = document.createElement('div');
    d.innerHTML = `<div class="overlay center"><div class="dialog emj-dlg" role="dialog" aria-label="${esc(t('emoji.add'))}">
      <h2>➕ ${esc(t('emoji.add'))}</h2>
      <label><span>${esc(t('emoji.add.file'))}</span><input type="file" id="emj-file" accept=".png,.gif,.webp,.jpg,.jpeg,image/png,image/gif,image/webp,image/jpeg"></label>
      <img class="emj-prev" id="emj-prev" alt="" hidden>
      <label><span>${esc(t('emoji.add.name'))}</span><input type="text" id="emj-name" maxlength="33" placeholder="my_emoji" autocomplete="off"></label>
      <small class="muted">${esc(t('emoji.add.help'))}</small>
      <div class="err" id="emj-err"></div>
      <div class="row"><button type="button" class="primary" id="emj-go">${esc(t('emoji.add.go'))}</button> <button type="button" id="emj-cancel">${esc(t('emoji.add.cancel'))}</button></div>
    </div></div>`;
    document.body.appendChild(d);
    const $e = id => d.querySelector('#' + id);
    let data = null;
    const err = k => { $e('emj-err').textContent = k ? t(k) : ''; };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    const shut = () => { d.remove(); document.removeEventListener('keydown', onKey, true); try { ta.focus(); } catch (x) { /* gone */ } };
    document.addEventListener('keydown', onKey, true);
    $e('emj-cancel').onclick = shut;
    $e('emj-file').onchange = async () => {
      data = null; $e('emj-prev').hidden = true; err('');
      const file = $e('emj-file').files[0]; if (!file) return;
      try { data = await shrink(file); } catch (x) { return err('emoji.err.file'); }
      if (data.bytes > 32 * 1024) { data = null; return err('emoji.err.big'); }
      $e('emj-prev').src = 'data:' + data.type + ';base64,' + data.b64; $e('emj-prev').hidden = false;
      if (!$e('emj-name').value) $e('emj-name').value = file.name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
    };
    $e('emj-go').onclick = async () => {
      const name = $e('emj-name').value.trim().replace(/^:|:$/g, '');
      if (!data) return err('emoji.err.nofile');
      if (!/^[a-z0-9_]{1,32}$/.test(name)) return err('emoji.err.name');
      if (map().has(name) || (MINE || []).some(m => m.name === name)) return err('emoji.err.dup');
      try { MINE = await api('POST', '/api/emojis', { name, data: data.b64 }); setCustomEmojis(MINE); shut(); }
      catch (x) { $e('emj-err').textContent = x.message; }
    };
    $e('emj-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $e('emj-go').click(); } });
    $e('emj-file').focus();
  }

  // Shrink to at most 64x64. A picture already that small and under 32 KB is kept as it is (a gif stays animated).
  function shrink(file) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error('not a picture')); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = img.naturalWidth, h = img.naturalHeight, rd = new FileReader();
        if (!w || !h) return no(new Error('empty'));
        if (w <= 64 && h <= 64 && file.size <= 32 * 1024 && /^image\/(png|gif|webp|jpeg)$/.test(file.type)) {
          rd.onload = () => ok({ type: file.type, b64: String(rd.result).split(',')[1], bytes: file.size });
          rd.onerror = () => no(rd.error); return rd.readAsDataURL(file);
        }
        const k = Math.min(1, 64 / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
        const b64 = cv.toDataURL('image/png').split(',')[1];
        ok({ type: 'image/png', b64, bytes: Math.floor(b64.length * 3 / 4) });
      };
      img.src = url;
    });
  }

  function pick(i) {
    const ta = EM.ta, x = EM.list[i];
    if (!ta || !x) return close();
    if (x.k === 'add') { close(); return addDialog(ta); }
    const to = ta.selectionStart;
    close();
    put(ta, EM.from, to, x.k === 'std' ? x.r[1] : ':' + x.m.name + ':');
    ta.focus();
  }

  document.addEventListener('input', e => {
    const ta = e.target;
    if (!isBox(ta) || typeof EMOJI_DATA === 'undefined') return;
    // a full :name: becomes the emoji
    if (ta.value.indexOf(':') >= 0 && /:[\w+-]+:/.test(ta.value)) {
      const caret = ta.selectionStart, before = ta.value.length;
      const v = ta.value.replace(/:([\w+-]+):/g, (m, n) => map().get(n.toLowerCase()) || m);
      if (v !== ta.value) {
        ta.value = v;
        const c = Math.max(0, caret - (before - v.length));
        try { ta.setSelectionRange(c, c); } catch (x) { /* input types without selection */ }
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
    const pos = ta.selectionStart;
    const m = pos != null && /(^|[\s(])(:[a-z0-9_+-]*)$/i.exec(ta.value.slice(0, pos));
    if (!m) return close();
    const q = m[2].slice(1).toLowerCase();
    if (MINE === null) loadMine();
    EM.ta = ta; EM.q = q; EM.list = rowsFor(q); EM.from = pos - m[2].length;
    EM.at = q.length >= 2 ? 0 : -1;   // a bare ":" only offers the list: nothing is chosen until you arrow or click
    paint();
  });

  document.addEventListener('keydown', e => {
    if (!EM.box || e.target !== EM.ta) return;
    const k = e.key;
    if (EM.at < 0 && (k === 'Enter' || k === 'Tab')) return;   // nothing chosen yet: Enter still sends
    if (k === 'ArrowDown' || k === 'ArrowUp') { EM.at = EM.at < 0 ? (k === 'ArrowDown' ? 0 : EM.list.length - 1) : (EM.at + (k === 'ArrowDown' ? 1 : EM.list.length - 1)) % EM.list.length; paint(); }
    else if (k === 'Enter' || k === 'Tab') pick(EM.at);
    else if (k === 'Escape') close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);

  document.addEventListener('focusout', e => { if (e.target === EM.ta) close(); });
  document.addEventListener('scroll', () => { if (EM.box) close(); }, true);
})();
