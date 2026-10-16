/* ---------- ⧉ Pop out, for every window (AIG-658) ----------
   ONE helper opens anything in its own browser window: popOut(kind, hash, name, w, h). Where the owner leaves a window
   (position and size) is saved per kind in localStorage (aigile.popwin) and given to window.open as features next time.
   Dialogs (Raise a bug, Team, Cards, ...) pop out through popDlg(kind): the pop window's route is #/pop-dlg/<kind>/<slug>,
   which runs the same opener full-size (view 'dlg' in core.js). openDialog(html, cls, popKind) adds the shared button. */
const POPWIN_KEY = 'aigile.popwin';
const popGeo = () => { try { return JSON.parse(localStorage.getItem(POPWIN_KEY)) || {}; } catch { return {}; } };
function popKindOf(hash) {   // the saved-place key of a pop route
  const d = /^#\/pop-dlg\/([^/]+)/.exec(hash); if (d) return 'dlg-' + d[1];
  const pg = /^#\/pop-page\/([a-z-]+)/.exec(hash); if (pg) return 'page-' + pg[1];
  const m = /^#\/pop-([a-z]+)/.exec(hash); if (m) return m[1];
  return /^#\/pop\//.test(hash) ? 'card' : '';
}
function popFeatures(kind, w, h) {
  const g = popGeo()[kind], n = v => Number.isFinite(v) && v >= 0;
  if (g && g.w >= 200 && g.h >= 150) return `width=${g.w},height=${g.h}` + (n(g.x) && n(g.y) ? `,left=${g.x},top=${g.y}` : '');
  return `width=${w || 620},height=${h || 720}`;
}
// AIG-1044: with the owner's "open in their own window" switch (prefs.autoPop) on, whatever has a ⧉ Pop out opens popped out.
// Never inside a pop-out, never on a phone-width screen or phone, and a blocked popup falls back to inline.
let popAutoPref = false;
const popAutoLoad = () => PagePoll.get('/api/setup').then(s => { popAutoPref = !!((s && s.prefs) || {}).autoPop; }, () => {});
popAutoLoad(); PagePoll.every(popAutoLoad, 10000, { home: true });
function popAutoOn() {
  const p = state.setup && state.setup.prefs, on = p ? !!p.autoPop : popAutoPref;
  if (!on || /^#\/pop/.test(location.hash) || (state.route && (state.route.pop || state.route.view === 'dlg'))) return false;
  if (/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || window.matchMedia('(max-width: 700px)').matches) return false;
  return true;
}
// Returns true when it popped out; otherwise runs inlineFn (if any) and returns false.
function openMaybePopped(kind, hash, name, w, h, inlineFn) {
  if (popAutoOn() && popOut(kind, hash, name, w, h)) return true;
  if (inlineFn) inlineFn();
  return false;
}
// The hash a click or code just navigated to: a card or Setup pops out instead, and this window goes back to where it was.
function popAutoHash(hash, back) {
  const c = /^#\/p\/([^/]+)\/([A-Za-z0-9-]+)$/.exec(hash);
  const spec = c ? ['card', '#/pop/' + c[1] + '/' + c[2], 'aigile-' + c[1] + '-' + c[2], 560, 780] : /^#\/setup(\/[A-Za-z0-9-]+)?$/.test(hash) ? ['setup', '#/pop-setup', 'aigile-setup', 760, 820] : null;
  if (!spec || !openMaybePopped(...spec)) return false;
  location.hash = back || '#/'; return true;
}
function popOut(kind, hash, name, w, h) {
  return window.open(hash, name || 'aigile-' + kind, popFeatures(kind, w, h));
}
// In a pop window: remember where it sits and how big it is (checked every five seconds, and as it closes).
function popRemember() {
  const kind = popKindOf(location.hash); if (!kind) return;
  let last = '';
  const save = () => {
    const g = { x: Math.max(0, window.screenX), y: Math.max(0, window.screenY), w: window.outerWidth, h: window.outerHeight };
    const s = JSON.stringify(g); if (s === last || g.w < 200 || g.h < 150) return;
    last = s; try { const all = popGeo(); all[kind] = g; localStorage.setItem(POPWIN_KEY, JSON.stringify(all)); } catch {}
  };
  PagePoll.every(save, 5000); window.addEventListener('resize', save); window.addEventListener('pagehide', save);
}
popRemember();

// The dialogs that can pop out: kind -> the function that opens it (needs state.project for the ones that use a project).
const POP_DLG = {
  bug: () => newCard({ type: 'bug', priority: 'high', status: 'team' }), card: () => newCard(), team: () => teamDialog(), cards: () => cardViewDialog(),
  look: () => lookDialog(), perms: () => permsDialog(), columns: () => columnsDialog(), docs: () => openDocs(),
  ask: () => askTeamDialog(), idea: () => ideaDialog(), happening: () => happeningDialog(), views: () => viewsDialog(), fyfold: () => fyOpen(forYouFirst(), null),
  // AIG-1313: these had a kind (or are worth keeping beside the board) but could not pop out yet.
  deleted: () => deletedDialog(), expert: () => expertDialog(), change: () => raiseChange(), keys: () => Shortcuts.sheet(), myday: () => MyDay.open(),
  start: () => gettingStarted(), intro: () => introOpen(), incidents: () => incidentsGuide(), service: () => serviceGuide(), messages: () => messagesGuide(),
};
const inPopDlg = () => state.route && state.route.view === 'dlg';
function popDlg(kind) {
  // AIG-1120: the dialog closes only when the window really opened (a blocked popup leaves it inline).
  if (popOut('dlg-' + kind, `#/pop-dlg/${kind}/${slug() || '-'}`, 'aigile-dlg-' + kind, 560, 720)) closeDialog();
}
// AIG-1313: one look for every ⧉ Pop out (dialogs, pages, chats): same label, same hover text, the same name for a screen reader.
const popBtn = (onclick, attrs = '') => `<button type="button" class="dlg-pop" ${attrs} title="${esc(t('popout.title'))}" aria-label="${esc(t('popout.aria'))}" onclick="${onclick}">${esc(t('popout.btn'))}</button>`;
const popBtnHtml = kind => popBtn(`popDlg('${esc(kind)}')`, `data-popdlg="${esc(kind)}"`);
// popNext('kind') just before an openDialog(...) gives that dialog the button (taken by the very next openDialog).
let popNextKind = '';
const popNext = kind => { popNextKind = kind; };
const popTake = () => { const k = popNextKind; popNextKind = ''; return k; };
// openDialog calls this for a dialog that has a kind: the shared button, top right.
function popAddBtn(kind) {
  if (!kind || inPopDlg() || !POP_DLG[kind]) return;
  // AIG-1120: auto pop-out waits until the caller has finished setting the dialog up, then pops it out if it is still the open one.
  if (popAutoOn()) { const d = $('dialog').firstChild; setTimeout(() => { if (d && $('dialog').firstChild === d) popDlg(kind); }, 0); return; }
  const d = $('dialog').querySelector('.dialog'); if (d) d.insertAdjacentHTML('afterbegin', popBtnHtml(kind));
}
// The pop window's page (route #/pop-dlg/<kind>/<slug>): the dialog alone, filling the window; closing it closes the window.
function renderPopDlg() {
  document.body.classList.add('pop', 'popdlg');
  $('app').innerHTML = ''; $('modal').innerHTML = '';
  const open = POP_DLG[state.route.kind];
  if (open && !$('dialog').firstChild && !state.popDlgOpened) { state.popDlgOpened = true; open(); }
}

/* ---------- ⧉ Pop out for whole pages (AIG-1313) ----------
   Any page on this list opens on its own at #/pop-page/<its address> (core.js parseRoute reads the address behind it and
   marks the route popPage). The button sits top right of the page, outside #app, so a redraw never wipes it. Not on a phone. */
const POP_PAGES = { usage: [460, 640], today: [520, 720], glossary: [560, 760], standups: [640, 780], stats: [760, 760], risks: [760, 760],
  releases: [760, 760], ci: [760, 760], review: [760, 820], knownerrors: [720, 760], improvements: [720, 760], life: [620, 760],
  whatsnew: [620, 780], mail: [620, 760], bin: [620, 720], assumptions: [620, 720], inbox: [560, 800] };
function popPage() {
  const r = state.route || {}, size = POP_PAGES[r.view]; if (!size) return false;
  const inner = location.hash.replace(/^#\//, ''), name = 'aigile-page-' + inner.replace(/[^a-z0-9-]+/gi, '-');
  return !!popOut('page-' + inner.split(/[/?]/)[0], '#/pop-page/' + inner, name, size[0], size[1]);
}
// Called on every refresh: shows the button on a page that can pop out, hides it everywhere else; a popped page fills its window.
function pagePopSync(r = state.route || {}) {
  document.body.classList.toggle('poppage', !!r.popPage || /^#\/pop-page\//.test(location.hash));
  const want = !!POP_PAGES[r.view] && !r.popPage && !/^#\/pop/.test(location.hash);
  let b = $('pagePop');
  if (!want) { if (b) b.hidden = true; return; }
  if (!b) {
    const box = document.createElement('div'); box.id = 'pagePopBar';
    box.innerHTML = popBtn('popPage()', 'id="pagePop"');
    $('app').before(box); b = $('pagePop');
  }
  b.hidden = false;
  if (b.textContent !== t('popout.btn')) { b.title = t('popout.title'); b.setAttribute('aria-label', t('popout.aria')); b.textContent = t('popout.btn'); }   // a language switch
}
if (/^#\/pop-page\//.test(location.hash)) document.body.classList.add('poppage');   // from the first paint: no header flashing up
