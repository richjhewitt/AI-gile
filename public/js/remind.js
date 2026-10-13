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
    const own = cs.find(m => isOwner(m.author) && String(m.text || '').trim());
    const descLine = String((c && c.description) || '').split('\n').map(l => l.trim()).find(Boolean) || '';
    const ask = own ? own.text : orig ? String(orig.text).replace(/^\s*(?:\*\*)?Original:(?:\*\*)?\s*/i, '') : descLine || (c && c.title) || '';
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
  root.remindToggle = function () {
    const old = document.getElementById('remind-box');
    if (old) { old.remove(); return; }
    const c = typeof curCard === 'function' ? curCard() : null, btn = document.getElementById('remind-btn');
    if (!c || !btn) return;
    const box = document.createElement('div');
    box.id = 'remind-box'; box.setAttribute('role', 'status');
    box.style.cssText = 'flex-basis:100%;margin:6px 0;padding:8px 10px;border:1px solid rgba(128,128,128,.5);border-radius:8px;background:rgba(128,128,128,.12);color:inherit;font-size:13px;line-height:1.4;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box';
    remindLines(c, { isOwner, t }).forEach(l => { const d = document.createElement('div'); d.textContent = l.text; box.appendChild(d); });
    btn.closest('.actions').insertAdjacentElement('afterend', box);
  };
})(typeof window !== 'undefined' ? window : globalThis);
