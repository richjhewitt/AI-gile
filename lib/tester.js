// 🤖 AI tester runs (AIG-291, AIG-292): a smaller-model agent follows the test steps waiting in the owner's For you
// pile (docs/TESTER.md) and marks each card 🤖 passed, failed or skipped. Started by the "Test these for me" button,
// or by the 🌙 watchman once a night. One run at a time; it runs in the AI-gile folder, hidden, and outlives a board
// restart like the teams' runs.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, listSlugs, owner, bad, rolesOn, isRich, localSettings } = require('./store');
const { agentCommand, spawnAgent, spawnHidden, whenGone, killTree } = require('./presence');
const noTokens = require('./notokens');

const ROOT = path.dirname(__dirname), LOG = path.join(DATA, 'logs', '_tester.log'), NAME = 'Tester (Sonnet)';
const FOLDER = path.join(DATA, 'tester');   // its own folder, not AI-gile's: no project hooks or settings, so a run cannot mark the owner's news seen or be picked up by a lead's --continue (AIG-454)
let run = null, last = null;   // run: { startedAt, projects }; last: when the previous run ended

// The run's folder: its CLAUDE.md is the one-line brief, nothing else.
function folder() {
  fs.mkdirSync(FOLDER, { recursive: true });
  fs.writeFileSync(path.join(FOLDER, 'CLAUDE.md'), `You are the AI tester. Follow docs/TESTER.md in ${ROOT}.\n`);
  return FOLDER;
}

// Projects with tests the tester hasn't looked at yet (handed over with steps, no 🤖 check).
const toCheck = c => c.status === 'verify' && c.testSteps && !c.info && !c.aiCheck;   // 📖 info-only hand-overs are skipped (AIG-392)
function waiting(only) {
  return listSlugs().map(load).filter(p => p && !p.archived && rolesOn(p).includes(NAME) && (!only || only.includes(p.slug)))
    .map(p => ({ slug: p.slug, n: p.cards.filter(toCheck).length })).filter(x => x.n);
}

function startTester(only) {
  noTokens.guard();   // ⛔ (AIG-337)
  if (run) return { ok: true, running: true, already: true, projects: run.projects };
  const ws = waiting(only); if (!ws.length) throw bad('no tests waiting for the AI tester');
  require('./budget').mayRun();   // token budget (AIG-353)
  const projects = ws.map(x => x.slug), cli = `node "${path.join(ROOT, 'aigile.js')}"`;
  const prompt = `You are ${NAME} on ${owner()}'s AI-gile board. Read ${path.join(ROOT, 'docs', 'TESTER.md')} and follow it exactly for these projects: ${projects.join(', ')} (for each: ${cli} tests <proj>). `
    + `Your folder is not the repo: run repo commands from "${ROOT}" (cd there first, or use absolute paths). `
    + `Post every verdict with ${cli} checked ... --as "${NAME}". Never accept, move or edit cards, never push, never restart the board on port 4321. When done, stop the sandbox if you started one, say how many passed, failed and skipped, then stop.`;
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `=== ${new Date().toISOString()} started: ${projects.join(', ')} ===\n`);
  const args = ['--model', 'sonnet', '-p', prompt], env = { ...process.env, AIGILE_BACKGROUND: '1', AIGILE_AS: NAME, AIGILE_ROLE: 'tester' };
  const me = run = { startedAt: now(), projects };
  const done = () => { if (run !== me) return; run = null; last = now(); try { fs.appendFileSync(LOG, '=== exited ===\n'); } catch {} require('./usage').logRun('tester', '_tester', { folder: FOLDER, start: Date.parse(me.startedAt), log: LOG }); };   // AIG-522 #10
  try {
    const cwd = folder();
    if (process.platform === 'win32') spawnHidden(agentCommand(), args, { cwd, env, out: LOG, err: LOG }).then(pid => { me.pid = pid; if (me.stopped) killTree(pid); whenGone(pid, done); }, done);
    else {
      const fd = fs.openSync(LOG, 'a'), child = spawnAgent(agentCommand(), args, { cwd, detached: true, stdio: ['ignore', fd, fd], env });
      me.pid = child.pid; fs.closeSync(fd); child.unref(); child.on('exit', done); child.on('error', done);
    }
  } catch (e) { done(); throw e; }
  return { ok: true, running: true, projects };
}

const testerStatus = () => ({ running: !!run, startedAt: run ? run.startedAt : null, projects: run ? run.projects : [], lastEnded: last, waiting: waiting().reduce((n, x) => n + x.n, 0) });

// ⛔ No Token Mode: end the run.
function stop() { if (!run) return; run.stopped = true; if (run.pid) killTree(run.pid); }

// Trust the AI tester (AIG-467): the owner's setting says which passes the server moves to done itself ('check': none,
// 'sure': only a pass the tester was sure of, 'all': any pass). Some cards always stay for the owner's eyes.
const TRUST = ['check', 'sure', 'all'];
const trust = () => { const t = (localSettings().tester || {}).trust; return TRUST.includes(t) ? t : 'check'; };
const ACTION = /\b(click|press|type|fill|tick|select|choose|drag|tap|enter|hit|open|toggle|switch|pick|hover|scroll|run)\b/i, VISUAL = /\b(look|looks|colou?r|layout|align\w*|spacing|font|icon|shape|pretty|nice|bigger|smaller|shadow|animat\w*)\b/i;
const MONEY = /\b(push|release|pay|payment|budget)\b/i;
// Why a card must not close itself (empty: it may): look-only steps, a server or outside task, money or push, a bug the owner raised.
function mustStayWhy(c) {
  const steps = String(c.testSteps || '').split('\n').filter(l => /^\s*[-*\d]/.test(l));
  if (!steps.length || !steps.some(l => ACTION.test(l)) || steps.every(l => VISUAL.test(l))) return 'look-only';
  if (c.server || c.outside || c.kind === 'server' || c.kind === 'outside') return 'server or outside';
  if (MONEY.test(c.title || '')) return 'money or push';
  if (c.type === 'bug' && isRich(c.createdBy)) return 'bug raised by the owner';
  return '';
}
const mayAutoDone = (c, sure) => { const m = trust(); return (m === 'all' || (m === 'sure' && sure)) && !mustStayWhy(c); };

module.exports = { trust, TRUST, mustStayWhy, mayAutoDone, stop, startTester, testerStatus, testsWaiting: waiting, folder };
