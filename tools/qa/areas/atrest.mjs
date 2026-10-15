// QA area: atrest (AIG-1166): DM and group chat files are sealed on disk (AES-256-GCM), read back, old plaintext is upgraded
// (on the next write and by the start-up migration, safe twice), export gives plain JSON, and a missing key refuses with no plaintext.
import fs from 'node:fs';
import path from 'node:path';
import { freePort, startRelay, startServer, until, check, mkProject, def, readChat, readSealedBytes } from '../lib.mjs';

const PREFIX = 'aigile-atrest-v1:', BPREFIX = 'aigile-atrest-b1:';
const disk = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

def('atrest', '🔒 chats at rest: DM, group and lead chat files (Scrum Master and assistant too) and DM attachments sealed on disk (AIG-1170), read back, old plaintext upgraded (next write and start-up, twice is safe), export, no key refuses with no plaintext (AIG-1166)', async s => {
  const relay = await startRelay({ RELAY_RATE: '100000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  let b2, b3;
  try {
    await s.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await s.ok('POST', '/api/dms/invites', { name: 'Davy' });
    const ca = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Rich' });
    const cb = await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0]);
    const secret = 'pineapple at rest 77';
    await s.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: secret });
    const got = await until(async () => (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).find(m => m.dir === 'in'));
    const fa = path.join(s.data, 'dms', cb.id + '.json'), fb = path.join(b.data, 'dms', ca.id + '.json');
    check('the sender\'s chat file is sealed, no plaintext on disk', disk(fa).startsWith(PREFIX) && !disk(fa).includes('pineapple'), disk(fa).slice(0, 60));
    check('the receiver\'s chat file is sealed, no plaintext on disk', disk(fb).startsWith(PREFIX) && !disk(fb).includes('pineapple'));
    check('and it reads back on both boards', got && got.text === secret && (await s.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).some(m => m.text === secret));
    check('the key is not in the data in plain hex', !Object.values(JSON.parse(disk(path.join(s.data, 'secrets', 'kept.json')) || '{}')).some(v => /^[0-9a-f]{64}$/.test(String(v))));

    // Old plaintext chat: read as it is, sealed on the next write with both messages kept.
    const old = JSON.parse(JSON.stringify(await s.ok('GET', `/api/dms/contacts/${cb.id}/messages`)));
    old.unshift({ id: 'oldplain1', dir: 'in', text: 'old plain banana', at: '2026-01-01T00:00:00.000Z', verified: true });
    fs.writeFileSync(fa, JSON.stringify(old, null, 2));
    check('an old plaintext chat still reads', (await s.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).some(m => m.text === 'old plain banana'));
    await s.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'after the upgrade' });
    const up = await s.ok('GET', `/api/dms/contacts/${cb.id}/messages`);
    check('the next write seals it, old and new kept', disk(fa).startsWith(PREFIX) && !disk(fa).includes('banana') && up.some(m => m.text === 'old plain banana') && up.some(m => m.text === 'after the upgrade'));

    // Export: plain JSON for the owner.
    const ex = await s.ok('GET', `/api/dms/contacts/${cb.id}/export`);
    check('DM export gives the whole chat decrypted, without envelopes', ex.contact.id === cb.id && ex.messages.some(m => m.text === secret) && ex.messages.some(m => m.text === 'old plain banana') && !ex.messages.some(m => 'raw' in m));

    // Group chats: a plaintext group file, sealed on the next write; export.
    await mkProject(s, 'Pix', 'PIX');
    const gfile = path.join(s.data, 'groups', 'old-1234.chat');
    fs.mkdirSync(path.dirname(gfile), { recursive: true });
    fs.writeFileSync(gfile, JSON.stringify({ id: 'old-1234', name: 'Old', members: [{ project: 'pix', name: 'Pixel' }, { project: 'pix', name: 'Pola' }], created: '2026-01-01T00:00:00.000Z', msgs: [{ at: '2026-01-01T00:00:00.000Z', author: 'Owner', text: 'group mango', mine: true }] }));
    check('an old plaintext group reads', (await s.ok('GET', '/api/chats/_groups/old-1234')).messages.some(m => m.text === 'group mango'));
    await s.ok('POST', '/api/chats/_groups/old-1234/say', { as: 'Pixel', text: 'group kiwi' });
    check('a group write seals the file', disk(gfile).startsWith(PREFIX) && !/mango|kiwi/.test(disk(gfile)));
    const gx = await s.ok('GET', '/api/chats/_groups/old-1234/export');
    check('group export gives the messages decrypted', gx.messages.map(m => m.text).join(',') === 'group mango,group kiwi', gx.messages);

    // AIG-1170: lead chats (data/<slug>.chat), the assistant's chat, the Lead Scrum Master's chat and DM attachments.
    await s.ok('POST', '/api/projects/pix/team', { name: 'Lead', role: 'Lead' });
    await s.ok('POST', '/api/projects/pix/leadchat', { author: 'Lead', text: 'lead papaya' });
    const lf = path.join(s.data, 'pix.chat');
    check('a lead chat file is sealed, no plaintext on disk', disk(lf).startsWith(PREFIX) && !disk(lf).includes('papaya'), disk(lf).slice(0, 60));
    check('and it reads back', (await s.ok('GET', '/api/projects/pix/leadchat')).messages.some(m => m.text === 'lead papaya'));
    const lj = readChat(s, lf); lj.msgs.unshift({ at: '2026-01-01T00:00:00.000Z', author: 'Lead', text: 'old lead lychee', mine: false });
    fs.writeFileSync(lf, JSON.stringify(lj));
    check('an old plaintext lead chat still reads', (await s.ok('GET', '/api/projects/pix/leadchat')).messages.some(m => m.text === 'old lead lychee'));
    await s.ok('POST', '/api/projects/pix/leadchat', { author: 'Lead', text: 'lead after upgrade' });
    const lm = (await s.ok('GET', '/api/projects/pix/leadchat')).messages;
    check('the next lead chat write seals it, old and new kept', disk(lf).startsWith(PREFIX) && !/lychee|papaya/.test(disk(lf)) && lm.some(m => m.text === 'old lead lychee') && lm.some(m => m.text === 'lead after upgrade'));
    check('the chats list still shows it', (await s.ok('GET', '/api/chats')).find(c => c.slug === 'pix').lastText === 'lead after upgrade');
    await s.ok('POST', '/api/chats/_assistant', { text: 'help' });
    const af = path.join(s.data, '_assistant.chat');
    check('the assistant chat file is sealed', disk(af).startsWith(PREFIX) && (await s.ok('GET', '/api/chats/_assistant')).messages.some(m => m.text === 'help'));
    await s.ok('POST', '/api/chats/_watchman/say', { text: 'scrum melon' });
    const wf = path.join(s.data, 'watchman.last');
    check('the Lead Scrum Master chat file is sealed', disk(wf).startsWith(PREFIX) && !disk(wf).includes('melon') && (await s.ok('GET', '/api/chats/_watchman')).messages.some(m => m.text === 'scrum melon'), disk(wf).slice(0, 60));

    // DM attachments: sealed on both boards, served opened with their content type.
    await s.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'file here', attachments: [{ name: 'note.txt', type: 'text/plain', data: Buffer.from('attachment guava').toString('base64') }] });
    const fin = await until(async () => (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).find(m => m.attachments));
    const fout = (await s.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).find(m => m.attachments);
    const pa = path.join(s.data, 'dms', 'files', cb.id, fout.attachments[0].id), pb = path.join(b.data, 'dms', 'files', ca.id, fin.attachments[0].id);
    check('the attachment is sealed on disk on both boards', disk(pa).startsWith(BPREFIX) && disk(pb).startsWith(BPREFIX) && !disk(pa).includes('guava') && !disk(pb).includes('guava'), disk(pb).slice(0, 40));
    const fr = await fetch(`${b.base}/api/dms/contacts/${ca.id}/files/${encodeURIComponent(fin.attachments[0].id)}`);
    check('it is served opened, with its content type', fr.status === 200 && (await fr.text()) === 'attachment guava' && /^text\/plain/.test(fr.headers.get('content-type') || ''), fr.status);
    check('and the sender reads their own copy', (await (await fetch(`${s.base}/api/dms/contacts/${cb.id}/files/${encodeURIComponent(fout.attachments[0].id)}`)).text()) === 'attachment guava');
    check('another contact id is still refused', (await fetch(`${b.base}/api/dms/contacts/000000000000/files/${encodeURIComponent(fin.attachments[0].id)}`)).status >= 400);
    const op = path.join(s.data, 'dms', 'files', cb.id, 'oldplain0-old.txt'); fs.writeFileSync(op, 'old plain fig');
    check('an old plaintext attachment is still served', (await (await fetch(`${s.base}/api/dms/contacts/${cb.id}/files/oldplain0-old.txt`)).text()) === 'old plain fig');

    // Start-up migration on B's data: plant plaintext DM and group files, start a board on that data, twice.
    b.stop();
    const plainDm = JSON.parse(JSON.stringify(got)); plainDm.text = 'migrate me cherry';
    fs.writeFileSync(fb, JSON.stringify([plainDm]));
    const bg = path.join(b.data, 'groups', 'mig-0001.chat');
    fs.mkdirSync(path.dirname(bg), { recursive: true });
    fs.writeFileSync(bg, JSON.stringify({ id: 'mig-0001', name: 'Mig', members: [{ project: 'x', name: 'A' }, { project: 'x', name: 'B' }], created: '2026-01-01T00:00:00.000Z', msgs: [{ at: '2026-01-01T00:00:00.000Z', author: 'Owner', text: 'migrate group plum', mine: true }] }));

    fs.writeFileSync(path.join(b.data, 'mig.chat'), JSON.stringify({ msgs: [{ at: '2026-01-01T00:00:00.000Z', author: 'Lead', text: 'migrate lead pear' }], readAt: '' }));
    fs.writeFileSync(path.join(b.data, 'watchman.last'), JSON.stringify({ msgs: [{ at: '2026-01-01T00:00:00.000Z', author: 'SM', text: 'migrate scrum date' }], readAt: '' }));
    const bfile = path.join(b.data, 'dms', 'files', ca.id, 'migfile0-m.txt'); fs.mkdirSync(path.dirname(bfile), { recursive: true }); fs.writeFileSync(bfile, 'migrate file quince');
    const plantB = () => [path.join(b.data, 'mig.chat'), path.join(b.data, 'watchman.last'), bfile];
    const env = { AIGILE_DATA: b.data, AIGILE_DM_POLL_MS: '300' };
    b2 = await startServer(env, await freePort());
    check('start-up seals old plaintext DM and group files', disk(fb).startsWith(PREFIX) && disk(bg).startsWith(PREFIX) && !/cherry|plum/.test(disk(fb) + disk(bg)));
    check('start-up seals old lead chat, Scrum Master chat and attachment files (AIG-1170)', disk(plantB()[0]).startsWith(PREFIX) && disk(plantB()[1]).startsWith(PREFIX) && disk(bfile).startsWith(BPREFIX) && !/pear|date|quince/.test(plantB().map(disk).join('')));
    check('and the migrated lead chat and attachment open with the key', readChat(b, plantB()[0]).msgs[0].text === 'migrate lead pear' && readSealedBytes(b, bfile).toString() === 'migrate file quince');
    const once = disk(fb) + disk(bg) + plantB().map(disk).join('');
    b2.stop();
    b3 = await startServer(env, await freePort());
    check('a second start leaves sealed files alone (safe twice)', disk(fb) + disk(bg) + plantB().map(disk).join('') === once);
    check('and they read back after the migration', (await b3.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.text === 'migrate me cherry') && (await b3.ok('GET', '/api/chats/_groups/mig-0001')).messages.some(m => m.text === 'migrate group plum'));
    check('the migrated Scrum Master chat and attachment read back through the board', (await b3.ok('GET', '/api/chats/_watchman')).messages.some(m => m.text === 'migrate scrum date') && (await (await fetch(`${b3.base}/api/dms/contacts/${ca.id}/files/migfile0-m.txt`)).text()) === 'migrate file quince');
    b3.stop();

    // Key missing (data/secrets/kept.json lost): reads and writes refuse in plain English, nothing written in plaintext.
    const kf = path.join(b.data, 'secrets', 'kept.json'), kept = JSON.parse(disk(kf));
    delete kept['chats.atrest']; fs.writeFileSync(kf, JSON.stringify(kept));
    b3 = await startServer(env, await freePort());
    const r = await b3.api('GET', `/api/dms/contacts/${ca.id}/messages`);
    check('no key: reading a sealed chat is refused with a plain message', r.status === 500 && /key that opens them is missing/.test(r.body.error || ''), r);
    const w = await b3.api('POST', '/api/chats/_groups/mig-0001/say', { as: 'A', text: 'should not land' });
    check('no key: writing is refused, not saved in plaintext', w.status === 500 && /ever saved unencrypted/.test(w.body.error || '') && disk(bg).startsWith(PREFIX) && !disk(bg).includes('should not land'), w);
    const fa2 = await b3.api('GET', `/api/dms/contacts/${ca.id}/files/migfile0-m.txt`);
    check('no key: an attachment is refused with the plain message (AIG-1170)', fa2.status === 500 && /key that opens them is missing/.test(fa2.body.error || ''), fa2);
    const wm = await b3.api('GET', '/api/chats/_watchman');
    check('no key: the Scrum Master chat is refused with the plain message', wm.status === 500 && /key that opens them is missing/.test(wm.body.error || ''), wm);
    const ws = await b3.api('POST', '/api/chats/_watchman/say', { text: 'should not land either' });
    check('no key: a Scrum Master chat write is refused, nothing plain on disk', ws.status === 500 && disk(plantB()[1]).startsWith(PREFIX) && !disk(plantB()[1]).includes('should not land'), ws);
    check('no key: the chats list still answers', (await b3.api('GET', '/api/chats')).status === 200);
    check('no key: no new key was made over the old chats', !('chats.atrest' in JSON.parse(disk(kf))));
  } finally { b.stop(); if (b2) b2.stop(); if (b3) b3.stop(); relay.stop(); }
}, false, { AIGILE_DM_POLL_MS: '300' });
