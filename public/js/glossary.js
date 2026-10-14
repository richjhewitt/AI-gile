/* ---------- dev words explained (AIG-102) ---------- */
// One word list for two things: the 📖 glossary page (#/glossary, searchable), and, when "Explain developer
// words" is on (⚙️ Setup), a dotted underline with a plain explanation on hover wherever those words appear.
// Words and explanations live in the language files: gloss.<id>.word / gloss.<id>.text.
const GLOSSARY = ['backlog', 'sprint', 'standup', 'bug', 'test', 'commit', 'push', 'branch', 'merge', 'repo', 'refactor',
  'deploy', 'kanban', 'wip', 'pr', 'hook', 'token', 'agent'];
// Words on every screen would be underlined everywhere: they stay in the glossary but get no tooltip.
const NO_TIP = ['test'];
const glossOn = () => { try { return localStorage.getItem('aigile.explain') === '1'; } catch { return false; } };
function setExplain(on) {
  try { on ? localStorage.setItem('aigile.explain', '1') : localStorage.removeItem('aigile.explain'); } catch {}
  if (on) markDevWords(document.body); else document.querySelectorAll('abbr.devw').forEach(a => a.replaceWith(document.createTextNode(a.textContent)));
}

/* ---------- the glossary page ---------- */
function renderGlossary() {
  const items = GLOSSARY.map(id => ({ word: t('gloss.' + id + '.word'), text: t('gloss.' + id + '.text') })).sort((a, b) => a.word.localeCompare(b.word));
  return `<div class="gloss"><h2>${esc(t('gloss.h'))}</h2><p class="muted">${esc(t('gloss.intro'))}</p>
    <input type="search" id="glossQ" placeholder="${esc(t('gloss.search'))}" oninput="filterGlossary(this.value)" aria-label="${esc(t('gloss.search'))}">
    <dl class="gloss-list">${items.map(x => `<div class="gloss-item"><dt>${esc(x.word)}</dt><dd>${esc(x.text)}</dd></div>`).join('')}</dl>
    <p class="muted" id="glossNone" hidden>${esc(t('gloss.none'))}</p></div>`;
}
function filterGlossary(q) {
  q = q.trim().toLowerCase(); let n = 0;
  document.querySelectorAll('.gloss-item').forEach(el => { const hit = !q || el.textContent.toLowerCase().includes(q); el.hidden = !hit; n += hit; });
  $('glossNone').hidden = n > 0;
}

/* ---------- tooltips on the page ---------- */
// Whole words only; never inside typing boxes, code, links' own tooltips or a tooltip already made.
let glossRe = null, glossText = null;
function glossIndex() {
  glossText = new Map();
  for (const id of GLOSSARY.filter(id => !NO_TIP.includes(id))) for (const w of [t('gloss.' + id + '.word'), ...String(t('gloss.' + id + '.also')).split(',')]) {
    const k = w.trim().toLowerCase(); if (k && !k.startsWith('gloss.')) glossText.set(k, t('gloss.' + id + '.text'));
  }
  // AIG-518: scripts written without spaces (Chinese, Japanese, Thai, Lao, Khmer, Burmese) have no word edges, so a term
  // there matches inside a sentence (longest first); every other term still matches whole words only.
  const NOSPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
  const quote = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      a.title = glossText.get(m[0].toLowerCase()) || ''; a.textContent = m[0]; frag.append(a);
      last = at + m[0].length;
    }
    frag.append(s.slice(last)); n.replaceWith(frag);
  }
}
// Pages redraw all the time: mark what's new, a moment after it lands.
let glossTimer = null;
new MutationObserver(() => { if (!glossOn()) return; clearTimeout(glossTimer); glossTimer = setTimeout(() => markDevWords(document.body), 150); })
  .observe(document.documentElement, { childList: true, subtree: true });
