/* ---------- checklist and waits for (AIG-406) ---------- */
// A task for the owner shows its steps a few at a time (AIG-416): the owner's steps setting says how many open ones.
const CHK_SHOW = { 1: 1, 2: 3, 3: 5 }, chkAll = new Set();
function checklistUi(p, c) {
  const list = c.checklist || [], left = checkLeft(c);
  if (c.status === 'done' && !list.length) return '';
  const show = isOwnerTask(c) && !chkAll.has(c.id) ? CHK_SHOW[leadPrefs().steps] : 0, open = list.map((x, i) => x.done ? -1 : i).filter(i => i >= 0);
  const hidden = show && open.length > show ? new Set(open.slice(show)) : new Set();
  const items = list.map((x, i) => hidden.has(i) ? '' : `<li class="${x.done ? 'on' : ''}"><label><input type="checkbox" data-chk-i="${i}" ${x.done ? 'checked' : ''} onchange="checkTick(${i}, this.checked)"> <span>${esc(x.text)}</span></label>`
    + `<span class="chk-acts"><button type="button" class="chk-b" title="${esc(t('check.up'))}" ${i ? '' : 'disabled'} onclick="checkMove(${i}, -1)">↑</button><button type="button" class="chk-b" title="${esc(t('check.down'))}" ${i < list.length - 1 ? '' : 'disabled'} onclick="checkMove(${i}, 1)">↓</button><button type="button" class="chk-b" title="${esc(t('check.remove'))}" onclick="checkRemove(${i})">✕</button></span></li>`).join('');
  return `<div class="chk" id="chk-box"><div class="chk-h"><b>☑ ${esc(t('check.h'))}</b>${list.length ? ` <span class="pill chk${left ? '' : ' all'}">${list.length - left}/${list.length}</span>` : ''}</div>
    ${list.length ? `<ul class="chk-list">${items}</ul>` : ''}${hidden.size ? `<div class="chk-more muted" id="chk-more">${esc(t('check.more', { n: hidden.size }))} <button type="button" class="link" onclick="chkAll.add(cardId()); refresh(true)">${esc(t('check.more.all'))}</button></div>` : ''}
    <div class="chk-add"><input id="chk-new" placeholder="${esc(t('check.add.ph'))}" onkeydown="if(event.key==='Enter'){event.preventDefault();checkAdd()}"> <button type="button" id="chk-add-btn" onclick="checkAdd()">${esc(t('check.add'))}</button></div></div>`;
}
const cardUrl = () => `/api/projects/${slug()}/cards/${cardId()}`;
async function checkTick(i, on) {
  try { await api('POST', cardUrl() + '/check', on ? { tick: [i + 1] } : { untick: [i + 1] }); refresh(true); } catch (e) { alert(e.message); refresh(true); }
}
async function checkSave(list) {
  try { await api('PATCH', cardUrl(), { checklist: list.map(x => ({ text: x.text, done: !!x.done, by: x.by, at: x.at })) }); refresh(true); } catch (e) { alert(e.message); }
}
function checkAdd() {
  const el = $('chk-new'), words = (el.value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!words.length) { el.focus(); return; }
  checkSave([...(curCard().checklist || []), ...words.map(text => ({ text }))]);
}
function checkRemove(i) { const l = [...(curCard().checklist || [])]; l.splice(i, 1); checkSave(l); }
function checkMove(i, d) { const l = [...(curCard().checklist || [])], j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; checkSave(l); }
function waitsUi(p, c) {
  const ids = c.waitsFor || [];
  if (c.status === 'done' && !ids.length) return '';
  const pick = `<select id="wf-add" aria-label="${esc(t('wait.pick'))}" onfocus="waitFill(this)" onmousedown="waitFill(this)" onchange="waitAdd(this.value)"><option value="">${esc(t('wait.pick'))}</option></select>`;   // options filled when opened, so a new card elsewhere does not rebuild the panel
  return `<div class="wf" id="wf-box">${ids.length ? `<b>⏳ ${esc(t('wait.h'))}</b> ` : ''}${ids.map(id => { const b = p.cards.find(x => x.id === id), fin = !b || b.status === 'done';
    return `<span class="pill waits ${fin ? 'fin' : ''}" title="${esc(b ? b.title : id)}">${fin ? '✓ ' : ''}<a href="#/p/${esc(p.slug)}/${esc(id)}">${esc(id)}</a> <button type="button" class="chk-b" title="${esc(t('wait.remove'))}" onclick="waitDrop('${esc(id)}')">✕</button></span>`; }).join(' ')} ${pick}</div>`;
}
function waitFill(sel) {
  if (sel.options.length > 1) return;
  const c = curCard(), ids = c.waitsFor || [];
  for (const x of state.project.cards.filter(x => x.id !== c.id && x.status !== 'done' && !ids.includes(x.id) && !(x.waitsFor || []).includes(c.id))) sel.add(new Option(x.id + ' ' + x.title.slice(0, 60), x.id));
}
async function waitSave(ids) { try { await api('PATCH', cardUrl(), { waitsFor: ids }); refresh(true); } catch (e) { alert(e.message); } }
function waitAdd(id) { if (id) waitSave([...(curCard().waitsFor || []), id]); }
function waitDrop(id) { waitSave((curCard().waitsFor || []).filter(x => x !== id)); }

/* ---------- timed card (AIG-385): ⏰ come back at ---------- */
function timerUi(c) {
  if (c.status === 'done') return '';
  const label = timed(c) ? '⏰ ' + timedWhen(c.timedUntil) : '⏰';
  return `<button id="tm-btn" onclick="timerToggle()" title="${esc(t('timed.title'))}">${esc(label)}</button>
    <span id="tm-box" hidden><select id="tm-pre" onchange="timerPre()"><option value="">${esc(t('timed.pick'))}</option><option value="1h">${esc(t('timed.p.1h'))}</option><option value="3h">${esc(t('timed.p.3h'))}</option><option value="tom">${esc(t('timed.p.tom'))}</option><option value="mon">${esc(t('timed.p.mon'))}</option></select>
    <input type="datetime-local" id="tm-at" aria-label="${esc(t('timed.at'))}"> <button class="primary" onclick="timerSet()">${esc(t('timed.set'))}</button>${timed(c) ? ` <button onclick="timerClear()">${esc(t('timed.clear'))}</button>` : ''}</span>`;
}
function timerToggle() { const b = $('tm-box'); if (b) b.hidden = !b.hidden; }
const localInput = d => new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
function timerPre() {
  const v = $('tm-pre').value, d = new Date();
  if (v === '1h') d.setHours(d.getHours() + 1); else if (v === '3h') d.setHours(d.getHours() + 3);
  else if (v === 'tom') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  else if (v === 'mon') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); }
  else return;
  $('tm-at').value = localInput(d);
}
async function timerSet() {
  const v = $('tm-at').value;
  if (!v) { $('tm-at').focus(); return; }
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/timer`, { until: new Date(v).toISOString() }); refresh(true); } catch (e) { alert(e.message); }
}
async function timerClear() {
  try { await api('DELETE', `/api/projects/${slug()}/cards/${cardId()}/timer`); refresh(true); } catch (e) { alert(e.message); }
}
async function waitAndSee() {
  const next = nextForYou();
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/snooze`); doneWithCard(next); } catch (err) { setErr('v-err', err); }
}
// 📖 To read (AIG-392): Got it accepts (a typed note goes along); Reply tells the team and keeps the card here.
async function gotIt() { return verdict(true); }
async function infoReply() {
  const txt = $('v-text').value.trim(), key = slug() + '/' + cardId() + '#verdict';
  if (!txt && !Attach.has(key)) { setErr('v-err', t('info.err')); $('v-text').focus(); return; }
  try {
    const attachments = await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/verdict`, { reply: true, text: txt, attachments });
    Attach.clear(key); clearDraft(slug() + '/' + cardId() + '/info'); $('v-text').value = ''; setErr('v-err', ''); refresh(true);
  } catch (err) { setErr('v-err', err); }
}
async function verdict(accept, btn) {
  if (accept && !acceptSure(btn, curCard())) return;   // unfinished checklist: "2 of 3 left: accept anyway?" (AIG-406)
  const next = nextForYou(), txt = $('v-text').value.trim(), key = slug() + '/' + cardId() + '#verdict';
  if (!accept && !txt && !Attach.has(key)) { setErr('v-err', t('verdict.err')); $('v-text').focus(); return; }
  try {
    const attachments = await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/verdict`, { accept, text: txt, attachments });
    Attach.clear(key);
    clearDraft(slug() + '/' + cardId() + '/verdict');
    if (!accept) rememberPop(slug(), cardId());
    doneWithCard(next);
  } catch (err) { setErr('v-err', err); }
}
