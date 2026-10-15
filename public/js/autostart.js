// 🚀 Start with Windows (AIG-1250): a Setup tick in the desktop app only (window.aigileDesktop comes from desktop/preload.js; a
// browser has none, so the box stays empty). Off by default. On: Windows starts AI-gile at sign-in, in the tray with no window,
// so the board is up and the teams can work. Only the app can set it (desktop/main.js, app.setLoginItemSettings).
const AutoStart = (() => {
  const A = { on: undefined };
  const D = () => window.aigileDesktop && typeof window.aigileDesktop.getAutoStart === 'function' ? window.aigileDesktop : null;
  const paint = () => { const b = $('autoStartBox'); if (b) b.innerHTML = A.html(); };
  A.load = async () => { try { const r = await D().getAutoStart(); A.on = r && r.can ? !!r.on : null; } catch { A.on = null; } paint(); };
  A.html = () => {
    if (!D()) return '';
    if (A.on === undefined) { A.on = null; A.load(); return ''; }
    if (A.on === null) return '';
    return `<label class="chk"><span><input type="checkbox" id="autoStartTick" ${A.on ? 'checked' : ''} onchange="AutoStart.set(this.checked)"> ${esc(t('autostart.tick'))}</span><small class="muted">${esc(t('autostart.help'))}</small></label>`;
  };
  A.set = async v => {
    try { const r = await D().setAutoStart(!!v); A.on = !!(r && r.on); } catch { A.on = !v; }
    paint();
  };
  return A;
})();
