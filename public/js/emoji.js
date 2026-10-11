/* ---------- :emoji: shortcodes (AIG-342) ----------
   One helper for every text box (event delegation on document, no per-box wiring).
   Typing ":" plus 2+ letters opens a small popup of matching emoji (EMOJI_DATA, js/emoji-data.js);
   arrows move, Enter / Tab / click pick, Esc closes. A full ":smile:" typed (or pasted) becomes the emoji at once,
   so what is sent is already the emoji. Texts: emoji.hint. */
(function () {
  const EM = { box: null, ta: null, list: [], at: 0, from: 0 };
  let MAP = null;
  const map = () => MAP || (MAP = new Map(EMOJI_DATA));
  const isBox = n => n && !n.readOnly && !n.disabled && (n.tagName === 'TEXTAREA' || (n.tagName === 'INPUT' && n.type === 'text'));

  const style = document.createElement('style');
  style.textContent = `.emj{position:fixed;z-index:10000;min-width:220px;max-width:320px;background:var(--panel,#fff);color:var(--text,#222);border:1px solid var(--border,#ccc);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);padding:4px;font-size:14px}
.emj-row{display:flex;gap:8px;align-items:center;padding:3px 8px;border-radius:5px;cursor:pointer}
.emj-row.on{background:var(--accent,#3b82f6);color:#fff}
.emj-row b{font-size:18px;font-weight:400;width:1.6em;text-align:center}
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

  function paint() {
    if (!EM.box) {
      EM.box = document.createElement('div'); EM.box.className = 'emj';
      EM.box.addEventListener('mousedown', e => {
        e.preventDefault();
        const row = e.target.closest('.emj-row'); if (row) pick(+row.dataset.i);
      });
      document.body.appendChild(EM.box);
    }
    EM.box.innerHTML = EM.list.map((r, i) => `<div class="emj-row${i === EM.at ? ' on' : ''}" data-i="${i}"><b>${r[1]}</b>:${esc(r[0])}:</div>`).join('') + `<div class="emj-hint">${esc(t('emoji.hint'))}</div>`;
    const r = EM.ta.getBoundingClientRect(), h = EM.box.offsetHeight;
    const below = r.bottom + h + 6 < innerHeight;
    EM.box.style.left = Math.max(4, Math.min(r.left, innerWidth - EM.box.offsetWidth - 4)) + 'px';
    EM.box.style.top = (below ? r.bottom + 4 : Math.max(4, r.top - h - 4)) + 'px';
  }

  function put(ta, from, to, text) {
    ta.setRangeText(text, from, to, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function pick(i) {
    const ta = EM.ta, r = EM.list[i];
    if (!ta || !r) return close();
    const to = ta.selectionStart;
    close();
    put(ta, EM.from, to, r[1]);
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
    const m = pos != null && /(^|[\s(])(:[a-z0-9_+-]{2,})$/i.exec(ta.value.slice(0, pos));
    if (!m) return close();
    const list = find(m[2].slice(1).toLowerCase());
    if (!list.length) return close();
    EM.ta = ta; EM.list = list; EM.at = 0; EM.from = pos - m[2].length;
    paint();
  });

  document.addEventListener('keydown', e => {
    if (!EM.box || e.target !== EM.ta) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') { EM.at = (EM.at + (k === 'ArrowDown' ? 1 : EM.list.length - 1)) % EM.list.length; paint(); }
    else if (k === 'Enter' || k === 'Tab') pick(EM.at);
    else if (k === 'Escape') close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);

  document.addEventListener('focusout', e => { if (e.target === EM.ta) close(); });
  document.addEventListener('scroll', () => { if (EM.box) close(); }, true);
})();
