/* ---------- DM friends on Setup (AIG-311) ---------- */
// Invite a friend (make a code), Add a friend (paste theirs), and per contact: the 6 safety words, ✅ They match, Block, Remove.
const DF = { code: '', inviteId: '', msg: '', err: '', data: null, feat: null };
/* ---------- your picture for a friend or a pending invite (AIG-883) ---------- */
// Upload or paste an image (same formats and 1 MB limit as your own picture); it is kept on this board only. Yours wins over theirs; Remove brings theirs back.
const FP = { open: '', err: '', mem: {} };
function fpHtml(id, pic, mine) {
  const info = FP.mem[id] || { pic, mine };
  return `<span class="fp" data-fp="${esc(id)}">${info.pic ? `<img class="face" src="${esc(info.pic)}" alt="">` : ''}<button type="button" data-fp-do="pick" aria-expanded="${FP.open === id}">${esc(t('fp.btn'))}</button>${info.mine ? ` <button type="button" data-fp-do="remove">${esc(t('fp.remove'))}</button>` : ''}${FP.open === id ? `<span class="fp-edit"><input type="file" data-fp-file accept=".png,.jpg,.jpeg,.svg,.ico,.webp" aria-label="${esc(t('logo.pick'))}"><input type="text" data-fp-paste placeholder="${esc(t('fp.paste'))}" aria-label="${esc(t('fp.paste'))}" autocomplete="off"></span><small class="muted">${esc(t('fp.help'))}</small>` : ''}${FP.err && FP.open === id ? `<span class="err">${esc(FP.err)}</span>` : ''}</span>`;
}
async function fpSend(id, method, body) {
  FP.err = '';
  try { const r = await api(method, '/api/friend-pics/' + id, body); FP.mem[id] = { pic: r.pic, mine: r.mine }; if (method !== 'DELETE') FP.open = ''; }
  catch (e) { FP.err = e.message || String(e); }
  await dmsFriendsLoad();
}
function fpUpload(id, f) {
  if (!f) return;
  if (f.size > 1024 * 1024) { FP.err = t('logo.toobig'); return dmsFriendsPaint(), joinPaint(); }
  const rd = new FileReader();
  rd.onload = async () => fpSend(id, 'POST', { name: f.name || '', type: f.type, data: String(rd.result).split(',')[1], ...await makeThumb(f, 128) });
  rd.readAsDataURL(f);
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('.fp [data-fp-do]'); if (!b) return;
  const id = b.closest('.fp').dataset.fp;
  if (b.dataset.fpDo === 'remove') return void fpSend(id, 'DELETE');
  FP.open = FP.open === id ? '' : id; FP.err = ''; dmsFriendsPaint(); joinPaint();
});
document.addEventListener('change', ev => { const i = ev.target; if (i.matches && i.matches('.fp [data-fp-file]')) fpUpload(i.closest('.fp').dataset.fp, i.files[0]); });
document.addEventListener('paste', ev => {
  const i = ev.target; if (!i.matches || !i.matches('.fp [data-fp-paste]')) return;
  const it = [...(ev.clipboardData ? ev.clipboardData.items : [])].find(x => x.type.startsWith("image/")); if (!it) return;
  ev.preventDefault(); fpUpload(i.closest('.fp').dataset.fp, it.getAsFile());
});
function dmsFriendsHtml() {
  setTimeout(dmsFriendsLoad, 0);
  return `<span>${esc(t('dmf.h'))}</span><div id="dmfBody" class="muted">…</div>`;
}
async function dmsFriendsLoad() {
  const box = $('dmfBody'); if (!box) return;
  try { const [d, list] = await Promise.all([api('GET', '/api/dms'), api('GET', '/api/dms/contacts')]); DF.data = { d, list }; try { DF.feat = await api('GET', '/api/features'); } catch { DF.feat = null; } dmsFriendsPaint(); }
  catch (e) { box.textContent = e.message || String(e); return; }
  joinLoad();
}

/* ---------- 🎟️ Invite a friend to AI-gile (AIG-347): a one-use download link, made and listed here ---------- */
// The link carries the help level and a DM invite, so the friend's board starts already linked to this one.
const JN = { data: null, link: '', help: '2', err: '', msg: '' };
async function joinLoad() {
  try { JN.data = await api('GET', '/api/join'); } catch (e) { JN.err = JN.err || e.message || String(e); }
  joinPaint();
}
function joinExpiry(c) {
  if (c.kind === 'site' && c.used) return c.passes === null ? t('join.used') : c.passes ? t('join.site.inuse') : t('join.site.ended');   // AIG-699
  if (c.cancelled) return t('join.cancelled');   // AIG-1249
  if (c.used) return t('join.used');
  const ms = c.exp - Date.now();
  if (ms <= 0) return t('join.expired');
  const d = Math.floor(ms / 86400e3);
  return d >= 2 ? t('join.exp.days', { count: d, n: d }) : d === 1 ? t('join.exp.day') : t('join.exp.soon');
}
function joinHtml() {
  const d = JN.data, keep = { n: ($('joinName') || {}).value || '', h: ($('joinHelp') || {}).value || JN.help };
  const row = c => `<div class="join-c" data-code="${esc(c.code)}"><b>${esc(c.kind === 'site' ? '🌐' : ['', '🐣', '🙂', '😎'][c.help] || '')} ${esc(c.name || c.code)}</b> <code>${esc(c.code)}</code>
      <small class="muted">${esc(joinExpiry(c))}</small>${c.inv ? ' ' + fpHtml(c.inv, c.pic && c.pic.pic, c.pic && c.pic.mine) : ''}
      ${c.kind === 'site' && (c.passes || (!c.used && c.exp > Date.now())) ? `<button type="button" class="join-end" data-code="${esc(c.code)}">${esc(t('join.site.end'))}</button>` : ''}
      ${c.kind !== 'site' && !c.used && !c.cancelled && c.exp > Date.now() ? `<button type="button" class="join-cancel" data-code="${esc(c.code)}">${esc(t('join.cancel'))}</button>` : ''}</div>`;
  return `<div class="dmf-sec" id="joinSec"><b>${esc(t('join.h2'))}</b><small class="muted">${esc(t('join.for'))} ${esc(t('join.help'))}</small>
      <select id="joinHelp">${['1', '2', '3'].map(n => `<option value="${n}" ${keep.h === n ? 'selected' : ''}>${esc(['', '🐣', '🙂', '😎'][n] + ' ' + t('join.level.' + n))}</option>`).join('')}</select>
      <input type="text" id="joinName" value="${esc(keep.n)}" placeholder="${esc(t('dmf.invite.name'))}" autocomplete="off">
      <div class="actions"><button type="button" id="joinMake">${esc(t('join.btn'))}</button> <button type="button" id="joinSite" title="${esc(t('join.site.help'))}">${esc(t('join.site.btn'))}</button></div>
      ${JN.link ? `<input type="text" id="joinLink" readonly value="${esc(JN.link)}" onclick="this.select()"><small class="muted">${esc(t('join.send'))}</small>
      <div class="actions"><button type="button" id="joinCopy">${esc(t('dmf.copy'))}</button></div>` : ''}
      <div class="err" id="join-err">${esc(JN.err)}</div><div class="muted" id="join-msg">${esc(JN.msg)}</div>
      ${d && d.codes.length ? `<b>${esc(t('join.open'))}</b>${d.codes.map(row).join('')}` : ''}
      ${d && d.error ? `<small class="muted">${esc(t('join.noStatus'))}</small>` : ''}
      <details><summary class="muted">${esc(t('join.server'))}</summary>
        <input type="text" id="joinUrl" value="${esc(d ? d.url : '')}" autocomplete="off">
        <small class="muted">${esc(t('join.site.url'))}</small><input type="text" id="joinSiteUrl" value="${esc(d ? d.site || '' : '')}" autocomplete="off"><div class="actions"><button type="button" id="joinSave">${esc(t('join.save'))}</button></div>
        <small class="muted">${esc(t('join.key'))}</small><input type="text" id="joinKey" readonly value="${esc(d ? d.ownerKey : '')}" onclick="this.select()"></details></div>`;
}
function joinPaint() {
  const sec = $('joinSec'); if (!sec) return;
  sec.outerHTML = joinHtml();
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('#joinSec button'); if (!b || b.closest('.fp')) return;
  JN.err = ''; JN.msg = '';
  try {
    if (b.id === 'joinMake') {
      b.disabled = true;
      JN.help = $('joinHelp').value;
      JN.link = (await api('POST', '/api/join/codes', { help: JN.help, name: $('joinName').value.trim() })).link;
      $('joinName').value = ''; JN.msg = t('join.made');
    } else if (b.id === 'joinSite') {   // 🌐 test site pass (AIG-699)
      b.disabled = true;
      JN.link = (await api('POST', '/api/join/site', { name: $('joinName').value.trim() })).link;
      $('joinName').value = ''; JN.msg = t('join.site.made');
    } else if (b.classList.contains('join-cancel')) {
      if (!confirm(t('join.cancel.sure'))) return;
      await api('POST', '/api/join/cancel', { code: b.dataset.code }); JN.msg = t('join.cancel.msg');
    } else if (b.classList.contains('join-end')) {
      if (!confirm(t('join.site.end.sure'))) return;
      await api('POST', '/api/join/revoke', { code: b.dataset.code }); JN.msg = t('join.site.ended.msg');
    } else if (b.id === 'joinCopy') { try { await navigator.clipboard.writeText(JN.link); } catch { $('joinLink').select(); document.execCommand('copy'); } JN.msg = t('join.copied'); }
    else if (b.id === 'joinSave') { await api('POST', '/api/join/settings', { url: $('joinUrl').value.trim(), site: $('joinSiteUrl').value.trim() }); JN.msg = t('join.saved'); }
  } catch (e) { JN.err = e.message || String(e); }
  await joinLoad();
});
/* ---------- personal builds (AIG-847): which switches each friend has, tick to give or take ---------- */
function featHtml(c) {
  const sw = DF.feat && DF.feat.switches; if (!sw || !sw.length) return '';
  const fr = (DF.feat.friends || []).find(x => x.id === c.id), keys = fr ? fr.keys : [];
  return `<div class="dmf-feat"><small class="muted">${esc(t('feat.for'))}</small>${sw.map(s => `<label class="chk"><input type="checkbox" class="feat-tick" data-key="${esc(s.key)}" ${keys.includes(s.key) ? 'checked' : ''}> ${esc(s.label)}</label>`).join('')}</div>`;
}
function featSecHtml() {
  const sw = DF.feat && DF.feat.switches; if (!DF.feat) return '';
  const who = s => s.who === 'everyone' ? t('feat.everyone') : s.who === 'some' ? t('feat.some', { count: s.friends.length, n: s.friends.length }) : t('feat.nobody');
  return `<div class="dmf-sec" id="featSec"><b>${esc(t('feat.h'))}</b><small class="muted">${esc(t('feat.help'))}</small>
      ${sw.length ? sw.map(s => `<div class="feat-row" data-key="${esc(s.key)}"><code>${esc(s.key)}</code> ${esc(s.label)} <small class="muted">${esc(who(s))}</small>
        <select class="feat-who" aria-label="${esc(t('feat.who'))}">${['nobody', 'some', 'everyone'].map(w => `<option value="${w}" ${s.who === w ? 'selected' : ''} ${w === 'some' ? 'disabled' : ''}>${esc(t('feat.' + w + '.opt'))}</option>`).join('')}</select>
        <button type="button" class="feat-del">${esc(t('feat.remove'))}</button></div>`).join('') : `<small class="muted">${esc(t('feat.none'))}</small>`}
      <div class="feat-add"><input type="text" id="featKey" maxlength="30" placeholder="${esc(t('feat.key'))}" autocomplete="off"><input type="text" id="featLabel" maxlength="60" placeholder="${esc(t('feat.label'))}" autocomplete="off">
      <button type="button" id="featAdd">${esc(t('feat.add'))}</button></div></div>`;
}
async function featDo(fn) {
  DF.err = ''; try { await fn(); } catch (e) { DF.err = e.message || String(e); }
  await dmsFriendsLoad();
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('#featSec button'); if (!b) return;
  if (b.id === 'featAdd') return featDo(() => api('POST', '/api/features', { key: $('featKey').value.trim().toLowerCase(), label: $('featLabel').value.trim() }));
  if (b.classList.contains('feat-del')) { const k = b.closest('.feat-row').dataset.key; if (confirm(t('feat.remove.confirm', { key: k }))) featDo(() => api('DELETE', '/api/features/' + k)); }
});
document.addEventListener('change', ev => {
  const i = ev.target;
  if (i.matches && i.matches('.feat-tick')) { const id = i.closest('.dmf-c').dataset.cid; return featDo(() => api('POST', '/api/features/' + i.dataset.key + '/friends/' + id, { on: i.checked })); }
  if (i.matches && i.matches('.feat-who')) return featDo(() => api('POST', '/api/features', { key: i.closest('.feat-row').dataset.key, who: i.value }));
});
function dmsFriendsPaint() {
  const box = $('dmfBody'); if (!box || !DF.data) return;
  const { d, list } = DF.data;
  // keep what is being typed across repaints
  const keep = { c: ($('dmfCode') || {}).value || '', n: ($('dmfName') || {}).value || '', i: ($('dmfInvName') || {}).value || '' };
  const contact = c => `<div class="dmf-c" data-cid="${esc(c.id)}">${c.pic ? `<img class="face" src="${esc(c.pic)}" alt="">` : ''}<b>${esc(c.name)}</b>${c.pretend ? ` <span class="muted">${esc(t("pretend.tag"))}</span>` : ""}${c.blocked ? ` <span class="muted">${esc(t('dmf.blocked'))}</span>` : ''}
      <div class="dmf-words"><code>${esc(c.safety)}</code></div>
      <small class="muted">${esc(t(c.checked ? 'dmf.checked' : 'dmf.words.help'))}</small>
      <div class="actions">${c.checked ? '' : `<button type="button" data-act="match">${esc(t('dmf.match'))}</button> `}<button type="button" data-act="block">${esc(t(c.blocked ? 'dmf.unblock' : 'dmf.block'))}</button> <button type="button" data-act="remove">${esc(t('dmf.remove'))}</button> ${fpHtml(c.id, c.pic, c.mine)}</div>${featHtml(c)}</div>`;
  box.className = '';
  box.innerHTML = `<label class="chk"><input type="checkbox" id="dmfOn" ${d.on ? 'checked' : ''}> ${esc(t('dmf.on'))}</label>
    ${joinHtml()}
    <div class="dmf-sec"><b>${esc(t('dmf.invite.h2'))}</b><small class="muted">${esc(t('dmf.invite.for'))} ${esc(t('dmf.invite.help'))}</small>
      <input type="text" id="dmfInvName" value="${esc(keep.i)}" placeholder="${esc(t('dmf.invite.name'))}" autocomplete="off">
      <div class="actions"><button type="button" id="dmfInvite">${esc(t('dmf.invite.btn'))}</button></div>
      ${DF.code ? `<textarea id="dmfMade" readonly rows="3" onclick="this.select()">${esc(DF.code)}</textarea><small class="muted">${esc(t('dmf.invite.send'))}</small>
      <div class="actions"><button type="button" id="dmfCopy">${esc(t('dmf.copy'))}</button> ${DF.inviteId ? fpHtml(DF.inviteId) : ''}</div>` : ''}</div>
    <div class="dmf-sec"><b>${esc(t('dmf.add.h'))}</b><small class="muted">${esc(t('dmf.add.help'))}</small>
      <textarea id="dmfCode" rows="2" placeholder="${esc(t('dmf.add.code'))}" spellcheck="false">${esc(keep.c)}</textarea>
      <input type="text" id="dmfName" value="${esc(keep.n)}" placeholder="${esc(t('dmf.add.name'))}" autocomplete="off">
      <div class="actions"><button type="button" id="dmfAdd">${esc(t('dmf.add.btn'))}</button></div></div>
    <div class="err" id="dmf-err">${esc(DF.err)}</div><div class="muted" id="dmf-msg">${esc(DF.msg)}</div>
    ${featSecHtml()}
    <div class="dmf-sec"><b>${esc(t('dmf.list.h'))}</b>${list.length ? list.map(contact).join('') : `<small class="muted">${esc(t('dmf.none'))}</small>`}</div>`;
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('#dmfBody button'); if (!b || b.closest('#joinSec') || b.closest('.fp') || b.closest('#featSec')) return;
  DF.err = ''; DF.msg = '';
  try {
    if (b.id === 'dmfInvite') { const inv = await api('POST', '/api/dms/invites', { name: $('dmfInvName').value.trim() }); DF.code = inv.code; DF.inviteId = inv.id; }
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
