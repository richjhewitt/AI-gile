/* ---------- 🗄️ Backups (AIG-1258/1259/1262): where boards are saved, daily backups in Setup, and the Home warning for a damaged file (AIG-1261) ---------- */
const Backups = (() => {
  const B = { d: undefined, err: '', msg: '', pick: '', busy: false };
  const SETTINGS = '_settings';
  const when = s => { const d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleString(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }); };
  const paint = () => { const b = $('backupsBox'); if (b) b.innerHTML = B.html(); };
  B.load = async () => { try { B.d = await api('GET', '/api/backups'); B.err = ''; } catch (e) { B.d = null; B.err = e.message; } paint(); };
  // Every board (and the settings) that is in at least one backup, with the newest name it had.
  const names = d => {
    const out = new Map();
    for (const b of d.list) for (const [slug, p] of Object.entries(b.projects)) if (!out.has(slug) || (!out.get(slug) && p.name)) out.set(slug, p.name || '');
    const list = [...out].map(([slug, name]) => ({ slug, name: name || slug })).sort((a, b) => a.name.localeCompare(b.name));
    if (d.list.some(b => b.settings)) list.push({ slug: SETTINGS, name: t('bk.settings') });
    return list;
  };
  const label = (d, slug) => (names(d).find(x => x.slug === slug) || { name: slug }).name;
  B.html = () => {
    if (B.d === undefined) { B.d = null; B.load(); return `<small class="muted">${esc(t('bk.loading'))}</small>`; }
    const d = B.d; if (!d) return B.err ? `<div class="err">${esc(B.err)}</div>` : '';
    const where = `<div class="bk-where" id="bkWhere"><span>${esc(t('bk.where'))}</span> <code id="bkDataDir">${esc(d.dataDir)}</code>${folderBtn(d.dataDir, 'edit-btn')}<small class="muted">${esc(t('bk.where.help'))}</small></div>`;
    const all = names(d); if (!all.some(x => x.slug === B.pick)) B.pick = (all[0] || {}).slug || '';
    const rows = d.list.filter(b => B.pick === SETTINGS ? b.settings : b.projects[B.pick]).map(b => {
      const p = B.pick === SETTINGS ? null : b.projects[B.pick], bad = p && p.damaged;
      const info = [p && !bad ? t('inbox.g.count', { count: p.cards }) : '', b.kind === 'replaced' ? t('bk.replaced') : '', bad ? t('bk.damagedcopy') : ''].filter(Boolean).join(' · ');
      return `<tr data-bk="${esc(b.id)}"><td>${esc(when(b.at || b.id))}${info ? `<br><small class="muted">${esc(info)}</small>` : ''}</td><td class="stor-n">${bad ? '' : `<button type="button" class="bk-restore" data-id="${esc(b.id)}" onclick="Backups.restore('${esc(B.pick)}', '${esc(b.id)}')" ${B.busy ? 'disabled' : ''}>${esc(t('bk.restore'))}</button>`}</td></tr>`;
    }).join('');
    const pick = all.length ? `<label class="bk-pick"><span>${esc(t('bk.pick'))}</span> <select id="bkPick" onchange="Backups.choose(this.value)">${all.map(x => `<option value="${esc(x.slug)}" ${x.slug === B.pick ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><table class="stor-t bk-t"><tbody>${rows}</tbody></table>` : `<small class="muted" id="bkNone">${esc(t('bk.none'))}</small>`;
    return `${where}<div class="bk-list"><span>${esc(t('bk.h'))}</span><small class="muted">${esc(t('bk.help', { path: d.backupsDir, n: d.keep }))}</small>${pick}</div><div class="muted" id="bkMsg">${esc(B.msg)}</div><div class="err">${esc(B.err)}</div>`;
  };
  B.choose = v => { B.pick = v; B.msg = ''; paint(); };
  // Puts one file back; asks first. Home's warning calls it too (from = 'home').
  B.restore = async (name, id, from, atHint) => {
    const d = B.d, b = d && d.list.find(x => x.id === id), at = when((b && b.at) || atHint || id);
    const nm = name === SETTINGS ? t('bk.settings') : (d ? label(d, name) : name);
    if (!confirm(from === 'home' ? t('damaged.confirm', { name: nm, when: at }) : name === SETTINGS ? t('bk.confirm.settings', { when: at }) : t('bk.confirm', { name: nm, when: at }))) return false;
    B.busy = true; B.err = ''; paint();
    try { B.d = await api('POST', '/api/backups/restore', { name, id }); B.msg = t('bk.done', { name: nm, when: at }); }
    catch (e) { B.err = e.message; if (from === 'home') alert(e.message); }
    B.busy = false; paint();
    if (!B.err) state.damaged = (state.damaged || []).filter(x => (x.kind === 'settings' ? SETTINGS : x.slug) !== name);
    if (typeof refresh === 'function') refresh(true);
    return true;
  };
  // Home (AIG-1261): one red line per damaged file, with where the copy is and the last good backup.
  B.homeHtml = list => (list || []).map(x => {
    const kept = x.kept ? ` ${esc(t('damaged.kept', { path: x.kept }))}${folderBtn(x.kept.replace(/\/[^/]*$/, ''), 'edit-btn')}` : '';
    const name = x.kind === 'settings' ? SETTINGS : x.slug;
    const back = x.backup ? ` <button type="button" class="danger dmg-back" onclick="Backups.restore('${esc(name)}', '${esc(x.backup.id)}', 'home', '${esc(x.backup.at || '')}')">${esc(t('damaged.putback', { when: when(x.backup.at || x.backup.id) }))}</button>` : ` <span>${esc(t('damaged.nobackup'))}</span>`;
    return `<div class="dmg-line" role="alert" data-file="${esc(x.name)}">⚠️ <b>${esc(t(x.kind === 'settings' ? 'damaged.settings' : 'damaged.project', { name: x.name }))}</b>${kept}${back}</div>`;
  }).join('');
  return B;
})();
