/* ---------- pretend friend on Setup (AIG-322/323) ---------- */
// 🧪 Pretend friend: start Davy (a second board plus a local relay on this computer), open his board in its own window, stop him.
const PF = { data: null, auto: true, code: '', err: '', msg: '', busy: false, asking: false };
function pretendBoxHtml() {
  setTimeout(pretendLoad, 0);
  return `<span>${esc(t('pretend.h'))}</span><div id="pfBody" class="muted">…</div>`;
}
async function pretendLoad() {
  if (!$('pfBody')) return;
  try { PF.data = await api('GET', '/api/pretend'); } catch (e) { PF.err = e.message || String(e); }
  pretendPaint();
}
function pretendPaint() {
  const box = $('pfBody'); if (!box) return;
  const d = PF.data || {};
  if (d.me) { box.className = 'muted'; box.textContent = t('pretend.self'); return; }   // this IS the pretend board
  box.className = '';
  const off = PF.busy ? 'disabled' : '';
  box.innerHTML = d.running
    ? `<small class="muted">${esc(t('pretend.running', { name: d.name }))}</small>
       <div class="actions"><button type="button" id="pfOpen">${esc(t('pretend.open', { name: d.name }))}</button> <button type="button" id="pfInvite">${esc(t('pretend.invite', { name: d.name }))}</button>
       ${PF.asking ? '' : `<button type="button" id="pfStop">${esc(t('pretend.stop'))}</button>`}</div>
       ${PF.code ? `<textarea id="pfCode" readonly rows="3" onclick="this.select()">${esc(PF.code)}</textarea><small class="muted">${esc(t('pretend.invite.help', { name: d.name }))}</small>` : ''}
       ${PF.asking ? `<div class="dmf-sec"><b>${esc(t('pretend.keep.q', { name: d.name }))}</b><div class="actions"><button type="button" id="pfKeep">${esc(t('pretend.keep'))}</button> <button type="button" id="pfWipe">${esc(t('pretend.wipe'))}</button> <button type="button" id="pfCancel">${esc(t('common.cancel'))}</button></div></div>` : ''}`
    : `<small class="muted">${esc(t('pretend.help', { name: d.name || 'Davy' }))}</small>
       <label class="chk"><input type="checkbox" id="pfAuto" ${PF.auto ? 'checked' : ''}> ${esc(t('pretend.auto', { name: d.name || 'Davy' }))}</label>
       <div class="actions"><button type="button" id="pfStart" ${off}>${esc(PF.busy ? t('trial.busy') : t('pretend.start'))}</button></div>${d.kept ? `<small class="muted">${esc(t('pretend.kept'))}</small>` : ''}`;
  box.insertAdjacentHTML('beforeend', `<div class="err" id="pf-err">${esc(PF.err)}</div><div class="muted" id="pf-msg">${esc(PF.msg)}</div>`);
}
document.addEventListener('change', ev => { if (ev.target.id === 'pfAuto') PF.auto = ev.target.checked; });
document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('#pfBody button'); if (!b) return;
  PF.err = ''; PF.msg = '';
  try {
    if (b.id === 'pfStart') { PF.busy = true; pretendPaint(); PF.data = await api('POST', '/api/pretend', { auto: PF.auto }); PF.msg = t(PF.auto ? 'pretend.started' : 'pretend.started.manual', { name: PF.data.name }); }
    else if (b.id === 'pfOpen') window.open(PF.data.url, 'aigile-pretend');
    else if (b.id === 'pfInvite') PF.code = (await api('POST', '/api/pretend/invite')).code;
    else if (b.id === 'pfStop') PF.asking = true;
    else if (b.id === 'pfCancel') PF.asking = false;
    else if (b.id === 'pfKeep' || b.id === 'pfWipe') { PF.data = await api('POST', '/api/pretend/stop', { wipe: b.id === 'pfWipe' }); PF.asking = false; PF.code = ''; PF.msg = t('pretend.stopped'); }
  } catch (e) { PF.err = e.message || String(e); }
  PF.busy = false;
  if (b.id === 'pfStart' || b.id === 'pfKeep' || b.id === 'pfWipe') { try { PF.data = await api('GET', '/api/pretend'); } catch {} }
  pretendPaint();
  if (typeof dmsFriendsLoad === 'function' && $('dmfBody')) dmsFriendsLoad();
  if (typeof dmsRelayHtml === 'function' && $('dmsRelay') && !$('dmsRelay').dataset.t) api('GET', '/api/dms').then(d => { if ($('dmsRelay') && !$('dmsRelay').dataset.t) $('dmsRelay').value = d.relay || ''; }).catch(() => {});
});
