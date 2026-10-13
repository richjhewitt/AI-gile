/* ---------- language immersion: Setup box (AIG-722..725) ---------- */
// The languages you are learning (aigile.learning), a language per weekday (aigile.langDays) and a random pick each day
// (aigile.langRandom). The logic that starts the board in one (immAuto, immLang) and the top bar 🌍 button live in i18n.js.
const Imm = (() => {
  const DAYS = [1, 2, 3, 4, 5, 6, 0];   // Monday first; the numbers are Date.getDay()
  const dayName = d => { try { return new Date(2024, 0, 7 + d).toLocaleDateString(i18n.locale, { weekday: 'long' }); } catch { return String(d); } };
  const redraw = () => {
    const b = document.getElementById('immBox');
    if (b) { const o = b.querySelector('.imm-langs'), y = o ? o.scrollTop : 0; b.innerHTML = html(); const n = b.querySelector('.imm-langs'); if (n) n.scrollTop = y; }
    paintImm();
  };
  function html() {
    const stored = jsonLs('aigile.learning', []), all = LANG_LIST.filter(l => LANGS[l.code] && l.code !== chosenLang() && regional(l));
    const L = learning(), days = jsonLs('aigile.langDays', {});
    const ticks = all.map(l => `<label class="imm-l"><input type="checkbox" data-imm="${esc(l.code)}" ${stored.includes(l.code) ? 'checked' : ''} onchange="Imm.tick(this.dataset.imm, this.checked)"> <span lang="${esc(l.code)}" dir="auto">${esc(l.name)}</span></label>`).join('');
    const rows = DAYS.map(d => `<label class="imm-d"><span>${esc(dayName(d))}</span><select data-day="${d}" aria-label="${esc(dayName(d))}" onchange="Imm.day(${d}, this.value)"><option value="">${esc(t('imm.day.none'))}</option>${L.map(c => `<option value="${esc(c)}" ${days[d] === c ? 'selected' : ''}>${esc(LANGS[c])}</option>`).join('')}</select></label>`).join('');
    return `<h3>${esc(t('imm.h'))}</h3><p class="muted">${esc(t('imm.help'))}</p>
      <div class="imm-langs" role="group" aria-label="${esc(t('imm.learn'))}">${ticks}</div>
      <h4>${esc(t('imm.days'))}</h4><p class="muted">${esc(t(L.length ? 'imm.days.help' : 'imm.days.empty'))}</p>
      ${L.length ? `<div class="imm-days">${rows}</div>` : ''}
      <label class="imm-r"><input type="checkbox" id="immRandom" ${ls('aigile.langRandom') === '1' ? 'checked' : ''} ${L.length ? '' : 'disabled'} onchange="Imm.random(this.checked)"> ${esc(t('imm.random'))}</label><small class="muted imm-rh">${esc(t('imm.random.help'))}</small>`;
  }
  function tick(code, on) {
    const a = new Set(jsonLs('aigile.learning', [])); on ? a.add(code) : a.delete(code);
    lsSet('aigile.learning', JSON.stringify([...a]));
    const days = jsonLs('aigile.langDays', {}); for (const d of Object.keys(days)) if (!a.has(days[d])) delete days[d];
    lsSet('aigile.langDays', Object.keys(days).length ? JSON.stringify(days) : null);
    if (!a.size) lsSet('aigile.langRandom', null);
    redraw();
  }
  function day(d, code) {
    const days = jsonLs('aigile.langDays', {}); if (code) days[d] = code; else delete days[d];
    lsSet('aigile.langDays', Object.keys(days).length ? JSON.stringify(days) : null);
  }
  function random(on) { lsSet('aigile.langRandom', on ? '1' : null); }
  return { html, tick, day, random };
})();
