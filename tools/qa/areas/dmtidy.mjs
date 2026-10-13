// QA area: dmtidy (AIG-873): done 💬 DM cards move into the Lead chat (time order, merged with the thread), are backed up to
// data/<slug>.dm-archive.json, leave the board and stats; open DM cards stay; dry run changes nothing; a second run changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, mkCard, say, def } from '../lib.mjs';

def('dmtidy', '💬 DM tidy: done DM cards move into the Lead chat in time order, archived, off the board and stats; dry run; idempotent (AIG-873)', async (s) => {
  await mkProject(s, 'Tidy', 'TDY');
  await s.ok('POST', '/api/projects/tidy/team', { name: 'Lead', role: 'Lead' });
  const a = await mkCard(s, 'tidy', '💬 first talk', { status: 'team', quick: true, createdBy: 'Owner', description: 'Hi lead, first' });
  const b = await mkCard(s, 'tidy', 'DM two', { status: 'team', dm: true, createdBy: 'Lead', description: 'Lead opens' });
  const open = await mkCard(s, 'tidy', '💬 still open', { status: 'team', quick: true, createdBy: 'Owner', description: 'open one' });
  const plain = await mkCard(s, 'tidy', 'Normal done work', { status: 'todo' });
  await say(s, 'tidy', a.id, 'Lead', 'answer to first'); await say(s, 'tidy', b.id, 'Owner', 'owner replies');
  await s.ok('POST', '/api/projects/tidy/leadchat', { author: 'Owner', text: 'thread message' });
  // fix the times so the merge order is known: a(1) b(2) thread(3) a-answer(4) b-reply(5)
  const file = path.join(s.data, 'tidy.json'), p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = n => `2026-01-0${n}T10:00:00.000Z`;
  for (const c of p.cards) {
    if (c.id === a.id) { c.created = t(1); c.comments[0].at = t(4); c.status = 'done'; }
    if (c.id === b.id) { c.dm = true; c.created = t(2); c.comments[0].at = t(5); c.status = 'done'; }
    if (c.id === plain.id) c.status = 'done';
  }
  fs.writeFileSync(file, JSON.stringify(p));
  const cf = path.join(s.data, 'tidy.chat'), ch = JSON.parse(fs.readFileSync(cf, 'utf8')); ch.msgs[0].at = t(3); fs.writeFileSync(cf, JSON.stringify(ch));
  const before = fs.readFileSync(cf, 'utf8');

  const af = path.join(s.data, 'tidy.dm-archive.json');
  fs.writeFileSync(af, '[ broken');
  const ab = await s.api('POST', '/api/projects/tidy/dms/tidy', {});
  check('a corrupt archive stops the tidy: nothing moved, archive untouched', ab.status >= 400 && fs.readFileSync(af, 'utf8') === '[ broken' && (await s.ok('GET', '/api/projects/tidy')).cards.length === 4 && fs.readFileSync(cf, 'utf8') === before, ab);
  fs.unlinkSync(af);
  const dry = await s.ok('POST', '/api/projects/tidy/dms/tidy', { dryRun: true });
  check('dry run lists the two done DM cards, 4 messages', dry.dryRun && dry.cards === 2 && dry.messages === 4 && dry.moved.map(m => m.id).sort().join() === [a.id, b.id].sort().join(), dry);
  check('dry run changed nothing', (await s.ok('GET', '/api/projects/tidy')).cards.length === 4 && fs.readFileSync(cf, 'utf8') === before && !fs.existsSync(path.join(s.data, 'tidy.dm-archive.json')));
  const cli = s.cli(['dms', 'tidy', 'tidy', '--dry-run']);
  check('CLI dry run prints what would move', cli.code === 0 && /Would move 2/.test(cli.out) && cli.out.includes(a.id), cli.out);

  const r = await s.ok('POST', '/api/projects/tidy/dms/tidy', {});
  check('tidy moved 2 cards', !r.dryRun && r.cards === 2 && r.messages === 4, r);
  const msgs = (await s.ok('GET', '/api/projects/tidy/leadchat')).messages;
  check('thread has the messages in time order', msgs.map(m => m.text).join('|') === 'Hi lead, first|Lead opens|thread message|answer to first|owner replies', msgs.map(m => m.text));
  check('authors kept (description by createdBy, comments by their author)', msgs[1].author === 'Lead' && msgs[3].author === 'Lead' && msgs[4].author === 'Owner' && msgs[0].mine === true, msgs);
  const left = (await s.ok('GET', '/api/projects/tidy')).cards.map(c => c.id).sort();
  check('moved cards left the board; open DM and plain done card stay', left.join() === [open.id, plain.id].sort().join(), left);
  const arch = JSON.parse(fs.readFileSync(path.join(s.data, 'tidy.dm-archive.json'), 'utf8'));
  check('archive holds both full cards', arch.length === 2 && arch.every(x => x.card && x.card.comments.length === 1 && x.movedAt), arch.map(x => x.card && x.card.id));
  check('the archive file is not listed as a project', !(await s.ok('GET', '/api/projects')).some(x => /archive/.test(x.slug || x.name || '')));
  const st = await s.ok('GET', '/api/projects/tidy/stats');
  check('stats no longer count them (1 done of 2 cards left)', st.done === 1 && st.made === 2, [st.done, st.made]);
  const show = s.cli(['show', 'tidy', a.id]);
  check('aigile show on a moved id says it moved to the Lead chat', show.code === 0 && /moved to the Lead chat/.test(show.out) && /dm-archive/.test(show.out), show);
  const nf = s.cli(['show', 'tidy', 'TDY-999']);
  check('a card that never existed still says not found', nf.code !== 0, nf);

  const archText = fs.readFileSync(path.join(s.data, 'tidy.dm-archive.json'), 'utf8'), chatText = fs.readFileSync(cf, 'utf8');
  const r2 = await s.ok('POST', '/api/projects/tidy/dms/tidy', {});
  check('second run moves nothing and changes no file', r2.cards === 0 && fs.readFileSync(cf, 'utf8') === chatText && fs.readFileSync(path.join(s.data, 'tidy.dm-archive.json'), 'utf8') === archText && (await s.ok('GET', '/api/projects/tidy')).cards.length === 2, r2);

  // a later done DM card appends to the archive, never overwrites it
  const c2 = await mkCard(s, 'tidy', '💬 later', { status: 'team', quick: true, createdBy: 'Owner', description: 'later one' });
  const p3 = JSON.parse(fs.readFileSync(file, 'utf8')); p3.cards.find(c => c.id === c2.id).status = 'done'; fs.writeFileSync(file, JSON.stringify(p3));
  await s.ok('POST', '/api/projects/tidy/dms/tidy', {});
  check('archive appended (3 cards), thread has 6', JSON.parse(fs.readFileSync(path.join(s.data, 'tidy.dm-archive.json'), 'utf8')).length === 3 && (await s.ok('GET', '/api/projects/tidy/leadchat')).messages.length === 6);
  const nope = await s.api('POST', '/api/projects/nonesuch/dms/tidy', {});
  check('unknown project is a 404', nope.status === 404, nope.status);
});
