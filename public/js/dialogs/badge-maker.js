/* ---------- 🎨 Badge maker (AIG-396): the owner picks an agent's animal, colour and accessory ---------- */
// A badge is "badge:fox/teal/glasses" on the roster entry (m.avatar); the picture is served by /api/avatars/badge/fox/teal/glasses.
const badgeUrl = (a, c, x) => `/api/avatars/badge/${a}/${c}/${x}`;
const BADGE_RE = /^badge:([a-z]+)\/([a-z]+)\/([a-z]+)$/;
let badgeSel = null;
let badgeBack = false;   // opened from the 👥 Team dialog (AIG-634): Save and Cancel go back to it
async function badgeDialog(name, back) {
  badgeBack = !!back;
  const team = (state.project.team || []).filter(m => !/retired/i.test(m.status || ''));
  if (!team.length) return;
  const lib = await api('GET', '/api/avatars'), P = lib.badge;
  const who = team.find(m => m.name === name) || team[0];
  const cur = (who.avatar || '').match(BADGE_RE);
  badgeSel = { name: who.name, a: cur ? cur[1] : P.animals[0], c: cur ? cur[2] : P.colours[0].name, x: cur ? cur[3] : 'none' };
  const opt = (k, v, inner, title) => `<button type="button" class="bm-opt" data-k="${k}" data-v="${esc(v)}" title="${esc(title)}" onclick="badgePick('${k}','${esc(v)}')">${inner}</button>`;
  openDialog(`<div class="bm-dlg"><h2>${esc(t('badge.title'))}</h2><p class="muted">${esc(t('badge.intro'))}</p>
    <div class="bm-top"><img id="bm-prev" class="bm-prev" alt=""><label>${esc(t('badge.for'))} <select id="bm-who" onchange="badgeWho(this.value)">${team.map(m => `<option ${m.name === who.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>
    <h3>${esc(t('badge.animal'))}</h3><div class="bm-row">${P.animals.map(a => opt('a', a, `<img src="${badgeUrl(a, 'grey', 'none')}" alt="">`, a)).join('')}</div>
    <h3>${esc(t('badge.colour'))}</h3><div class="bm-row">${P.colours.map(c => opt('c', c.name, `<i style="background:${esc(c.hex)}"></i>`, c.name)).join('')}</div>
    <h3>${esc(t('badge.accessory'))}</h3><div class="bm-row">${P.accessories.map(x => opt('x', x, `<img src="${badgeUrl('ghost', 'grey', x)}" alt="">`, x)).join('')}</div>
    <div class="err" id="bm-err"></div><div class="actions"><button class="primary" onclick="saveBadge()">${esc(t('common.save'))}</button><button type="button" onclick="${badgeBack ? 'teamDialog()' : 'closeDialog()'}">${esc(t('common.cancel'))}</button></div></div>`);
  paintBadge();
}
function badgeWho(name) {
  const m = state.project.team.find(m => m.name === name), cur = ((m || {}).avatar || '').match(BADGE_RE);
  badgeSel.name = name; if (cur) Object.assign(badgeSel, { a: cur[1], c: cur[2], x: cur[3] });
  paintBadge();
}
function badgePick(k, v) { badgeSel[k] = v; paintBadge(); }
function paintBadge() {
  const prev = $('bm-prev'); if (!prev) return;
  prev.src = badgeUrl(badgeSel.a, badgeSel.c, badgeSel.x);
  document.querySelectorAll('#dialog .bm-opt').forEach(b => b.classList.toggle('on', badgeSel[b.dataset.k] === b.dataset.v));
}
async function saveBadge() {
  try { await api('POST', '/api/projects/' + slug() + '/team', { name: badgeSel.name, avatar: `badge:${badgeSel.a}/${badgeSel.c}/${badgeSel.x}` }); if (badgeBack) { await refresh(true); await teamDialog(); } else { closeDialog(); await refresh(true); } } catch (e) { setErr('bm-err', e); }
}
