// 📤 / 📥 The AIGILE pack (AIG-357, docs/HANDOFF.md): copy a card for another chat AI, paste its reply back.
// The reply is a comment by 🌐 Outside AI, shown as plain text (links not clickable), never the owner and never a wake.
const Pack = (() => {
  const PRIMER_KEY = 'aigile.primerSeen';
  const seen = () => { try { return !!localStorage.getItem(PRIMER_KEY); } catch { return false; } };
  const markSeen = () => { try { localStorage.setItem(PRIMER_KEY, '1'); } catch {} };
  let last = null;   // the pack shown in the dialog

  async function copyText(text, fallbackId) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { const el = $(fallbackId); if (el) { el.select(); try { return document.execCommand('copy'); } catch {} } return false; }
  }

  function cardBtns(p, c) {
    return `<button id="packCopy" onclick="Pack.copy()" title="${esc(t('pack.copy.title'))}" aria-label="${esc(t('pack.copy.title'))}">${esc(t('pack.copy'))}</button>`
      + `<button id="packAi" class="ai-only" onclick="Pack.ai()" title="${esc(t('pack.ai.title'))}" aria-label="${esc(t('pack.ai.title'))}">${esc(t('pack.ai'))}</button>`
      + `<button id="packPaste" onclick="Pack.paste()">${esc(t('pack.paste'))}</button>`;
  }

  function removedHtml(r) {
    if (!r.removed.length) return `<p class="muted" id="packClean">${esc(t('pack.removed.none'))}</p>`;
    return `<div class="pack-removed" id="packRemoved"><b>${esc(t('pack.removed', { n: r.removed.length }))}</b><ul>${r.removed.map(x => `<li><code>${esc(x.text)}</code> <span class="muted">(${esc(x.kind)}, ${esc(x.field)})</span></li>`).join('')}</ul></div>`;
  }

  async function copy() {
    const s = slug(), c = curCard();
    let r;
    try { r = await api('GET', `/api/projects/${s}/cards/${encodeURIComponent(c.id)}/pack`); } catch (e) { return alert(e.message); }
    last = r;
    const first = !seen();
    openDialog(`<h2>${esc(t('pack.h'))}</h2>
      <p class="muted">${esc(t('pack.help'))}</p>
      ${first ? `<div class="pack-primer" id="packFirst"><b>${esc(t('pack.primer.first'))}</b><div class="muted">${esc(t('pack.primer.why'))}</div>
        <div class="actions"><button class="primary" id="packPrimerBtn" onclick="Pack.copyPrimer(this)">${esc(t('pack.primer.copy'))}</button></div></div>` : ''}
      <textarea id="packText" rows="12" readonly style="width:100%;font-family:monospace;font-size:12px">${esc(r.text)}</textarea>
      ${removedHtml(r)}
      <textarea id="packPrimer" hidden>${esc(r.primer)}</textarea>
      <div class="actions"><button class="primary" id="packCopyBtn" onclick="Pack.copyPack(this)">${esc(t('pack.copy.again'))}</button>
        ${first ? '' : `<button id="packPrimerBtn" onclick="Pack.copyPrimer(this)">${esc(t('pack.primer.copy'))}</button>`}
        <span style="flex:1"></span><button onclick="closeDialog()">${esc(t('card.close'))}</button></div>
      <div class="muted" id="packMsg"></div>`);
    if (await copyText(r.text, 'packText')) $('packMsg').textContent = t('pack.copied');
  }
  // ✨ Copy with AI help (AIG-377): one tiny AI run tidies the scrubbed pack; it opens in an editable box, then Copy.
  async function ai() {
    const s = slug(), c = curCard();
    openDialog(`<h2>${esc(t('pack.ai.h'))}</h2><p class="muted" id="packAiWait">${esc(t('pack.ai.working'))}</p>`);
    let r;
    try { r = await api('POST', `/api/projects/${s}/cards/${encodeURIComponent(c.id)}/pack/ai`, {}); }
    catch (e) {
      return openDialog(`<h2>${esc(t('pack.ai.h'))}</h2><div class="err" id="packAiErr">${esc(t('pack.ai.fail', { why: e.message }))}</div>
        <div class="actions"><button onclick="Pack.ai()">${esc(t('pack.ai.again'))}</button><span style="flex:1"></span><button onclick="closeDialog()">${esc(t('card.close'))}</button></div>`);
    }
    last = r;
    openDialog(`<h2>${esc(t('pack.ai.h'))}</h2>
      <p class="muted">${esc(t('pack.ai.help'))}</p>
      <textarea id="packText" rows="14" style="width:100%;font-family:monospace;font-size:12px">${esc(r.text)}</textarea>
      ${removedHtml(r)}
      <textarea id="packPrimer" hidden>${esc(r.primer)}</textarea>
      <div class="actions"><button class="primary" id="packCopyBtn" onclick="Pack.copyEdited()">${esc(t('pack.copy.again'))}</button>
        <button id="packPrimerBtn" onclick="Pack.copyPrimer(this)">${esc(t('pack.primer.copy'))}</button>
        <span style="flex:1"></span><button onclick="closeDialog()">${esc(t('card.close'))}</button></div>
      <div class="muted" id="packMsg">${esc(t('pack.ai.tokens', { n: r.tokens || 0 }))}</div>`);
  }
  async function copyEdited() { const el = $('packText'); if (el && await copyText(el.value, 'packText')) $('packMsg').textContent = t('pack.copied'); }
  async function copyPack(btn) { if (last && await copyText(last.text, 'packText')) $('packMsg').textContent = t('pack.copied'); }
  async function copyPrimer(btn) {
    if (!last) return;
    const el = $('packPrimer'); if (el) el.hidden = false;
    const ok = await copyText(last.primer, 'packPrimer');
    if (el) el.hidden = true;
    markSeen();
    if (ok) $('packMsg').textContent = t('pack.primer.copied');
  }

  function paste() {
    openDialog(`<h2>${esc(t('pack.paste.h'))}</h2>
      <p class="muted">${esc(t('pack.paste.help'))}</p>
      <textarea id="packReply" rows="12" style="width:100%;font-family:monospace;font-size:12px" placeholder="AIGILE/1 BACK ..."></textarea>
      <div class="err" id="packErr"></div>
      <div class="actions"><button class="primary" id="packSend" onclick="Pack.send()">${esc(t('pack.paste.send'))}</button><span style="flex:1"></span><button onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>
      <div id="packResult"></div>`);
  }
  async function send() {
    const s = slug(), c = curCard(), text = $('packReply').value;
    if (!text.trim()) return $('packErr').textContent = t('pack.paste.empty');
    let r;
    try { r = await api('POST', `/api/projects/${s}/cards/${encodeURIComponent(c.id)}/unpack`, { text }); } catch (e) { return $('packErr').textContent = e.message; }
    $('packSend').disabled = true;
    $('packResult').innerHTML = r.valid ? `<p class="good-text" id="packOk">${esc(t('pack.paste.ok'))}</p>${outsideHtml(r.comment)}`
      : `<p class="muted" id="packBad">${esc(t('pack.paste.bad'))}</p>`;
    await refresh(true);
  }

  // A pasted reply in the conversation: plain text, its questions, and the proposed cards with ticks.
  function outsideHtml(m) {
    const o = m.outside || {};
    const cards = (o.cards || []).map((x, i) => `<label class="pack-card">${x.added ? `✅ ${esc(t('pack.card.added', { id: x.added }))}` : `<input type="checkbox" class="pack-pick" value="${i}">`} ${esc(x.title)} <span class="muted">(${esc(x.type)}, ${esc(x.priority)})</span></label>`).join('');
    return `${o.ask && o.ask.length ? `<div class="pack-ask"><b>${esc(t('pack.ask'))}</b><ul>${o.ask.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
      ${cards ? `<div class="pack-cards" data-at="${esc(m.at)}"><b>${esc(t('pack.cards'))}</b>${cards}
        ${(o.cards || []).some(x => !x.added) ? `<div class="actions"><button class="pack-add" onclick="Pack.addCards(this)">${esc(t('pack.cards.add'))}</button></div>` : ''}</div>` : ''}`;
  }
  function body(p, c, m) {
    const o = m.outside || {};
    return `<div class="pack-untrusted muted">${esc(t(o.invalid ? 'pack.untrusted.plain' : 'pack.untrusted'))}</div><div class="body pack-body" style="white-space:pre-wrap">${esc(m.text)}</div>${o.invalid ? '' : outsideHtml(m)}`;
  }
  async function addCards(btn) {
    const box = btn.closest('.pack-cards'), pick = [...box.querySelectorAll('.pack-pick:checked')].map(x => Number(x.value));
    if (!pick.length) return alert(t('pack.cards.none'));
    const c = curCard();
    try { await api('POST', `/api/projects/${slug()}/cards/${encodeURIComponent(c.id)}/outside/cards`, { at: box.dataset.at, pick }); } catch (e) { return alert(e.message); }
    if ($('packResult')) closeDialog();
    await refresh(true);
  }

  return { cardBtns, copy, ai, copyEdited, copyPack, copyPrimer, paste, send, body, addCards };
})();
