/* ---------- 🙋 People on the team (AIG-582) ---------- */
// A person is a roster entry with kind 'person' (POST /api/projects/:slug/team): a name, a role, maybe a friend (a DM contact),
// and "No AI on my cards" (no agent is woken for cards assigned to them). They can be assigned cards (the assignee list shows
// every roster name) and report in stand-ups like an agent. Shown in the 👥 Team dialog (team-profile.js); with No AI, ever
// on, it is the whole roster dialog. TM.friends = the DM contacts, loaded when the dialog opens.
const peopleOf = () => ((state.project || {}).team || []).filter(m => m.kind === 'person' && !/retired/i.test(m.status || ''));
const pplArg = s => esc(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
function peopleHtml() {
  const friends = TM.friends || [], row = m => {
    const f = friends.find(x => x.id === m.friend);
    return `<div class="tm-person" data-person="${esc(m.name)}"><span class="tm-name">${mateName(m)} <span class="muted">${esc(m.role || '')}${f ? ' · ' + esc(f.name) : ''}</span></span>
      <label class="chk"><input type="checkbox" class="tm-pnoai" ${m.noAi ? 'checked' : ''} onchange="personSave('${pplArg(m.name)}', { noAi: this.checked })"> ${esc(t('ppl.noai'))}</label>
      <button type="button" class="tm-del" onclick="personRemove('${pplArg(m.name)}')" title="${esc(t('tm.remove'))}" aria-label="${esc(t('tm.remove') + ': ' + m.name)}">✕</button></div>`;
  };
  return `<h3>${esc(t('ppl.h'))}</h3><small class="muted">${esc(t('ppl.help'))}</small>
    <div class="tm-rows" id="pplRows">${peopleOf().map(row).join('') || `<p class="muted">${esc(t('ppl.none'))}</p>`}</div>
    <div class="tm-add"><input type="text" id="ppl-name" maxlength="60" placeholder="${esc(t('ppl.name'))}" aria-label="${esc(t('ppl.name'))}"> <input type="text" id="ppl-role" maxlength="60" placeholder="${esc(t('ppl.role'))}" aria-label="${esc(t('ppl.role'))}">
      ${friends.length ? `<select id="ppl-friend" aria-label="${esc(t('ppl.friend'))}"><option value="">${esc(t('ppl.friend.none'))}</option>${friends.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select>` : ''}
      <label class="chk"><input type="checkbox" id="ppl-noai"> ${esc(t('ppl.noai'))}</label> <button type="button" id="pplAdd" onclick="personAdd()">${esc(t('ppl.add'))}</button></div>`;
}
async function personSave(name, patch) {
  try { await api('POST', '/api/projects/' + slug() + '/team', { name, kind: 'person', ...patch }); await teamPaint(); }
  catch (e) { setErr('tm-err', e); }
}
function personAdd() {
  const name = $('ppl-name').value.trim(); if (!name) { setErr('tm-err', t('ppl.need.name')); return; }
  personSave(name, { role: $('ppl-role').value.trim(), friend: $('ppl-friend') ? $('ppl-friend').value : '', noAi: $('ppl-noai').checked });
}
const personRemove = name => personSave(name, { status: 'retired' });

/* ---------- ✏️ Rename a teammate and pick its picture (AIG-634) ---------- */
// The named helpers on the roster (not the role templates), each with a face and a name: click the name to rename it (Enter or
// leaving the box saves, Esc cancels), click the face for the 🎨 badge maker. POST /api/projects/:slug/team/rename moves the
// cards across and the brief tells the lead the new name. People rows use mateName too.
const matesOf = () => ((state.project || {}).team || []).filter(m => m.kind !== 'person' && !/retired/i.test(m.status || ''));
const mateName = m => `<button type="button" class="tm-nm" onclick="mateRename('${pplArg(m.name)}', this)" title="${esc(t('tm.rename'))}" aria-label="${esc(t('tm.rename') + ': ' + m.name)}"><b>${esc(m.name)}</b></button>`;
function matesHtml() {
  const list = matesOf(); if (!list.length) return '';
  return `<h3>${esc(t('tm.mates.h'))}</h3><small class="muted">${esc(t('tm.mates.help'))}</small>
    <div class="tm-rows" id="tmMates">${list.map(m => `<div class="tm-person tm-mate" data-mate="${esc(m.name)}">
      <button type="button" class="tm-face" onclick="badgeDialog('${pplArg(m.name)}', true)" title="${esc(t('tm.pic'))}" aria-label="${esc(t('tm.pic') + ': ' + m.name)}">${face(m.name, list) || '🙂'}</button>
      <span class="tm-name">${mateName(m)} <span class="muted">${esc([m.role, m.model].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div>`;
}
function mateRename(name, btn) {
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'tm-nm-in'; inp.maxLength = 60; inp.value = name; inp.setAttribute('aria-label', t('tm.rename'));
  let done = false;
  const go = async ok => {
    if (done) return; done = true;
    const to = inp.value.trim();
    if (!ok || !to || to === name) { await teamPaint(); return; }
    try { await api('POST', '/api/projects/' + slug() + '/team/rename', { from: name, to }); await teamPaint(esc(t('tm.renamed', { from: name, to }))); }
    catch (e) { await teamPaint(); setErr('tm-err', e); }
  };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(true); } else if (e.key === 'Escape') { e.stopPropagation(); go(false); } };
  inp.onblur = () => go(true);
  btn.replaceWith(inp); inp.focus(); inp.select();
}
