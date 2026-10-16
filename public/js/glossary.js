/* ---------- words explained (AIG-102, AIG-1296) ---------- */
// One word list for two things: the 📖 glossary page (#/glossary, searchable), and, when "Explain developer
// words" is on (⚙️ Setup), a dotted underline with a plain explanation on hover wherever those words appear.
// Words and explanations live in the language files: gloss.<id>.word / gloss.<id>.text (.also: other forms, comma list).
// AIG-1296: in groups, shown as headings on the page and in the teaser's 📖 dialog (tools/gen/site-lang.mjs reads this
// block as written: keep it a plain object of plain arrays). Group names: gloss.g.<group>.
// AIG-1408: along a project's life, from the first idea to a service people rely on (Agile, security, AI and money too).
const GLOSS_GROUPS = {
  idea: ['discovery', 'problemstmt', 'user', 'stakeholder', 'persona', 'userresearch', 'journey', 'painpoint',
    'assumption', 'hypothesis', 'experiment', 'poc', 'prototype', 'wireframe', 'mockup', 'bizcase', 'feasibility',
    'outcome', 'output', 'successmetric', 'kpi', 'okr'],
  plan: ['product', 'vision', 'po', 'pm', 'projmgr', 'roadmap', 'milestone', 'mvp', 'requirement', 'scope',
    'scopecreep', 'feature', 'epic', 'story', 'ac', 'task', 'ticket', 'priority', 'prioritise', 'estimate',
    'storypoints', 'tshirt', 'poker', 'dependency', 'blocker', 'deadline', 'deliverable', 'forecast', 'metric',
    'feedback'],
  agile: ['backlog', 'sprint', 'standup', 'kanban', 'wip', 'dod', 'retro', 'swarm', 'scrummaster', 'agile',
    'manifesto', 'waterfall', 'iteration', 'increment', 'scrum', 'scrumteam', 'ceremonies', 'sprintplan',
    'sprintgoal', 'sprintbacklog', 'productbacklog', 'productgoal', 'refinement', 'sprintreview', 'demo', 'timebox',
    'velocity', 'capacity', 'burndown', 'burnup', 'kanbanboard', 'pullsys', 'flow', 'leadtime', 'cycletime',
    'throughput', 'bottleneck', 'swimlane', 'lean', 'waste', 'kaizen', 'selforg', 'crossfunc', 'spike', 'rework',
    'safe'],
  build: ['repo', 'branch', 'commit', 'push', 'merge', 'pr', 'refactor', 'bug', 'peerreview', 'code', 'proglang',
    'developer', 'software', 'app', 'webapp', 'frontend', 'backend', 'fullstack', 'ui', 'ux', 'accessibility',
    'responsive', 'designsys', 'architecture', 'database', 'schema', 'sql', 'data', 'server', 'client', 'api',
    'endpoint', 'integration', 'webhook', 'library', 'framework', 'sdk', 'softdep', 'package', 'pkgmgr', 'git',
    'github', 'vcs', 'clone', 'pull', 'mainbranch', 'conflict', 'diff', 'fork', 'script', 'build', 'compile', 'cli',
    'config', 'envvar', 'debugging', 'pairing', 'docs', 'readme', 'legacy', 'techdebt'],
  test: ['test', 'qa', 'testpile', 'autotest', 'manualtest', 'unittest', 'integtest', 'endtoend', 'uat',
    'regression', 'smoke', 'exploratory', 'testcase', 'coverage', 'testdata', 'edgecase', 'happypath', 'perftest',
    'loadtest', 'sectest', 'accesstest', 'linting', 'static', 'flaky', 'repro', 'severity'],
  change: ['deploy', 'release', 'rollback', 'live', 'change', 'risk', 'chgwin', 'gonogo', 'approval', 'quiettime',
    'devops', 'cicd', 'contdeploy', 'pipeline', 'environment', 'devenv', 'testenv', 'staging', 'artifact', 'hotfix',
    'patch', 'version', 'relnotes', 'flag', 'rollfwd', 'canary', 'bluegreen', 'zerodown', 'chgenable', 'cab',
    'stdchange', 'normchange', 'emergchange', 'automation', 'infra', 'iac', 'cloud', 'provider', 'hosting', 'domain',
    'dns', 'container', 'vm', 'serverless', 'lb', 'cache', 'cdn', 'migration'],
  run: ['service', 'uptimepct', 'uptime', 'statuspage', 'desk', 'svcrequest', 'incident', 'major', 'oncall',
    'replyby', 'postmortem', 'problem', 'rootcause', 'workaround', 'knownerror', 'runbook', 'ci', 'expiry', 'backup',
    'restore', 'svcreview', 'accessreview', 'improvements', 'tokencap', 'svcmgmt', 'itil', 'itsm', 'managed',
    'svcowner', 'sla', 'slo', 'sli', 'availability', 'downtime', 'errorbudget', 'outage', 'degraded', 'monitoring',
    'observability', 'log', 'trace', 'latency', 'alert', 'alertfatigue', 'dashboard', 'paging', 'escalation',
    'triage', 'impact', 'urgency', 'plevels', 'queue', 'tiers', 'ic', 'responsetime', 'resolution', 'mttr', 'mtbf',
    'cmdb', 'asset', 'capplan', 'scaling', 'bcp', 'dr', 'rto', 'rpo', 'redundancy', 'failover', 'spof', 'maintwin',
    'handover', 'kb', 'csat', 'supplier', 'retire', 'eol'],
  sec: ['cybersec', 'authn', 'authz', 'mfa', 'sso', 'pwmgr', 'secret', 'apikey', 'accesstoken', 'encryption',
    'https', 'cert', 'permissions', 'leastpriv', 'rbac', 'vuln', 'zeroday', 'malware', 'ransomware', 'phishing',
    'socialeng', 'firewall', 'vpn', 'ddos', 'pentest', 'audit', 'threatmodel', 'breach', 'pii', 'gdpr', 'dataprot',
    'privacypolicy', 'consent', 'cookie', 'minimisation', 'retention', 'anon', 'pseudo', 'dpa', 'dpia', 'auditlog',
    'compliance', 'iso', 'soc'],
  ai: ['agent', 'token', 'hook', 'ai', 'ml', 'model', 'llm', 'genai', 'chatbot', 'prompt', 'prompteng', 'sysprompt',
    'context', 'ctxwin', 'session', 'memory', 'hallucination', 'training', 'trainingdata', 'cutoff', 'finetune',
    'inference', 'tooluse', 'subagent', 'multiagent', 'autonomy', 'hitl', 'guardrails', 'rag', 'embedding',
    'vectordb', 'mcp', 'temperature', 'multimodal', 'evals', 'bias', 'responsible', 'injection', 'ratelimit',
    'usagelimit', 'vibe'],
  money: ['budget', 'costest', 'roi', 'tco', 'capex', 'subscription', 'saas', 'payg', 'overage', 'billingalert',
    'freetier', 'pricing', 'licence', 'opensource', 'osslicence', 'proprietary', 'copyright', 'ip', 'tos',
    'contract', 'sow', 'fixedprice', 'tm', 'invoice', 'lockin', 'procurement', 'servicecredit'],
};
// AIG-1363: the board's own words come first, in the order a newcomer meets them (not sorted). App only: the website's dev words
// read GLOSS_GROUPS above, so these stay out of it.
const GLOSS_BOARD = ['card', 'project', 'forteam', 'lead', 'agentprog', 'dispatcher', 'space', 'playground', 'hyperfocus'];
const GLOSS_ALL = { board: GLOSS_BOARD, ...GLOSS_GROUPS };
const GLOSSARY = Object.values(GLOSS_ALL).flat();
// Words on every screen, or everyday words with a special meaning here, would be underlined everywhere:
// they stay in the glossary but get no tooltip.
const NO_TIP = ['test', 'live', 'change', 'problem', 'card', 'project', 'forteam', 'lead', 'space', 'user',
  'assumption', 'experiment', 'outcome', 'output', 'product', 'requirement', 'feature', 'task', 'priority',
  'estimate', 'deadline', 'forecast', 'feedback', 'demo', 'capacity', 'flow', 'waste', 'code', 'software', 'app',
  'data', 'client', 'library', 'package', 'pull', 'script', 'build', 'config', 'docs', 'environment', 'automation',
  'container', 'log', 'alert', 'dashboard', 'impact', 'urgency', 'asset', 'supplier', 'secret', 'permissions',
  'consent', 'cookie', 'ai', 'model', 'context', 'session', 'memory', 'training', 'temperature', 'bias', 'budget',
  'subscription', 'licence', 'copyright', 'contract', 'invoice'];
const NO_AI_SKIP = ['peerreview', 'tokencap', 'lead', 'agentprog', 'dispatcher', ...GLOSS_GROUPS.ai];   // AIG-821: words about AI agents, left out in No AI mode (AIG-1408: the whole 🤖 group)
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
  const groups = Object.entries(GLOSS_ALL).map(([g, ids]) => ({ g, items: ids.filter(id => !(glossNoAi() && NO_AI_SKIP.includes(id)))
    .map(id => ({ id, word: t('gloss.' + id + '.word'), text: t('gloss.' + id + '.text'), also: glossAlso(id) }))
    .sort((a, b) => g === 'board' ? 0 : a.word.localeCompare(b.word, loc)) })).filter(x => x.items.length);
  const n = groups.reduce((s, x) => s + x.items.length, 0);
  return `<div class="gloss"><h2>${esc(t('gloss.title'))}</h2><p class="muted">${esc(t('gloss.about'))}</p>
    <input type="search" id="glossQ" placeholder="${esc(t('gloss.search'))}" oninput="filterGlossary(this.value)" aria-label="${esc(t('gloss.search'))}" aria-describedby="glossCount" autocomplete="off">
    <p class="muted gloss-count" id="glossCount" role="status" aria-live="polite" aria-atomic="true">${esc(t('gloss.count', { count: n }))}</p>
    ${groups.map(x => `<section class="gloss-group" data-group="${x.g}" aria-labelledby="glossG-${x.g}"><h3 id="glossG-${x.g}">${esc(t('gloss.g.' + x.g))}</h3>
    <dl class="gloss-list">${x.items.map(w => `<div class="gloss-item" data-id="${w.id}" data-k="${esc(glossFold([w.word, w.text, ...w.also].join(' ')))}"><dt>${esc(w.word)}</dt><dd>${esc(w.text)}</dd></div>`).join('')}</dl></section>`).join('')}
    <p class="muted" id="glossNone" hidden>${esc(t('gloss.none'))}</p></div>`;
}
// AIG-1327: #/glossary/<id> (the practice incident's 📖 links): the search box filled with that word.
function glossWord(id) {
  const q = $('glossQ'); if (!q) return; q.dataset.w = id || '';
  if (!id || !GLOSSARY.includes(id)) return;
  q.value = t('gloss.' + id + '.word'); filterGlossary(q.value);
  const el = document.querySelector(`.gloss-item[data-id="${id}"]`); if (el) { el.classList.add('gloss-hit'); el.scrollIntoView({ block: 'nearest' }); }
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
  // AIG-1453: a word goes on through vowel signs and viramas (\p{M}, as in Hindi or Kannada) and the zero-width (non-)joiner.
  const NOSPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
  const quote = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const all = [...glossText.keys()].sort((a, b) => b.length - a.length);
  const spaced = all.filter(w => !NOSPACE.test(w)).map(quote), bare = all.filter(w => NOSPACE.test(w)).map(quote);
  const parts = [];
  if (spaced.length) parts.push('(?<![\\p{L}\\p{M}\\p{N}\\u200C\\u200D])(?:' + spaced.join('|') + ')(?![\\p{L}\\p{M}\\p{N}\\u200C\\u200D])');
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
