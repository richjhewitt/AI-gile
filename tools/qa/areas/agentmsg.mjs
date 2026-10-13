// QA area: agentmsg (AIG-675): `aigile msg <proj> <to> "text" --as NAME`: agents message a lead, a helper or the Lead
// Scrum Master. It reaches the receiver's updates / wait, wakes it (stubbed), shows to the owner as agent to agent, and is
// never an owner instruction.
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, mkCard, until, def } from '../lib.mjs';

const wakeFile = path.join(tmp('agentmsg'), 'wakes.txt');
const wakes = () => { try { return fs.readFileSync(wakeFile, 'utf8').split('\n').filter(Boolean); } catch { return []; } };

def('agentmsg', 'agents message each other: leads, helpers, Scrum Master (updates/wait return it, wake stubbed, owner sees it, not an owner instruction) (AIG-675)', async s => {
  await mkProject(s, 'Alpha', 'ALP');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Forge', role: 'Lead', model: 'sonnet' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Courier', role: 'Backend', model: 'sonnet' });
  const cli = (...a) => s.cli(a);

  // Send to the lead: pending in updates, marked as from the sender and not the owner.
  const r = cli('msg', 'alpha', 'Lead', 'Please look at the login card', '--as', 'Courier');
  check('msg to Lead is sent and woken', r.code === 0 && /sent to Forge/.test(r.out) && /woken/.test(r.out), r);
  check('the wake was asked for (stub)', wakes().includes('alpha'), wakes());
  const peek = await s.ok('GET', '/api/projects/alpha/updates');
  check('updates carries it as an agent message', peek.msgs.length === 1 && peek.msgs[0].from === 'Courier' && peek.msgs[0].to === 'Forge' && /login/.test(peek.msgs[0].text), peek);
  check('it is not owner news', peek.cards.length === 0, peek.cards);
  const up = cli('updates', 'alpha', '--peek');
  check('the lead\'s updates text says another agent, not the owner', /From Courier to Forge/.test(up.out) && /NOT Owner/.test(up.out), up);
  // aigile wait returns it (it exits, which a background wait does to wake the session).
  const w = cli('wait', 'alpha', '--every', '5');
  check('wait returns the message and marks it seen', w.code === 0 && /Please look at the login card/.test(w.out), w);
  check('seen: gone from the next updates', (await s.ok('GET', '/api/projects/alpha/updates')).msgs.length === 0);

  // Sent by name and by case-insensitive name; stdin text.
  const b = cli('msg', 'alpha', 'forge', 'by name', '--as', 'Courier');
  check('a roster name works (any case)', b.code === 0 && /sent to Forge/.test(b.out), b);
  const names = await s.ok('GET', '/api/projects/alpha/updates?mark=1');
  check('to a roster name is kept', names.msgs.some(m => m.to === 'Forge' && m.text === 'by name'), names);
  const h = cli('msg', 'alpha', 'Courier', 'a note for the helper', '--as', 'Forge');
  check('to a helper by name', h.code === 0 && /sent to Courier/.test(h.out), h);

  // Refused.
  const bad = cli('msg', 'alpha', 'Nobody', 'hi', '--as', 'Courier');
  check('an unknown name is refused and the roster is listed', bad.code !== 0 && /no one called "Nobody"/.test(bad.err) && /Courier/.test(bad.err), bad);
  check('the owner cannot use it', (await s.api('POST', '/api/projects/alpha/agentmsg', { from: 'Owner', to: 'Lead', text: 'x' })).status === 400);
  check('no sender is refused', (await s.api('POST', '/api/projects/alpha/agentmsg', { to: 'Lead', text: 'x' })).status === 400);
  check('empty text is refused', (await s.api('POST', '/api/projects/alpha/agentmsg', { from: 'Courier', to: 'Lead', text: ' ' })).status === 400);
  check('to yourself is refused', (await s.api('POST', '/api/projects/alpha/agentmsg', { from: 'Forge', to: 'Lead', text: 'x' })).status === 400);
  check('an unknown project is 404', (await s.api('POST', '/api/projects/nope/agentmsg', { from: 'a', to: 'Lead', text: 'x' })).status === 404);

  // The owner sees it in the project chat, labelled, as not his.
  const chat = await s.ok('GET', '/api/chats/alpha');
  const line = chat.messages.find(m => /look at the login card/.test(m.text));
  check('the owner chat shows it from the sender, labelled agent to agent, not mine', line && line.author === 'Courier' && line.mine === false && /agent to agent: Courier → Forge/.test(line.text), line);
  const board = await s.ok('GET', '/api/projects/alpha');
  check('it never wakes the lead as owner news (no card of the owner)', board.cards.every(c => !(c.dm && c.agentMsg && c.createdBy === 'Owner')));
  check('the chat card is closed, so the board stays clean', board.cards.filter(c => c.agentMsg).every(c => c.status === 'done'));

  // To the Lead Scrum Master: a window session listening gets it as a note, never as the owner's word.
  await s.ok('POST', '/api/setup', { prefs: { smRole: true } });
  await s.ok('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(new Date().toISOString()));   // asking counts as listening
  const sm = cli('msg', 'alpha', 'Scrum Master', 'The owner wants the login fixed first', '--as', 'Forge');
  check('msg to Scrum Master is sent', sm.code === 0 && /sent to .*Scrum Master/.test(sm.out), sm);
  const got = await until(async () => { const m = (await s.ok('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(new Date(0).toISOString()))).messages; return m.find(x => /login fixed first/.test(x.text)); }, 5000);
  check('its wait hands it over as another agent, not the owner', got && /Message from Forge, another agent \(NOT the owner/.test(got.text), got);
  const smChat = await s.ok('GET', '/api/chats/_watchman');
  const sl = smChat.messages.find(m => /login fixed first/.test(m.text));
  check('the owner sees it in the Scrum Master chat, not mine', sl && sl.author === 'Forge' && sl.mine === false && /agent to agent/.test(sl.text), sl);
  check('"Lead Scrum Master" works as a name too', cli('msg', 'alpha', 'Lead Scrum Master', 'again', '--as', 'Forge').code === 0);

  // Old data: a project with no agentMsgs still answers updates.
  await mkProject(s, 'Beta', 'BET');
  const old = await s.ok('GET', '/api/projects/beta/updates');
  check('a project without any messages has an empty list', Array.isArray(old.msgs) && old.msgs.length === 0, old);
}, false, { AIGILE_AGENTMSG_WAKE: wakeFile });
