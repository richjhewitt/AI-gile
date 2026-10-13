/* ---------- 🏡 Life admin without tokens (#/life, AIG-798) ----------
   Plain-code reminders (one-off or repeating) and simple lists (shopping, to pack). Each item has Tick, Snooze and Delete.
   Kept by the server in data/lifeadmin.conf (lib/lifeadmin.js). Never wakes an agent, never makes an AI call: works the same in
   No AI mode. Every text comes from the language files (la.*); what the owner typed goes through esc(). */
const LifeAdmin = (() => {
  const L = { data: null, err: '' };
  const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(i18n.locale || undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const pad = n => String(n).padStart(2, '0');
  const local = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  let ver = 0;   // a poll that started before a change finished must not paint old data over it (it would wipe what is being typed)
  L.load = async () => { const v = ver; try { const d = await api('GET', '/api/lifeadmin'); if (v === ver) L.data = d; } catch { if (v === ver) L.data = null; } return L.data; };
  const redraw = () => { if (state.route.view === 'life') $('app').innerHTML = L.render(); };
  const call = async (m, u, b) => { L.err = ''; ver++; try { await api(m, u, b); ver++; await L.load(); } catch (e) { ver++; L.err = e.message; } redraw(); };
  L.addReminder = () => {
    const text = $('laText').value, due = $('laDue').value, repeat = $('laRepeat').value;
    if (!text.trim()) { L.err = t('la.err.text'); redraw(); return; }
    return call('POST', '/api/lifeadmin/reminders', { text, due: due ? new Date(due).toISOString() : undefined, repeat });
  };
  L.addList = () => { const n = $('laListName').value; if (!n.trim()) return; return call('POST', '/api/lifeadmin/lists', { name: n }); };
  L.addItem = id => { const el = document.getElementById('laItem-' + id); if (!el || !el.value.trim()) return; return call('POST', `/api/lifeadmin/${id}/items`, { text: el.value }); };
  L.tick = id => call('POST', `/api/lifeadmin/${id}/tick`);
  L.snooze = (id, tomorrow) => call('POST', `/api/lifeadmin/${id}/snooze`, tomorrow ? { tomorrow: true } : { mins: 60 });
  L.del = id => call('DELETE', `/api/lifeadmin/${id}`);
  const btns = (x, rep) => `<span class="la-btns"><button type="button" class="good" data-la="tick" onclick="LifeAdmin.tick('${x.id}')" title="${esc(t(x.done ? 'la.untick.title' : 'la.tick.title'))}">${esc(t(x.done ? 'la.untick' : 'la.tick'))}</button>`
    + (x.done ? '' : (rep ? `<button type="button" data-la="snooze" onclick="LifeAdmin.snooze('${x.id}')" title="${esc(t('la.snooze.title'))}">${esc(t('la.snooze'))}</button>` : '') + `<button type="button" data-la="tomorrow" onclick="LifeAdmin.snooze('${x.id}',true)" title="${esc(t('la.tomorrow.title'))}">${esc(t('la.tomorrow'))}</button>`)
    + `<button type="button" data-la="delete" onclick="LifeAdmin.del('${x.id}')" aria-label="${esc(t('la.delete'))}" title="${esc(t('la.delete'))}">🗑</button></span>`;
  const remRow = r => `<li class="la-row ${r.done ? 'done' : ''} ${r.overdue ? 'overdue' : ''} ${r.asleep ? 'asleep' : ''}" data-id="${r.id}"><span class="la-text"><b>${esc(r.text)}</b>
      <span class="muted">${esc(t('la.due', { when: fmt(r.due) }))}${r.repeat ? ' · 🔁 ' + esc(t('la.rep.' + r.repeat)) : ''}${r.overdue ? ' · <span class="la-over">' + esc(t('la.overdue')) + '</span>' : ''}${r.asleep ? ' · ' + esc(t('la.asleep', { when: fmt(r.snoozedUntil) })) : ''}</span></span>${btns(r, true)}</li>`;
  const itemRow = i => `<li class="la-row ${i.done ? 'done' : ''} ${i.asleep ? 'asleep' : ''}" data-id="${i.id}"><span class="la-text">${esc(i.text)}${i.asleep ? ` <span class="muted">${esc(t('la.asleep', { when: fmt(i.snoozedUntil) }))}</span>` : ''}</span>${btns(i, false)}</li>`;
  L.render = () => {
    const d = L.data;
    if (!d) return `<div class="uz la"><h2>${esc(t('la.title'))}</h2><p class="muted">${esc(t('la.loading'))}</p></div>`;
    const rems = d.reminders.slice().sort((a, b) => (a.done - b.done) || (a.due < b.due ? -1 : 1));
    const lists = d.lists.map(l => `<div class="uz-card la-list" data-id="${l.id}"><div class="la-lh"><b>${esc(l.name)}</b><span class="grow"></span><button type="button" data-la="delete" onclick="LifeAdmin.del('${l.id}')" title="${esc(t('la.list.delete'))}" aria-label="${esc(t('la.list.delete'))}">🗑</button></div>
      <ul class="la-ul">${l.items.map(itemRow).join('') || `<li class="muted">${esc(t('la.item.none'))}</li>`}</ul>
      <form class="la-add" onsubmit="LifeAdmin.addItem('${l.id}');return false"><input id="laItem-${l.id}" maxlength="200" placeholder="${esc(t('la.item.text'))}" aria-label="${esc(t('la.item.text'))}"><button type="submit">${esc(t('la.item.add'))}</button></form></div>`).join('');
    return `<div class="uz la"><div class="toolbar"><h2>${esc(t('la.title'))}</h2></div><p class="muted">${esc(t('la.intro'))}</p>
      <div class="err" id="laErr">${esc(L.err)}</div>
      <div class="uz-card"><div class="uz-tile-h">${esc(t('la.rem.h'))}</div>
        <form class="la-add la-remform" onsubmit="LifeAdmin.addReminder();return false"><input id="laText" maxlength="200" placeholder="${esc(t('la.rem.text'))}" aria-label="${esc(t('la.rem.text'))}">
          <input type="datetime-local" id="laDue" value="${local(new Date(Date.now() + 3600e3))}" aria-label="${esc(t('la.rem.due'))}">
          <select id="laRepeat" aria-label="${esc(t('la.rem.repeat'))}"><option value="">${esc(t('la.rep.none'))}</option>${d.repeats.map(v => `<option value="${v}">${esc(t('la.rep.' + v))}</option>`).join('')}</select>
          <button type="submit" class="primary">${esc(t('la.add'))}</button></form>
        <ul class="la-ul" id="laReminders">${rems.map(remRow).join('') || `<li class="muted">${esc(t('la.rem.none'))}</li>`}</ul></div>
      <div class="uz-card"><div class="uz-tile-h">${esc(t('la.lists.h'))}</div>
        <form class="la-add" onsubmit="LifeAdmin.addList();return false"><input id="laListName" maxlength="80" placeholder="${esc(t('la.list.name'))}" aria-label="${esc(t('la.list.name'))}"><button type="submit">${esc(t('la.list.add'))}</button></form></div>
      ${lists || `<p class="muted">${esc(t('la.list.none'))}</p>`}
      <p class="muted la-note">${esc(t('la.note'))}</p></div>`;
  };
  return L;
})();
