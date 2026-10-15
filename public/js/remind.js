// ❓ Remind me (AIG-693): a plain-code recap of a card (what was asked, the plan, where it stands). No AI.
// remindLines(card, { isOwner, t }) is pure so QA can test it; returns [{ k: 'ask'|'plan'|'now', text }].
(function (root) {
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const strip = s => String(s || '').replace(/\*\*/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
  const bullets = text => String(text || '').split('\n').filter(l => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).map(strip);
  const isLead = a => /lead/i.test(String(a || ''));
  function remindLines(c, o) {
    o = o || {}; const t = o.t || (k => k), isOwner = o.isOwner || (() => false);
    const cs = (c && c.comments) || [], out = [];
    const orig = cs.find(m => isLead(m.author) && /^\s*(?:\*\*)?Original:/i.test(m.text || ''));
    // The owner's ORIGINAL request, never Sorry what? / pokes / test replies (AIG-693): the Original: comment, else the description,
    // else the owner's first real comment.
    const noise = /^\s*(?:sorry what\b|poke\b|ping\b|test\b)/i, sorry = String(t('remind.sorry.text') || '').trim();
    const own = cs.find(m => isOwner(m.author) && String(m.text || '').trim() && !noise.test(m.text) && String(m.text).trim() !== sorry);
    const descLine = String((c && c.description) || '').split('\n').map(l => l.trim()).find(Boolean) || '';
    const ask = orig ? String(orig.text).replace(/^\s*(?:\*\*)?Original:(?:\*\*)?\s*/i, '') : descLine || (own && own.text) || (c && c.title) || '';
    out.push({ k: 'ask', text: t('remind.ask') + clip(strip(ask), 160) });
    const planC = cs.slice().reverse().find(m => isLead(m.author) && /^\s*\*\*Go on this plan\?\*\*|Fix plan|Plan/.test(m.text || ''));
    let pl = planC ? bullets(planC.text) : [];
    if (!pl.length) pl = bullets(c && c.description);
    if (pl.length) out.push({ k: 'plan', text: t('remind.plan') + pl.slice(0, 2).map(x => clip(x, 120)).join('; ') });
    const st = { todo: 'remind.st.todo', doing: 'remind.st.doing', verify: 'remind.st.verify', done: 'remind.st.done' }[c && c.status];
    out.push({ k: 'now', text: t('remind.now') + (st ? t(st) : t('col.' + (c && c.status))) });
    return out;
  }
  root.remindLines = remindLines;

  // The open state is kept per card id, so the board's polling re-render does not lose the box.
  const open = new Set();
  const curId = () => { try { const c = typeof curCard === 'function' ? curCard() : null; return c ? c.id : null; } catch (e) { return null; } };
  // Sorry what? (AIG-765): posts an owner comment so the team re-explains the card from scratch.
  const asked = {};
  root.remindSorry = async function () {
    const id = curId(), c = id && curCard(); if (!c || asked[id]) return;
    asked[id] = 1; draw();
    try { await api('POST', '/api/projects/' + slug() + '/cards/' + id + '/comments', { author: me(), text: t('remind.sorry.text') }); }
    catch (e) { delete asked[id]; draw(); alert(e.message); return; }
    setTimeout(() => { delete asked[id]; draw(); }, 5000);
    try { refresh(true); } catch (e) {}
  };
  function draw() {
    const id = curId(), btn = document.getElementById('remind-btn'), box = document.getElementById('remind-box');
    if (!id || !btn || !open.has(id)) { if (box) box.remove(); return; }
    const c = curCard(); if (!c) return;
    const fresh = document.createElement('div');
    fresh.id = 'remind-box'; fresh.setAttribute('role', 'status'); fresh.dataset.card = id;
    fresh.style.cssText = 'flex-basis:100%;margin:6px 0;padding:8px 10px;border:1px solid rgba(128,128,128,.5);border-radius:8px;background:rgba(128,128,128,.12);color:inherit;font-size:13px;line-height:1.4;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box';
    remindLines(c, { isOwner, t }).forEach(l => { const d = document.createElement('div'); d.textContent = l.text; fresh.appendChild(d); });
    const sb = document.createElement('button'); sb.id = 'sorry-btn'; sb.type = 'button'; sb.style.cssText = 'margin-top:6px'; sb.textContent = t('remind.sorry'); sb.title = t('remind.sorry.title');
    sb.disabled = !!asked[id]; sb.onclick = () => root.remindSorry();
    fresh.appendChild(document.createElement('div')).appendChild(sb);
    if (asked[id]) { const ok = document.createElement('div'); ok.id = 'sorry-ok'; ok.textContent = t('remind.sorry.ok'); ok.style.cssText = 'font-size:12px;opacity:.8'; fresh.appendChild(ok); }
    const bar = btn.closest('.card-head') || btn.closest('.actions');   // AIG-935: the open card's head row
    if (box) { if (box.dataset.card === id && box.textContent === fresh.textContent && box.previousElementSibling === bar) return; box.remove(); }
    bar.insertAdjacentElement('afterend', fresh);
  }
  root.remindToggle = function () {
    const id = curId(); if (!id) return;
    if (open.has(id)) open.delete(id); else open.add(id);
    draw();
  };
  if (typeof document !== 'undefined') {
    new MutationObserver(() => { if (open.size) draw(); }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('remind-box')) { const id = curId(); if (id) open.delete(id); draw(); } });
  }
})(typeof window !== 'undefined' ? window : globalThis);
