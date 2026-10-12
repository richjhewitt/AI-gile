/* ---------- Enter sends (AIG-632) ---------- */
// Setup > Enter sends: on or off for each kind of message box (this browser). On: Enter sends, Shift+Enter is a new line.
// Off: Enter is a new line and only the Send button (or Ctrl+Enter) sends. Ctrl+Enter / Cmd+Enter always sends.
// kinds: chat (the lead and team chats), card (card replies, inbox replies, Decide), dm (friends and Discord), idea.
const EnterSend = (() => {
  const KINDS = ['chat', 'card', 'dm', 'idea'], KEY = 'aigile.enterOff';
  const offList = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const on = kind => !offList().includes(kind);
  const set = (kind, v) => {
    const l = offList().filter(k => k !== kind); if (!v) l.push(kind);
    try { l.length ? localStorage.setItem(KEY, JSON.stringify(l)) : localStorage.removeItem(KEY); } catch {}
  };
  // True when this keydown should send in a box of this kind.
  const is = (e, kind) => e.key === 'Enter' && !e.isComposing && (e.ctrlKey || e.metaKey || (!e.shiftKey && !e.altKey && on(kind)));
  const html = () => `<span>${esc(t('enter.title'))}</span><div id="enterSendList">${KINDS.map(k => `<label class="chk"><input type="checkbox" data-enter-kind="${k}" ${on(k) ? 'checked' : ''} onchange="EnterSend.set('${k}', this.checked)"> ${esc(t('enter.' + k))}</label>`).join(' ')}</div><small class="muted">${esc(t('enter.help'))}</small>`;
  return { on, set, is, html };
})();
