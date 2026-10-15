/* ---------- ⚙ Engine per agent (AIG-704) ---------- */
// In the 👥 Team dialog: each agent on the roster (and the lead, even before the roster has one) picks Claude (the default) or
// Codex, plus Codex's own model ('' = Codex's default). Stored on the roster entry (POST /api/projects/:slug/team { name, engine,
// codexModel }); an entry saved before this has no engine and means Claude. The project's background run uses the lead's engine
// (lib/engines.js). The lead is the entry named or titled "lead", else the first one: the same rule as the server's leadOf.
// AIG-1007: the ready-made model per team role for the engine picked in Setup > Your main team (the table is lib/engines.js ROLE_MODELS,
// sent with GET /api/profiles). Claude's models are in the role names, so nothing extra shows for it.
let mtEngine = 'claude';
const mtModelHtml = r => { const m = mtEngine === 'claude' ? '' : (((state.profiles || {}).roleModels || {})[r] || {})[mtEngine]; return m ? ` <small class="muted mt-model">${esc(m)}</small>` : ''; };
const engAgents = () => ((state.project || {}).team || []).filter(m => m.kind !== 'person' && !/retired/i.test(m.status || ''));
const engLead = () => { const l = engAgents(); return l.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || l[0] || null; };
function enginesHtml() {
  const list = engAgents(), lead = engLead(), rows = list.length ? list : [{ name: 'Lead' }];
  const row = m => {
    const eg = ['codex', 'gemini', 'copilot', 'cursor'].includes(m.engine) ? m.engine : 'claude', isLead = (lead ? lead.name : m.name) === m.name, a = pplArg(m.name);
    return `<div class="tm-person eng-row" data-agent="${esc(m.name)}"><span class="tm-name"><b>${esc(m.name)}</b>${isLead ? ` <span class="pill">${esc(t('eng.lead.tag'))}</span>` : ''}</span>
      <select class="eng-pick" aria-label="${esc(t('eng.pick', { name: m.name }))}" onchange="engineSave('${a}', { engine: this.value })">${['claude', 'codex', 'gemini', 'copilot', 'cursor'].map(e => `<option value="${e}" ${e === eg ? 'selected' : ''}>${esc(t('eng.' + e))}</option>`).join('')}</select>
      ${eg !== 'claude' ? `<input type="text" class="eng-model" maxlength="80" value="${esc(m[eg + 'Model'] || '')}" placeholder="${esc(t(eg === 'codex' ? 'eng.model' : 'eng.model.' + eg))}" aria-label="${esc(t(eg === 'codex' ? 'eng.model' : 'eng.model.' + eg))}" onchange="engineSave('${a}', { ${eg}Model: this.value })">` : ''}</div>`;
  };
  return `<h3>${esc(t('eng.h'))}</h3><small class="muted">${esc(t('eng.help'))}</small><div class="tm-rows" id="engRows">${rows.map(row).join('')}</div>`;
}
async function engineSave(name, patch) {
  try { await api('POST', '/api/projects/' + slug() + '/team', { name, ...patch }); await teamPaint(); }
  catch (e) { setErr('tm-err', e); }
}

/* ---------- 🔑 Gemini API key (AIG-1015) ---------- */
// Google refuses the personal sign-in for Gemini CLI, so a Gemini run needs an API key. Saved with the secrets page token, kept
// encrypted on this PC (lib/engines.js); the page only ever learns whether one is set, never the key.
const GKEY = { set: null, msg: '' };
function geminiKeyHtml() {
  if (GKEY.set === null) { queueMicrotask(geminiKeyLoad); return `<span>${esc(t('eng.gkey.h'))}</span>`; }
  return `<span>${esc(t('eng.gkey.h'))}</span> <b id="gkeyState" class="pill">${esc(t(GKEY.set ? 'eng.gkey.saved' : 'eng.gkey.notset'))}</b>
    <small class="muted">${esc(t('eng.gkey.help'))} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">${esc(t('eng.gkey.link'))}</a></small>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0"><input type="password" id="gkeyInput" autocomplete="off" spellcheck="false" maxlength="200" style="min-width:280px" placeholder="${esc(t('eng.gkey.ph'))}" aria-label="${esc(t('eng.gkey.h'))}">
      <button type="button" id="gkeySave" onclick="geminiKeySave()">${esc(t('eng.gkey.save'))}</button>
      ${GKEY.set ? `<button type="button" id="gkeyRemove" onclick="geminiKeySave(true)">${esc(t('eng.gkey.remove'))}</button>` : ''}</div>
    ${GKEY.msg ? `<div class="err" id="gkeyErr">${esc(GKEY.msg)}</div>` : ''}`;
}
const geminiKeyPaint = () => { const el = $('geminiKeyBox'); if (el) el.innerHTML = geminiKeyHtml(); };
async function geminiKeyLoad() { try { GKEY.set = !!(await api('GET', '/api/gemini-key')).set; } catch { GKEY.set = false; } geminiKeyPaint(); }
async function geminiKeySave(remove) {
  const v = remove ? '' : ($('gkeyInput') || {}).value || '';
  if (!remove && !v.trim()) return;
  try { GKEY.set = !!(await api('POST', '/api/gemini-key', { key: v.trim(), token: await secToken() })).set; GKEY.msg = ''; }
  catch (e) { GKEY.msg = e.message; }
  geminiKeyPaint();
}
