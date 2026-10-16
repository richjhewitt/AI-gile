/* ---------- words explained (AIG-102, AIG-1296) ---------- */
// One word list for two things: the 📖 glossary page (#/glossary, searchable), and, when "Explain developer
// words" is on (⚙️ Setup), a dotted underline with a plain explanation on hover wherever those words appear.
// Words and explanations live in the language files: gloss.<id>.word / gloss.<id>.text (.also: other forms, comma list).
// AIG-1296: in groups, shown as headings on the page and in the teaser's 📖 dialog (tools/gen/site-lang.mjs reads this
// block as written: keep it a plain object of plain arrays). Group names: gloss.g.<group>.
const GLOSS_GROUPS = {
  build: ['repo', 'branch', 'commit', 'push', 'merge', 'pr', 'refactor', 'bug', 'test', 'qa'],
  change: ['deploy', 'release', 'rollback', 'live', 'change', 'risk', 'chgwin', 'gonogo', 'approval', 'quiettime'],
  run: ['service', 'uptime', 'statuspage', 'desk', 'svcrequest', 'incident', 'major', 'oncall', 'replyby', 'postmortem', 'problem',
    'rootcause', 'workaround', 'knownerror', 'runbook', 'ci', 'expiry', 'backup', 'restore', 'svcreview', 'accessreview',
    'improvements', 'tokencap'],
  team: ['backlog', 'sprint', 'standup', 'kanban', 'wip', 'dod', 'testpile', 'retro', 'peerreview', 'swarm', 'scrummaster',
    'agent', 'token', 'hook'],
};
const GLOSSARY = Object.values(GLOSS_GROUPS).flat();
// Words on every screen, or everyday words with a special meaning here, would be underlined everywhere:
// they stay in the glossary but get no tooltip.
const NO_TIP = ['test', 'live', 'change', 'problem'];
const NO_AI_SKIP = ['agent', 'token', 'hook', 'peerreview', 'tokencap'];   // AIG-821: words about AI agents, left out in No AI mode
const glossNoAi = () => typeof NoAi !== 'undefined' && NoAi.on;
const glossFold = s => { s = String(s || '').toLowerCase(); try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch {} return s; };
const glossAlso = id => { const a = t('gloss.' + id + '.also'); return a && !String(a).startsWith('gloss.') ? String(a).split(',').map(x => x.trim()).filter(Boolean) : []; };
const glossOn = () => { try { return localStorage.getItem('aigile.explain') === '1'; } catch { return false; } };
function setExplain(on) {
  try { on ? localStorage.setItem('aigile.explain', '1') : localStorage.removeItem('aigile.explain'); } catch {}
  if (on) markDevWords(document.body); else document.querySelectorAll('abbr.devw').forEach(a => a.replaceWith(document.createTextNode(a.textContent)));
}

/* ---------- the glossary page ---------- */
// A heading per group (h2 page title, h3 groups), one search box across them all; the count is said aloud as you type.
function renderGlossary() {
  const loc = (typeof i18n !== 'undefined' && i18n.locale) || undefined;
  const groups = Object.entries(GLOSS_GROUPS).map(([g, ids]) => ({ g, items: ids.filter(id => !(glossNoAi() && NO_AI_SKIP.includes(id)))
    .map(id => ({ id, word: t('gloss.' + id + '.word'), text: t('gloss.' + id + '.text'), also: glossAlso(id) }))
    .sort((a, b) => a.word.localeCompare(b.word, loc)) })).filter(x => x.items.length);
  const n = groups.reduce((s, x) => s + x.items.length, 0);
  return `<div class="gloss"><h2>${esc(t('gloss.title'))}</h2><p class="muted">${esc(t('gloss.about'))}</p>
    <input type="search" id="glossQ" placeholder="${esc(t('gloss.search'))}" oninput="filterGlossary(this.value)" aria-label="${esc(t('gloss.search'))}" aria-describedby="glossCount" autocomplete="off">
    <p class="muted gloss-count" id="glossCount" role="status" aria-live="polite" aria-atomic="true">${esc(t('gloss.count', { count: n }))}</p>
    ${groups.map(x => `<section class="gloss-group" data-group="${x.g}" aria-labelledby="glossG-${x.g}"><h3 id="glossG-${x.g}">${esc(t('gloss.g.' + x.g))}</h3>
    <dl class="gloss-list">${x.items.map(w => `<div class="gloss-item" data-id="${w.id}" data-k="${esc(glossFold([w.word, w.text, ...w.also].join(' ')))}"><dt>${esc(w.word)}</dt><dd>${esc(w.text)}</dd></div>`).join('')}</dl></section>`).join('')}
    <p class="muted" id="glossNone" hidden>${esc(t('gloss.none'))}</p></div>`;
}
function filterGlossary(q) {
  q = glossFold(q.trim()); let n = 0;
  document.querySelectorAll('.gloss-item').forEach(el => { const hit = !q || (el.dataset.k || '').includes(q); el.hidden = !hit; n += hit; });
  document.querySelectorAll('.gloss-group').forEach(g => { g.hidden = !g.querySelector('.gloss-item:not([hidden])'); });
  $('glossNone').hidden = n > 0;
  // With no match the visible "no word matches" line says it; the count line still reads it out, unseen.
  $('glossCount').textContent = n ? t('gloss.count', { count: n }) : t('gloss.none'); $('glossCount').classList.toggle('zero', !n);
}

/* ---------- tooltips on the page ---------- */
// Whole words only; never inside typing boxes, code, links' own tooltips or a tooltip already made.
let glossRe = null, glossText = null;
const glossKey = w => String(w).trim().replace(/\s+/g, ' ').toLowerCase();
function glossIndex() {
  glossText = new Map();
  // AIG-1296: terms of more words ("major incident") match across any run of spaces; the longest term wins where
  // several start at the same place ("major incident" over "incident"), so each is listed longest first.
  for (const id of GLOSSARY.filter(id => !NO_TIP.includes(id) && !(glossNoAi() && NO_AI_SKIP.includes(id)))) for (const w of [t('gloss.' + id + '.word'), ...glossAlso(id)]) {
    const k = glossKey(w); if (k && !k.startsWith('gloss.') && !glossText.has(k)) glossText.set(k, t('gloss.' + id + '.text'));
  }
  // AIG-518: scripts written without spaces (Chinese, Japanese, Thai, Lao, Khmer, Burmese) have no word edges, so a term
  // there matches inside a sentence (longest first); every other term still matches whole words only.
  const NOSPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
  const quote = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const all = [...glossText.keys()].sort((a, b) => b.length - a.length);
  const spaced = all.filter(w => !NOSPACE.test(w)).map(quote), bare = all.filter(w => NOSPACE.test(w)).map(quote);
  const parts = [];
  if (spaced.length) parts.push('(?<![\\p{L}\\p{N}])(?:' + spaced.join('|') + ')(?![\\p{L}\\p{N}])');
  if (bare.length) parts.push('(?:' + bare.join('|') + ')');
  glossRe = new RegExp(parts.join('|') || '(?!)', 'giu');
}
const SKIP = /^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE|CODE|PRE|ABBR|BUTTON|DT)$/;
function markDevWords(root) {
  if (!glossOn() || !root || !i18n.ready) return;
  if (!glossRe) glossIndex();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
    for (let p = n.parentElement; p && p !== root.parentElement; p = p.parentElement) if (SKIP.test(p.tagName) || p.isContentEditable || p.classList.contains('gloss')) return NodeFilter.FILTER_REJECT;
    glossRe.lastIndex = 0; return glossRe.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  } });
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment(), s = n.nodeValue; let last = 0;
    glossRe.lastIndex = 0;
    for (let m; (m = glossRe.exec(s));) {
      const at = m.index;
      frag.append(s.slice(last, at));
      const a = document.createElement('abbr'); a.className = 'devw'; a.tabIndex = 0;
      a.title = glossText.get(glossKey(m[0])) || ''; a.textContent = m[0]; frag.append(a);
      last = at + m[0].length;
    }
    frag.append(s.slice(last)); n.replaceWith(frag);
  }
}
// Pages redraw all the time: mark what's new, a moment after it lands.
let glossTimer = null;
new MutationObserver(() => { if (!glossOn()) return; clearTimeout(glossTimer); glossTimer = setTimeout(() => markDevWords(document.body), 150); })
  .observe(document.documentElement, { childList: true, subtree: true });
