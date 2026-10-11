/* ---------- DM friends on Setup (AIG-311) ---------- */
// Invite a friend (make a code), Add a friend (paste theirs), and per contact: the 6 safety words, ✅ They match, Block, Remove.
const DF = { code: '', msg: '', err: '', data: null };
function dmsFriendsHtml() {
  setTimeout(dmsFriendsLoad, 0);
  return `<span>${esc(t('dmf.h'))}</span><div id="dmfBody" class="muted">…</div>`;
}
async function dmsFriendsLoad() {
  const box = $('dmfBody'); if (!box) return;
  try { const [d, list] = await Promise.all([api('GET', '/api/dms'), api('GET', '/api/dms/contacts')]); DF.data = { d, list }; dmsFriendsPaint(); }
  catch (e) { box.textContent = e.message || String(e); }
}
function dmsFriendsPaint() {
  const box = $('dmfBody'); if (!box || !DF.data) return;
  const { d, list } = DF.data;
  // keep what is being typed across repaints
  const keep = { c: ($('dmfCode') || {}).value || '', n: ($('dmfName') || {}).value || '', i: ($('dmfInvName') || {}).value || '' };
  const contact = c => `<div class="dmf-c" data-cid="${esc(c.id)}"><b>${esc(c.name)}</b>${c.blocked ? ` <span class="muted">${esc(t('dmf.blocked'))}</span>` : ''}
      <div class="dmf-words"><code>${esc(c.safety)}</code></div>
      <small class="muted">${esc(t(c.checked ? 'dmf.checked' : 'dmf.words.help'))}</small>
      <div class="actions">${c.checked ? '' : `<button type="button" data-act="match">${esc(t('dmf.match'))}</button> `}<button type="button" data-act="block">${esc(t(c.blocked ? 'dmf.unblock' : 'dmf.block'))}</button> <button type="button" data-act="remove">${esc(t('dmf.remove'))}</button></div></div>`;
  box.className = '';
  box.innerHTML = `<label class="chk"><input type="checkbox" id="dmfOn" ${d.on ? 'checked' : ''}> ${esc(t('dmf.on'))}</label>
    <div class="dmf-sec"><b>${esc(t('dmf.invite.h'))}</b><small class="muted">${esc(t('dmf.invite.help'))}</small>
      <input type="text" id="dmfInvName" value="${esc(keep.i)}" placeholder="${esc(t('dmf.invite.name'))}" autocomplete="off">
      <div class="actions"><button type="button" id="dmfInvite">${esc(t('dmf.invite.btn'))}</button></div>
      ${DF.code ? `<textarea id="dmfMade" readonly rows="3" onclick="this.select()">${esc(DF.code)}</textarea><small class="muted">${esc(t('dmf.invite.send'))}</small>
      <div class="actions"><button type="button" id="dmfCopy">${esc(t('dmf.copy'))}</button></div>` : ''}</div>
    <div class="dmf-sec"><b>${esc(t('dmf.add.h'))}</b><small class="muted">${esc(t('dmf.add.help'))}</small>
      <textarea id="dmfCode" rows="2" placeholder="${esc(t('dmf.add.code'))}" spellcheck="false">${esc(keep.c)}</textarea>
      <input type="text" id="dmfName" value="${esc(keep.n)}" placeholder="${esc(t('dmf.add.name'))}" autocomplete="off">
      <div class="actions"><button type="button" id="dmfAdd">${esc(t('dmf.add.btn'))}</button></div></div>
    <div class="err" id="dmf-err">${esc(DF.err)}</div><div class="muted" id="dmf-msg">${esc(DF.msg)}</div>
    <div class="dmf-sec"><b>${esc(t('dmf.list.h'))}</b>${list.length ? list.map(contact).join('') : `<small class="muted">${esc(t('dmf.none'))}</small>`}</div>`;
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('#dmfBody button'); if (!b) return;
  DF.err = ''; DF.msg = '';
  try {
    if (b.id === 'dmfInvite') { DF.code = (await api('POST', '/api/dms/invites', { name: $('dmfInvName').value.trim() })).code; }
    else if (b.id === 'dmfCopy') { try { await navigator.clipboard.writeText(DF.code); } catch { $('dmfMade').select(); document.execCommand('copy'); } DF.msg = t('dmf.copied'); }
    else if (b.id === 'dmfAdd') {
      const c = await api('POST', '/api/dms/accept', { code: $('dmfCode').value.trim(), name: $('dmfName').value.trim() });
      $('dmfCode').value = ''; $('dmfName').value = ''; DF.msg = t('dmf.added', { name: c.name });
    } else {
      const row = b.closest('.dmf-c'), id = row.dataset.cid, c = DF.data.list.find(x => x.id === id);
      if (b.dataset.act === 'match') await api('PATCH', '/api/dms/contacts/' + id, { checked: true });
      else if (b.dataset.act === 'block') await api('PATCH', '/api/dms/contacts/' + id, { blocked: !c.blocked });
      else if (b.dataset.act === 'remove') { if (!confirm(t('dmf.remove.confirm', { name: c.name }))) return; await api('DELETE', '/api/dms/contacts/' + id); }
    }
  } catch (e) { DF.err = e.message || String(e); }
  await dmsFriendsLoad();
});
document.addEventListener('change', async ev => {
  if (ev.target.id !== 'dmfOn') return;
  DF.err = '';
  try { await api('POST', '/api/dms/settings', { on: ev.target.checked }); } catch (e) { DF.err = e.message || String(e); }
  await dmsFriendsLoad();
});
