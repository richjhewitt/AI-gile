// 🤖 AI tester runs (AIG-291, AIG-292): a smaller-model agent follows the test steps waiting in the owner's For you
// pile (docs/TESTER.md) and marks each card 🤖 passed, failed or skipped. Started by the "Test these for me" button,
// or by the 🌙 watchman once a night. One run at a time; it runs in the AI-gile folder, hidden, and outlives a board
// restart like the teams' runs.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, listSlugs, owner, bad, rolesOn } = require('./store');
const { agentCommand, spawnAgent, spawnHidden, whenGone, killTree } = require('./presence');
const noTokens = require('./notokens');

const ROOT = path.dirname(__dirname), LOG = path.join(DATA, 'logs', '_tester.log'), NAME = 'Tester (Sonnet)';
let run = null, last = null;   // run: { startedAt, projects }; last: when the previous run ended

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
  const prompt = `You are ${NAME} on ${owner()}'s AI-gile board. Read docs/TESTER.md and follow it exactly for these projects: ${projects.join(', ')} (for each: ${cli} tests <proj>). `
    + `Post every verdict with ${cli} checked ... --as "${NAME}". Never accept, move or edit cards, never push, never restart the board on port 4321. When done, stop the sandbox if you started one, say how many passed, failed and skipped, then stop.`;
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `=== ${new Date().toISOString()} started: ${projects.join(', ')} ===\n`);
  const args = ['--model', 'sonnet', '-p', prompt], env = { ...process.env, AIGILE_BACKGROUND: '1', AIGILE_AS: NAME };
  const me = run = { startedAt: now(), projects };
  const done = () => { if (run !== me) return; run = null; last = now(); try { fs.appendFileSync(LOG, '=== exited ===\n'); } catch {} };
  try {
    if (process.platform === 'win32') spawnHidden(agentCommand(), args, { cwd: ROOT, env, out: LOG, err: LOG }).then(pid => { me.pid = pid; if (me.stopped) killTree(pid); whenGone(pid, done); }, done);
    else {
      const fd = fs.openSync(LOG, 'a'), child = spawnAgent(agentCommand(), args, { cwd: ROOT, detached: true, stdio: ['ignore', fd, fd], env });
      me.pid = child.pid; fs.closeSync(fd); child.unref(); child.on('exit', done); child.on('error', done);
    }
  } catch (e) { done(); throw e; }
  return { ok: true, running: true, projects };
}

const testerStatus = () => ({ running: !!run, startedAt: run ? run.startedAt : null, projects: run ? run.projects : [], lastEnded: last, waiting: waiting().reduce((n, x) => n + x.n, 0) });

// ⛔ No Token Mode: end the run.
function stop() { if (!run) return; run.stopped = true; if (run.pid) killTree(run.pid); }

module.exports = { stop, startTester, testerStatus, testsWaiting: waiting };
