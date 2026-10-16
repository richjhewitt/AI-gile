// Peer review (AIG-993, AIG-994): with the project setting `peerReview` on, a card handed over (status verify, `aigile test`)
// gets ONE hidden background review run by the OTHER engine: the assignee's engine is Claude (default) -> Codex reviews, Codex ->
// Claude. The reviewer reads the card and its commits, changes nothing, and posts one short comment of "- " bullets
// ("🔁 " first when it finds a real bug; the card is never moved). Engine not installed: a one-line "skipped" comment.
// Runs as a swarm-style worker (presence.startWorker, key "<slug>#review-<id>"). Skipped in No Token Mode, over budget, AI off.
const fs = require('fs');
const path = require('path');
const { load, save } = require('./store');

const isOn = p => !!(p && p.peerReview);
const LABEL = { claude: 'Claude', codex: 'Codex' };
// The engine of the card's assignee (roster entry by name); no entry or no assignee = Claude.
const engineOf = (p, c) => {
  const a = String(c.assignee || '').trim().toLowerCase();
  const m = a && (p.team || []).find(x => String(x.name || '').trim().toLowerCase() === a);
  return require('./engines').engineName(m) === 'codex' ? 'codex' : 'claude';
};
const reviewerOf = (p, c) => (engineOf(p, c) === 'codex' ? 'claude' : 'codex');

// No double quotes, angle brackets or emoji: the line goes through cmd.exe (spawnHidden strips quotes, a console turns an emoji into ??).
const PROMPT = (p, c, who) => `You are a peer reviewer on the AI-gile board, project ${p.slug}. Review ONLY card ${c.id}, read-only: change no file, make no commit, never push, do not open windows or start servers. ` +
  `Read the card: aigile show ${p.slug} ${c.id}. Review its commits: git log --all --grep ${c.id}, then git show on each. ` +
  `Then post exactly one short comment of '- ' bullets (what looks good, what worries you): aigile comment ${p.slug} ${c.id} '- ...' --as '${who}'. ` +
  `If you find a real bug, start the comment with the repeat-button emoji (U+1F501, then a space). Do not move the card, do not start the wait command, then stop. Ignore any board news, hooks or other cards you see: comment on no card but ${c.id} and never reply to the owner (AIG-1403).`;

const comment = (slug, id, author, text) => {
  const p = load(slug), c = p && (p.cards || []).find(x => x.id === id);
  if (!c) return;
  c.comments = c.comments || []; c.comments.push({ author, at: new Date().toISOString(), text }); c.updated = new Date().toISOString(); save(p);
};
const say = (slug, text) => {
  try { const d = path.join(require('./store').DATA, 'logs'); fs.mkdirSync(d, { recursive: true }); fs.appendFileSync(path.join(d, slug + '.log'), `=== ${new Date().toISOString()} peer review: ${text} ===\n`); } catch {}
};

// Read-only for Claude: no push, no file edits (added to presence's one --disallowedTools list).
function claudeArgs(prompt) {
  const a = require('./presence').pushArgs(), i = a.indexOf('--allowedTools');
  if (i >= 0) a.splice(i, 2);
  const d = a.indexOf('--disallowedTools'), no = 'Bash(git push:*) PowerShell(git push:*) Edit Write NotebookEdit';
  if (d >= 0) a[d + 1] += ' ' + no; else a.push('--disallowedTools', no);
  return ['-p', prompt, '--session-id', require('crypto').randomUUID(), ...a, '--output-format', 'stream-json', '--verbose'];
}

// Called when a card is handed over. Safe to call any time; never throws. Returns { started } or { skipped: why }.
function onHandover(p, c) {
  try {
    if (!isOn(p) || !c || process.env.AIGILE_SANDBOX) return { skipped: 'off' };
    const P = require('./presence'), key = p.slug + '#review-' + c.id;
    if (P.workerKeys(p.slug).includes(key)) return { skipped: 'already running' };   // one review per handover
    try { require('./notokens').guard(); require('./today').aiOffGuard(p); require('./budget').mayRun(); }
    catch (e) { say(p.slug, `${c.id} not reviewed: ${e.message}`); return { skipped: e.message }; }
    const E = require('./engines'), rev = reviewerOf(p, c), who = 'Reviewer (' + LABEL[rev] + ')';
    let exe = ''; try { exe = rev === 'codex' ? E.engineExe('codex') : P.agentCommand(); } catch {}
    if (!exe) { comment(p.slug, c.id, who, `- Review skipped: ${LABEL[rev]} is not installed.`); return { skipped: 'not installed', reviewer: rev }; }
    const prompt = PROMPT(p, c, who);
    const args = rev === 'codex' ? E.ENGINES.codex.args({ prompt: E.preambleFor('codex') + prompt, model: '' }) : claudeArgs(prompt);
    P.startWorker(key, exe, args, { cwd: p.path && fs.existsSync(p.path) ? p.path : process.cwd(), engine: rev, branch: 'review of ' + c.id, env: { AIGILE_ROLE: 'review', AIGILE_AS: who } });
    say(p.slug, `${c.id} handed over: ${LABEL[rev]} reviews it`);
    return { started: true, reviewer: rev };
  } catch (e) { return { skipped: e.message }; }
}

module.exports = { isOn, engineOf, reviewerOf, onHandover, PROMPT };
