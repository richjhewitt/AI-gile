/* ---------- ⚙ Engine per agent (AIG-704) ---------- */
// In the 👥 Team dialog: each agent on the roster (and the lead, even before the roster has one) picks Claude (the default) or
// Codex, plus Codex's own model ('' = Codex's default). Stored on the roster entry (POST /api/projects/:slug/team { name, engine,
// codexModel }); an entry saved before this has no engine and means Claude. The project's background run uses the lead's engine
// (lib/engines.js). The lead is the entry named or titled "lead", else the first one: the same rule as the server's leadOf.
const engAgents = () => ((state.project || {}).team || []).filter(m => m.kind !== 'person' && !/retired/i.test(m.status || ''));
const engLead = () => { const l = engAgents(); return l.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || l[0] || null; };
function enginesHtml() {
  const list = engAgents(), lead = engLead(), rows = list.length ? list : [{ name: 'Lead' }];
  const row = m => {
    const codex = m.engine === 'codex', gem = m.engine === 'gemini', isLead = (lead ? lead.name : m.name) === m.name, a = pplArg(m.name);
    return `<div class="tm-person eng-row" data-agent="${esc(m.name)}"><span class="tm-name"><b>${esc(m.name)}</b>${isLead ? ` <span class="pill">${esc(t('eng.lead.tag'))}</span>` : ''}</span>
      <select class="eng-pick" aria-label="${esc(t('eng.pick', { name: m.name }))}" onchange="engineSave('${a}', { engine: this.value })"><option value="claude" ${codex || gem ? '' : 'selected'}>${esc(t('eng.claude'))}</option><option value="codex" ${codex ? 'selected' : ''}>${esc(t('eng.codex'))}</option><option value="gemini" ${gem ? 'selected' : ''}>${esc(t('eng.gemini'))}</option></select>
      ${codex || gem ? `<input type="text" class="eng-model" maxlength="80" value="${esc((gem ? m.geminiModel : m.codexModel) || '')}" placeholder="${esc(t(gem ? 'eng.model.gemini' : 'eng.model'))}" aria-label="${esc(t(gem ? 'eng.model.gemini' : 'eng.model'))}" onchange="engineSave('${a}', { ${gem ? 'geminiModel' : 'codexModel'}: this.value })">` : ''}</div>`;
  };
  return `<h3>${esc(t('eng.h'))}</h3><small class="muted">${esc(t('eng.help'))}</small><div class="tm-rows" id="engRows">${rows.map(row).join('')}</div>`;
}
async function engineSave(name, patch) {
  try { await api('POST', '/api/projects/' + slug() + '/team', { name, ...patch }); await teamPaint(); }
  catch (e) { setErr('tm-err', e); }
}
