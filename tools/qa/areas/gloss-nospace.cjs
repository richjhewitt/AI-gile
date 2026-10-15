// Run by the QA area "glossary-nospace" (AIG-518): the glossary regex matches terms inside Chinese/Thai text, whole words only elsewhere.
// It evaluates the real glossIndex() from public/js/glossary.js with a stubbed page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(process.argv[2], 'public/js/glossary.js'), 'utf8');
const words = { 'gloss.backlog.word': 'backlog', 'gloss.backlog.text': 'B', 'gloss.sprint.word': '冲刺', 'gloss.sprint.text': 'S', 'gloss.bug.word': 'bug', 'gloss.bug.text': 'G', 'gloss.agent.word': 'ตัวแทน', 'gloss.agent.text': 'A' };
const ctx = { t: k => words[k] || k, document: { addEventListener() {}, querySelectorAll: () => [], documentElement: {} }, MutationObserver: class { observe() {} }, localStorage: { getItem: () => null }, NodeFilter: {}, i18n: { ready: true }, esc: s => s, $: () => ({}), console };
vm.createContext(ctx);
vm.runInContext(src + '\nglossIndex(); this.re = glossRe;', ctx);
const hits = s => { ctx.re.lastIndex = 0; return s.match(ctx.re) || []; };
console.log(JSON.stringify({
  han: hits('请在冲刺开始前整理backlog'),
  thai: hits('ตัวแทนทำงานเสร็จแล้ว'),
  whole: hits('a bug, debugging, bugs'),
}));
