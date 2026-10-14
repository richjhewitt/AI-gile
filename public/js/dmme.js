// 💬 DM me about this (AIG-684): on a card, ask an agent (the lead, a teammate, or a team you name) to DM you about it.
// The board opens a chat message "About AIG-1: title" and wakes that agent; the dialog then jumps into the DM.
const Dmme = (() => {
  const leadName = p => { const m = (p.team || []).filter(x => !/retired/i.test(x.status || '') && x.kind !== 'person'); const l = m.find(x => /lead/i.test(x.name + ' ' + (x.role || ''))) || m[0]; return l ? l.name : 'Lead'; };

  function btn() {
    return `<button id="dmmeBtn" class="ai-only" onclick="Dmme.pick()" title="${esc(t('dmme.btn.title'))}">${esc(t('dmme.btn'))}</button>`;
  }

  function pick() {
    const p = state.project, c = curCard(), lead = leadName(p);
    const mates = (p.team || []).filter(x => !/retired/i.test(x.status || '') && x.kind !== 'person' && x.name !== lead);
    openDialog(`<h2>${esc(t('dmme.h', { id: c.id }))}</h2>
      <div class="actions" id="dmmeWho" style="flex-wrap:wrap">
        <button class="primary" id="dmmeLead" onclick="Dmme.go('')">${esc(t('dmme.lead', { name: lead }))}</button>
        ${mates.map(m => `<button data-who="${esc(m.name)}" onclick="Dmme.go(this.dataset.who)">${esc(m.name)}${m.role ? ' <span class="muted">' + esc(m.role) + '</span>' : ''}</button>`).join('')}
      </div>
      <label class="f"><span>${esc(t('dmme.team'))}</span><input type="text" id="dmmeTeam" maxlength="80" placeholder="${esc(t('dmme.team.ph'))}" onkeydown="if(event.key==='Enter'){event.preventDefault();Dmme.go($('dmmeTeam').value)}"></label>
      <div class="err" id="dmmeErr"></div>
      <div class="actions"><button class="primary" id="dmmeTeamGo" onclick="Dmme.go($('dmmeTeam').value)">${esc(t('dmme.go'))}</button><span style="flex:1"></span><button onclick="closeDialog()">${esc(t('card.close'))}</button></div>`);
  }

  async function go(who) {
    const s = slug(), c = curCard();
    who = String(who || '').trim();
    let r;
    try { r = await api('POST', `/api/projects/${s}/cards/${encodeURIComponent(c.id)}/dmme`, { who }); }
    catch (e) { const er = $('dmmeErr'); if (er) er.textContent = e.message; return; }
    closeDialog();
    if (typeof Dms !== 'undefined') { Dms.show(s); setTimeout(() => Dms.aim(r.dm), 150); }
  }

  return { btn, pick, go };
})();
