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
    return `<div class="tm-person" data-person="${esc(m.name)}"><span class="tm-name"><b>${esc(m.name)}</b> <span class="muted">${esc(m.role || '')}${f ? ' · ' + esc(f.name) : ''}</span></span>
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
