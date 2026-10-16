/* ---------- 🎓 Request an expert (AIG-844, AIG-845): button in the idea box ---------- */
// A picker of the fixed presets (build, design, business, legal, money, people, marketing, support) or a typed "who you need".
// A typed text is matched to a preset by keywords on the server (lib/experts.js, no AI, no tokens); no match = the generalist.
// Send: POST /api/projects/:slug/expert. The expert joins the roster, the Lead chat gets the request and the expert's intro.
const XP = { data: null, pick: '', timer: 0 };
async function expertDialog() {
  let projects = [];
  try { projects = (await api('GET', '/api/projects')).filter(p => !p.archived); } catch {}
  try { XP.data = await api('GET', '/api/experts'); } catch { XP.data = null; }
  if (!XP.data) return;
  const typed = $('idea-text') ? $('idea-text').value : '', sel = $('idea-to') ? $('idea-to').value.split('@')[0] : '';
  const here = [sel, slug()].find(s => s && projects.some(p => p.slug === s)) || (projects[0] || {}).slug || '';
  XP.pick = '';
  popNext('expert'); openDialog(`<h2>${esc(t('expert.h'))}</h2><p class="muted">${esc(t('expert.sub'))}</p>
    <form onsubmit="return expertSend(event)" class="xp">
    <label class="f"><span>${esc(t('expert.project'))}</span><select id="xp-project">${projects.map(p => `<option value="${esc(p.slug)}" ${p.slug === here ? 'selected' : ''}>${esc((p.emoji || '') + ' ' + p.name)}</option>`).join('')}</select></label>
    ${XP.data.groups.map(g => `<div class="xp-group"><h3>${esc(g.emoji)} ${esc(t('expert.group.' + g.id))}</h3><div class="xp-presets">${g.presets.map(p => `<button type="button" class="xp-preset" data-id="${esc(p.id)}" aria-pressed="false" onclick="expertPick('${esc(p.id)}')" title="${esc(t('expert.can.' + p.id))}" aria-label="${esc(t('expert.can.' + p.id))}">${esc(p.emoji)} ${esc(t('expert.' + p.id))} <small>${esc(Model(p.model))}</small></button>`).join('')}</div></div>`).join('')}
    <label class="f"><span>${esc(t('expert.describe'))}</span><textarea id="xp-text" rows="3" oninput="expertTyped()" placeholder="${esc(t('expert.describe.ph'))}">${esc(typed)}</textarea></label>
    <div class="xp-looks muted" id="xp-looks" role="status"></div>
    <div class="err" id="xp-err"></div>
    <div class="actions"><button class="primary" type="submit">${esc(t('expert.send'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`, 'wide');
  expertTyped();
}
function expertPick(id) {
  XP.pick = XP.pick === id ? '' : id;
  document.querySelectorAll('.xp-preset').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === XP.pick ? 'true' : 'false'));
  expertTyped();
}
function expertTyped() {
  clearTimeout(XP.timer);
  XP.timer = setTimeout(async () => {
    const out = $('xp-looks'); if (!out) return;
    if (XP.pick) { out.textContent = t('expert.looks', { label: t('expert.' + XP.pick) }); return; }
    const text = $('xp-text').value.trim();
    if (!text) { out.textContent = ''; return; }
    try { const r = await api('POST', '/api/experts/match', { text }); if ($('xp-looks')) $('xp-looks').textContent = r.via === 'keywords' ? t('expert.looks', { label: t('expert.' + r.id) }) : t('expert.looks.none', { label: t('expert.' + r.id) }); } catch {}
  }, 150);
}
let expertBusy = false;
async function expertSend(e) {
  e.preventDefault();
  if (expertBusy) return false;
  const text = $('xp-text').value.trim(), project = $('xp-project').value;
  if (!project) { setErr('xp-err', t('idea.noproj')); return false; }
  if (!XP.pick && !text) { setErr('xp-err', t('expert.err')); return false; }
  const btn = $('xp-text').closest('form').querySelector('button[type=submit]');
  expertBusy = true; btn.disabled = true;
  try {
    await api('POST', `/api/projects/${project}/expert`, XP.pick ? { preset: XP.pick, text } : { text });
    closeDialog(); await rerender();
  } catch (err) { setErr('xp-err', err); }
  finally { expertBusy = false; btn.disabled = false; }
  return false;
}
