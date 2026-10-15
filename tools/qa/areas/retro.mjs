// QA area: retro (AIG-865): agents suggest a change to WAYS-OF-WORKING, the owner approves on a card. Uses a temp copy of the file
// (AIGILE_WOW), never the real one: route + CLI make one 🚦 card, Go adds the bullet under its section (or under ## Retros), Not yet
// changes nothing, the "Run a retro" line after a sprint go/no-go and a closed incident, old cards untouched.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, mkCard, getCard, tmp, def } from '../lib.mjs';

const DIR = tmp('retro'), WOW = path.join(DIR, 'WAYS-OF-WORKING.md');
const START = '# Ways of working\r\n\r\n## Git\r\n\r\n- Commit small.\r\n- Never force-push.\r\n\r\n## Testing\r\n\r\n- Run the suite.\r\n';
fs.writeFileSync(WOW, START);
const read = () => fs.readFileSync(WOW, 'utf8');

def('retro', '🔁 retros: route + CLI make one Go / Not yet card, Go adds the line under its section (else ## Retros) with the card id and date, Not yet changes nothing, Run a retro line (AIG-865)', async s => {
  await mkProject(s, 'Retro', 'RET');
  const old = await mkCard(s, 'retro', 'An old card', { status: 'todo' });
  check('an unknown project is a 404', (await s.api('POST', '/api/projects/nope/retros', { text: 'x', why: 'y' })).status === 404);
  check('a retro needs the change', (await s.api('POST', '/api/projects/retro/retros', { why: 'y' })).status === 400);
  check('a retro needs why', (await s.api('POST', '/api/projects/retro/retros', { text: 'x' })).status === 400);
  check('a bad card id is refused', (await s.api('POST', '/api/projects/retro/retros', { text: 'x', why: 'y', card: 'nonsense' })).status === 400);

  // CLI
  const r = s.cli(['retro', 'retro', 'Run the full suite before every push', '--why', 'a red push broke live', '--section', 'git', '--card', old.id, '--as', 'Lead']);
  check('the CLI makes a retro card', r.code === 0 && /waiting for/.test(r.out), r);
  const cards = (await s.ok('GET', '/api/projects/retro')).cards.filter(c => c.retro);
  check('one card per suggestion', cards.length === 1, cards);
  const c = cards[0];
  check('titled, a task, kind plan, waiting on the owner', /^🔁 Retro: Run the full suite/.test(c.title) && c.type === 'task' && c.kind === 'plan' && c.needsYou === true, c);
  check('the description holds the suggestion, why and section', /Run the full suite before every push/.test(c.description) && /a red push broke live/.test(c.description) && /git/.test(c.description) && c.description.includes(old.id), c.description);
  const ask = c.comments.find(m => m.mark === 'ask');
  check('it is asked as a plan: a Go? ask', !!ask && /\bgo\s*\?/i.test(ask.text) && ask.author === 'Lead', ask);
  check('the file is untouched so far', read() === START);

  const team = (method, url, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'cli', 'x-aigile-as': 'Dev' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));   // a team call: not the owner (AIG-840)
  const tg = await team('POST', `/api/projects/retro/cards/${c.id}/comments`, { author: 'Owner', text: 'GO' });
  check('a team request cannot decide a retro, even writing as the owner (403)', tg.status === 403 && read() === START && !(await getCard(s, 'retro', c.id)).retro.done, tg);

  // Go: under its section, same line endings
  await s.ok('POST', `/api/projects/retro/cards/${c.id}/comments`, { author: 'Owner', text: 'GO' });
  const after = read();
  const bullet = `- Run the full suite before every push (retro ${c.id}, ${new Date().toISOString().slice(0, 10)})`;
  check('Go adds the bullet under the Git section, after its last line', after.includes('- Never force-push.\r\n' + bullet + '\r\n\r\n## Testing'), after);
  check('the rest of the file is as it was and the line endings stay', after.replace(bullet + '\r\n', '') === START && !/[^\r]\n/.test(after));
  const done = await getCard(s, 'retro', c.id);
  check('the card is done, not waiting, with a comment of what was added', done.status === 'done' && !done.needsYou && done.comments.at(-1).text.includes(bullet) && /Git/i.test(done.comments.at(-1).text), done);
  await s.ok('POST', `/api/projects/retro/cards/${c.id}/comments`, { author: 'Owner', text: 'go' });
  check('answering again adds nothing', read() === after);

  // section not found: end of file under ## Retros
  const r2 = await s.ok('POST', '/api/projects/retro/retros', { text: 'Name the branch after the card', why: 'lost track', section: 'Naming', author: 'Lead' });
  await s.ok('POST', `/api/projects/retro/cards/${r2.id}/comments`, { author: 'Owner', text: 'Yes' });
  const end = read();
  check('an unknown section goes under ## Retros at the end', end.endsWith('- Run the suite.\r\n\r\n## Retros\r\n\r\n- Name the branch after the card (retro ' + r2.id + ', ' + new Date().toISOString().slice(0, 10) + ')\r\n'), end);
  const note = (await getCard(s, 'retro', r2.id)).comments.at(-1).text;
  check('the comment says it went to the end', /Retros/.test(note) && /Naming/.test(note) && note.includes('Name the branch'), note);
  // a second one with no section lands under the same ## Retros
  const r3 = await s.ok('POST', '/api/projects/retro/retros', { text: 'Ask before pushing', why: 'surprise', author: 'Lead' });
  await s.ok('POST', `/api/projects/retro/cards/${r3.id}/comments`, { author: 'Owner', text: 'GO' });
  const end3 = read();
  check('no section: under ## Retros, one heading only', end3.split('## Retros').length === 2 && end3.indexOf('Ask before pushing') > end3.indexOf('Name the branch'), end3);

  // Not yet: closes, nothing changes
  const r4 = await s.ok('POST', '/api/projects/retro/retros', { text: 'Never test on Fridays', why: 'tired', section: 'Testing', author: 'Lead' });
  await s.ok('POST', `/api/projects/retro/cards/${r4.id}/comments`, { author: 'Owner', text: 'Not yet: too strict' });
  const no = await getCard(s, 'retro', r4.id);
  check('Not yet closes the card and changes nothing', no.status === 'done' && !no.needsYou && read() === end3, no);
  // another comment is left alone
  const r5 = await s.ok('POST', '/api/projects/retro/retros', { text: 'Pair on risky cards', why: 'bugs', author: 'Lead' });
  await s.ok('POST', `/api/projects/retro/cards/${r5.id}/comments`, { author: 'Owner', text: 'What do you mean by risky?' });
  const open = await getCard(s, 'retro', r5.id);
  check('a question back is a normal comment: nothing added, card not closed', read() === end3 && open.status !== 'done', open);

  // Old cards keep working
  const oc = await getCard(s, 'retro', old.id);
  check('an old card is untouched', oc.retro === undefined && oc.status === 'todo');

  // The prompt line
  check('no retro line before anything happened', !/Run a retro/.test(s.cli(['brief', 'retro']).out));
  const sp = await mkCard(s, 'retro', 'Sprint 5 go / no-go', { status: 'todo' });
  s.cli(['ask', 'retro', sp.id, 'Sprint 5 is ready to ship. Go?', '--as', 'Lead']);
  await s.ok('POST', `/api/projects/retro/cards/${sp.id}/comments`, { author: 'Owner', text: 'GO' });
  const b1 = s.cli(['brief', 'retro']).out;
  check('the brief tells the lead to run a retro after the sprint go/no-go', /Run a retro: aigile retro retro "suggested change to WAYS-OF-WORKING" --why/.test(b1) && b1.split('Run a retro').length === 2, b1);
  const u = s.cli(['updates', 'retro', '--peek']).out;
  check('updates says it too', /Run a retro: aigile retro/.test(u), u);
  const f = await s.ok('POST', '/api/projects/retro/retros', { text: 'Retro after every sprint', why: 'we forgot', author: 'Lead' });
  check('filing a retro clears the line', !/Run a retro/.test(s.cli(['brief', 'retro']).out) && !!f.id);
  const inc = await mkCard(s, 'retro', 'Live is down', { type: 'incident', status: 'team' });
  await s.ok('PATCH', `/api/projects/retro/cards/${inc.id}`, { status: 'done', postmortem: { happened: 'down', why: 'deploy', change: 'smoke test' } });
  check('a closed incident brings the line back', /Run a retro: aigile retro/.test(s.cli(['brief', 'retro']).out));
  check('it is only a line: no card made by itself', (await s.ok('GET', '/api/projects/retro')).cards.filter(x => x.retro).length === 6);
}, false, { AIGILE_WOW: WOW });
