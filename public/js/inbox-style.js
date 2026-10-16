// AI-gile inbox styles (split from js/inbox.js, AIG-165): the CSS the inbox adds to the page.
// Classic script; inbox.js injects INBOX_CSS. Load it before inbox.js.
// Questions = strong blue, tests = pale blue, blocked = red. Every use also carries an icon and a word.
const INBOX_CSS = `
:root {
  --q-bg: #2563eb; --q-fg: #fff; --q-tint: #eef3ff; --q-line: #2563eb; --q-ink: #1d4ed8;
  --b-line: #c81e1e; --b-tint: #fdecec; --b-ink: #9b1212;
  --t-bg: #e4ecff; --t-fg: #1e40af; --t-tint: #f1f5ff; --t-line: #8fa8e8; --t-ink: #1e40af;
  --k-bg: #fff1d1; --k-fg: #7a4300; --k-tint: #fffaf0; --k-line: #e0a640; --k-ink: #7a4300;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme=light]) {
    --q-bg: #3b74f0; --q-fg: #fff; --q-tint: #162039; --q-line: #5b8cf5; --q-ink: #9dbbff;
    --b-line: #ef5350; --b-tint: #2c1618; --b-ink: #ff9b97;
    --t-bg: #22305a; --t-fg: #bcd0ff; --t-tint: #181e2e; --t-line: #4a5f9a; --t-ink: #a9c1ff;
    --k-bg: #3d2e10; --k-fg: #ffd591; --k-tint: #221c10; --k-line: #a0762a; --k-ink: #ffcf7a;
  }
}
:root[data-theme=dark], :root[data-theme=black] {
    --q-bg: #3b74f0; --q-fg: #fff; --q-tint: #162039; --q-line: #5b8cf5; --q-ink: #9dbbff;
    --b-line: #ef5350; --b-tint: #2c1618; --b-ink: #ff9b97;
    --t-bg: #22305a; --t-fg: #bcd0ff; --t-tint: #181e2e; --t-line: #4a5f9a; --t-ink: #a9c1ff;
    --k-bg: #3d2e10; --k-fg: #ffd591; --k-tint: #221c10; --k-line: #a0762a; --k-ink: #ffcf7a;
}
#inboxTop { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ib-btn { display: inline-flex; align-items: center; gap: 8px; padding: 4px 8px 4px 12px; border: 1px solid var(--line); border-radius: 99px; background: var(--panel); font-weight: 600; }
.ib-btn:hover { border-color: var(--accent); }
.ib-btn.on { outline: 2px solid var(--accent); outline-offset: 1px; }
.ib-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 99px; font-weight: 700; font-size: 13px; white-space: nowrap; }
.ib-badge.q { background: var(--q-bg); color: var(--q-fg); }
.ib-badge.t { background: var(--t-bg); color: var(--t-fg); font-weight: 600; border: 1px solid var(--t-line); }
.ib-badge.k { background: var(--k-bg); color: var(--k-fg); font-weight: 600; border: 1px solid var(--k-line); }
.ib-sec.k h3, .k .ib-tag { color: var(--k-ink); }
.ib-item.k { border-left: 6px solid var(--k-line); background: var(--k-tint); }
.ib-item.k textarea { min-height: 36px; }
@media (prefers-reduced-motion: no-preference) {
  .ib-badge.q { animation: ibglow 2.8s ease-in-out infinite; }
  @keyframes ibglow { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--q-bg) 30%, transparent); } }
}
.ib-alerts { font-size: 12px; padding: 3px 10px; border-radius: 99px; color: var(--muted); }
.ib-alerts.on { color: var(--text); }

.ib { max-width: 860px; margin: 0 auto; }
.ib-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.ib-head h2 { margin: 0; font-size: 20px; }
.ib-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 6px; margin: -4px 0 6px; border-bottom: 1px solid var(--line); }
.ib-tab { flex: none; border-radius: 99px; padding: 5px 12px; font-weight: 600; display: inline-flex; gap: 6px; align-items: center; }
.ib-tab.on { background: var(--text); color: var(--panel); border-color: var(--text); }
.ib-tab .n { font-weight: 400; opacity: .7; }
.ib-tab .nm { max-width: 18ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }   /* long names cut short; the emoji tells them apart (AIG-101) */
.ib-tab .tq, .ib-tab .tk, .ib-tab .tt { font-size: 12px; font-weight: 600; }
.ib-tab .tq { color: var(--q-ink); } .ib-tab.on .tq, .ib-tab.on .tk, .ib-tab.on .tt { color: inherit; }
.ib-tab .tk { color: var(--k-ink); } .ib-tab .tt { color: var(--t-ink); }
.ib-toast { min-height: 20px; color: var(--muted); font-size: 13px; margin: -8px 0 10px; }
.ib-td-row { padding: 4px 0; display: flex; gap: 8px; align-items: center; }
.ib-sec h3 { display: flex; align-items: center; gap: 8px; margin: 22px 0 10px; font-size: 15px; }
.ib-sec.q h3 { color: var(--q-ink); font-size: 17px; }
.ib-sec.t h3 { color: var(--t-ink); }
.ib-sec h3 .ib-badge { font-size: 12px; }
.ib-item { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; box-shadow: var(--shadow); }
.ib-item.q { border: 2px solid var(--q-line); border-left-width: 8px; background: var(--q-tint); }
.ib-item.t { border-left: 6px solid var(--t-line); background: var(--t-tint); }
.ib-item.flash { animation: ibflash 1.6s ease-out 1; }
@media (prefers-reduced-motion: reduce) { .ib-item.flash { animation: none; outline: 2px solid var(--accent); } }
@keyframes ibflash { 0% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 45%, transparent); } 100% { box-shadow: var(--shadow); } }
.ib-top { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.ib-tag { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.ib-item.q.blk { border-color: var(--b-line); background: var(--b-tint); } .q.blk .ib-tag { color: var(--b-ink); }
.q .ib-tag { color: var(--q-ink); } .t .ib-tag { color: var(--t-ink); }
.ib-chat { display: flex; gap: 14px; align-items: flex-start; }
.ib-chats { flex: 0 0 230px; display: flex; flex-direction: column; gap: 6px; position: sticky; top: 70px; }
.ib-chatbtn { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-left: 5px solid var(--proj, var(--line)); border-radius: 10px; background: var(--panel); cursor: pointer; }
.ib-chatbtn.on { background: color-mix(in srgb, var(--proj, var(--accent)) 14%, var(--panel)); border-color: var(--proj, var(--accent)); }
.ib-chatbtn .av { font-size: 22px; }
.ib-chatbtn .nm { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.ib-chatbtn .nm .ib-hint { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-thread { flex: 1; min-width: 0; }
.ib-thread .ib-item.q { border-radius: 16px 16px 16px 4px; }
@media (max-width: 720px) { .ib-chat { flex-direction: column; align-items: stretch; } .ib-chats { position: static; flex-basis: auto; width: 100%; } .ib-thread { width: 100%; } }
/* AIG-410: a long log or code line scrolls inside its own box; it never widens the item or the page */
.ib-item, .ib-question { min-width: 0; max-width: 100%; } .ib-item .codebox, .ib-item pre { max-width: 100%; }
.ib-item[data-project] .ib-proj[role=link] { cursor: pointer; } .ib-item[data-project] .ib-proj[role=link]:hover { filter: brightness(1.15); } .ib-item[data-project] .ib-proj[role=link]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ib-proj { font-weight: 700; color: #fff; background: var(--proj, var(--muted)); border-radius: 999px; padding: 1px 9px; font-size: 13px; }
.ib-item.q, .ib-item.t, .ib-item.k, .ib-item { border-left: 8px solid var(--proj, var(--line)); }
.ib-tab[style] { border-bottom: 3px solid var(--proj); }
.ib-item.q.blk { border-left-color: var(--proj, var(--b-line)); }
.ib-title { font-weight: 600; margin: 3px 0 2px; font-size: 15px; }
.ib-title a:hover { text-decoration: underline; }
.ib-id { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--muted); }
.ib-who { font-size: 13px; color: var(--muted); margin: 2px 0 6px; }
.ib-question { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 6px 0 10px; max-height: 40vh; overflow: auto; }
.ib-item textarea { min-height: 56px; }
.ib-item .actions { margin-top: 8px; }
.ib-steps { margin: 8px 0 4px; }
.ib-steps summary { cursor: pointer; font-weight: 600; color: var(--t-ink); }
.ib-steps .body { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-top: 6px; max-height: 40vh; overflow: auto; }
.ib-empty { text-align: center; padding: 56px 16px; }
.ib-empty .big { font-size: 26px; font-weight: 700; }
.ib-empty p { color: var(--muted); margin: 8px 0 0; }
.ib-err { color: var(--danger); font-size: 13px; margin-top: 6px; }
.ib-sb { display: flex; gap: 6px; align-items: flex-start; margin-top: 8px; }
.ib-sb[hidden] { display: none; }
.ib-sb textarea { flex: 1; min-width: 0; margin: 0; }
.ib-hint { font-size: 12px; color: var(--muted); }
/* card groups (AIG-386) */
.ib-group .ib-gcard { margin-top: 8px; } .ib-group .ib-gcard > a { font-weight: 600; text-decoration: underline; }
.ib-group .body { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-top: 6px; max-height: 30vh; overflow: auto; }
@media (max-width: 760px), (max-height: 500px) and (pointer: coarse) {
  .ib-btn { padding: 3px 6px 3px 10px; gap: 5px; }
  .ib-badge { padding: 2px 8px; }
}`;
