// 🧹 Refactor offer (AIG-98): projects with files over 400 lines, a rough estimate of tokens saved a week and the cost of the
// split, then: one refactor project per project (inside it), or one big one. Plain numbers from the server, no AI.
// fmtTok (token counts like 12k) is home.js's.
async function refactorOffer() {
  openDialog(`<h2>${esc(t('rf.h'))}</h2><p class="muted">${esc(t('rf.looking'))}</p>`);
  let list = [];
  try { list = await api('GET', '/api/refactor'); } catch (e) { setErr('d-err', e); }
  const rows = list.map(x => `<label class="chk rf-row"><input type="checkbox" class="rf-pick" value="${esc(x.slug)}" checked> <b>${esc(x.name)}</b>
      <span class="muted">${esc(t('rf.row', { n: x.files.length, big: x.files[0].file, lines: x.files[0].lines, saved: fmtTok(x.savedPerWeek), cost: fmtTok(x.cost) }))}</span></label>`).join('');
  $('dialog').querySelector('.dialog').innerHTML = `<h2>${esc(t('rf.h'))}</h2>
    ${list.length ? `<p class="muted">${esc(t('rf.sub'))}</p>${rows}
      <label class="f"><span>${esc(t('rf.mode'))}</span><select id="rf-mode"><option value="each">${esc(t('rf.mode.each'))}</option><option value="one">${esc(t('rf.mode.one'))}</option></select></label>`
      : `<p>${esc(t('rf.none'))}</p>`}
    <div class="err" id="d-err"></div><div id="rf-done"></div>
    <div class="actions">${list.length ? `<button class="primary" id="rf-go" onclick="refactorAccept()">${esc(t('rf.go'))}</button>` : ''}<button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`;
}
async function refactorAccept() {
  const slugs = [...document.querySelectorAll('.rf-pick:checked')].map(x => x.value);
  try {
    const r = await api('POST', '/api/refactor', { slugs, mode: $('rf-mode').value });
    $('rf-go').remove();
    $('rf-done').innerHTML = `<ul>${r.made.map(p => `<li>✅ <a href="#/p/${esc(p.slug)}" onclick="closeDialog()">${esc(p.name)}</a> · ${esc(t('rf.cards', { n: p.cards }))}</li>`).join('')}</ul>`;
    refresh(true);
  } catch (e) { setErr('d-err', e); }
}
