// QA area: atrest (AIG-1166): DM and group chat files are sealed on disk (AES-256-GCM), read back, old plaintext is upgraded
// (on the next write and by the start-up migration, safe twice), export gives plain JSON, and a missing key refuses with no plaintext.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { freePort, startRelay, startServer, until, check, mkProject, def, tmp, ROOT } from '../lib.mjs';

const PREFIX = 'aigile-atrest-v1:';
const disk = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

def('atrest', '🔒 chats at rest: DM and group chat files sealed on disk, read back, old plaintext upgraded (next write and start-up, twice is safe), export, no key refuses with no plaintext (AIG-1166)', async s => {
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
    // AIG-1172: a chat write that fails on B (here its temp file is a folder, so the write errors like a full or locked disk):
    // the envelope is not acked, so nothing is lost; once the disk is fine it comes again and is saved.
    const block = fb + '.tmp';
    fs.mkdirSync(block, { recursive: true });
    await s.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'saved after all 31' });
    const failedPoll = await until(async () => { const st = await b.ok('GET', '/api/dms'); return st.lastPoll && st.lastPoll.ok === false && st.lastPoll; });
    check('a failing chat write makes the poll report an error', !!failedPoll, failedPoll);
    check('and the message is not in the chat yet', !(await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.text === 'saved after all 31'));
    fs.rmSync(block, { recursive: true, force: true });
    const again = await until(async () => (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).find(m => m.text === 'saved after all 31'));
    check('the envelope was left on the relay: once writes work it comes again and is saved', !!again && again.verified === true);

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

    // Start-up migration on B's data: plant plaintext DM and group files, start a board on that data, twice.
    b.stop();
    const plainDm = JSON.parse(JSON.stringify(got)); plainDm.text = 'migrate me cherry';
    fs.writeFileSync(fb, JSON.stringify([plainDm]));
    const bg = path.join(b.data, 'groups', 'mig-0001.chat');
    fs.mkdirSync(path.dirname(bg), { recursive: true });
    fs.writeFileSync(bg, JSON.stringify({ id: 'mig-0001', name: 'Mig', members: [{ project: 'x', name: 'A' }, { project: 'x', name: 'B' }], created: '2026-01-01T00:00:00.000Z', msgs: [{ at: '2026-01-01T00:00:00.000Z', author: 'Owner', text: 'migrate group plum', mine: true }] }));
    const env = { AIGILE_DATA: b.data, AIGILE_DM_POLL_MS: '300' };
    b2 = await startServer(env, await freePort());
    check('start-up seals old plaintext DM and group files', disk(fb).startsWith(PREFIX) && disk(bg).startsWith(PREFIX) && !/cherry|plum/.test(disk(fb) + disk(bg)));
    const once = disk(fb) + disk(bg);
    b2.stop();
    b3 = await startServer(env, await freePort());
    check('a second start leaves sealed files alone (safe twice)', disk(fb) + disk(bg) === once);
    check('and they read back after the migration', (await b3.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.text === 'migrate me cherry') && (await b3.ok('GET', '/api/chats/_groups/mig-0001')).messages.some(m => m.text === 'migrate group plum'));
    b3.stop();

    // Key missing (data/secrets/kept.json lost): reads and writes refuse in plain English, nothing written in plaintext.
    const kf = path.join(b.data, 'secrets', 'kept.json'), good = disk(kf), kept = JSON.parse(good);

    // AIG-1172: kept.json damaged (a crash mid-write) or gone, with a good kept.json.bak: chats still open from the backup.
    fs.writeFileSync(kf + '.bak', good);
    fs.writeFileSync(kf, good.slice(0, Math.floor(good.length / 2)));
    b3 = await startServer(env, await freePort());
    check('damaged kept.json with a good .bak: the sealed chats still open', (await b3.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.text === 'migrate me cherry'));
    b3.stop();
    fs.rmSync(kf);
    b3 = await startServer(env, await freePort());
    check('kept.json gone with a good .bak: the sealed chats still open', (await b3.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.text === 'migrate me cherry'));
    b3.stop();
    // Damaged and no good backup: refused, and never taken for "no key yet" (no new key is made, the damaged file is left as it is).
    fs.rmSync(kf + '.bak'); fs.writeFileSync(kf, '{"chats.at');
    b3 = await startServer(env, await freePort());
    const dr = await b3.api('GET', `/api/dms/contacts/${ca.id}/messages`), dw = await b3.api('POST', '/api/chats/_groups/mig-0001/say', { as: 'A', text: 'not over a damaged key' });
    check('damaged kept.json, no backup: chats are refused, not opened with a new key', dr.status === 500 && dw.status === 500 && disk(kf) === '{"chats.at' && !fs.existsSync(kf + '.bak') && !disk(bg).includes('not over'), [dr.status, dw.status]);
    b3.stop();
    fs.writeFileSync(kf, good);

    delete kept['chats.atrest']; fs.writeFileSync(kf, JSON.stringify(kept));
    b3 = await startServer(env, await freePort());
    const r = await b3.api('GET', `/api/dms/contacts/${ca.id}/messages`);
    check('no key: reading a sealed chat is refused with a plain message', r.status === 500 && /key that opens them is missing/.test(r.body.error || ''), r);
    const w = await b3.api('POST', '/api/chats/_groups/mig-0001/say', { as: 'A', text: 'should not land' });
    check('no key: writing is refused, not saved in plaintext', w.status === 500 && /ever saved unencrypted/.test(w.body.error || '') && disk(bg).startsWith(PREFIX) && !disk(bg).includes('should not land'), w);
    check('no key: no new key was made over the old chats', !('chats.atrest' in JSON.parse(disk(kf))));

    // AIG-1172: a save is temp file + rename (no .tmp left behind) and keeps the previous good version as kept.json.bak;
    // missing everywhere is empty, damaged with no good backup throws (never read as empty), and a save over it is refused.
    const sd = tmp('kept'), probe = `const S=require(${JSON.stringify(path.join(ROOT, 'lib', 'secrets.js'))});const fs=require('fs'),f=process.argv[1]+'/secrets/kept.json',o={};
      o.empty=JSON.stringify(S.keptKeys());S.keep('A','one');S.keep('B','two');
      o.bak=Object.keys(JSON.parse(fs.readFileSync(f+'.bak','utf8'))).join();o.main=S.keptKeys().join();o.tmp=fs.existsSync(f+'.tmp');
      fs.writeFileSync(f,'{"A":');o.fromBak=S.kept('A')+','+S.kept('B');
      fs.writeFileSync(f+'.bak','');try{S.kept('A');o.damaged='read'}catch(e){o.damaged='threw'}
      try{S.keep('C','three');o.save='saved'}catch(e){o.save='refused'}o.left=fs.readFileSync(f,'utf8');
      console.log(JSON.stringify(o));process.exit(0);`;
    const pr = spawnSync(process.execPath, ['-e', probe, sd], { env: { ...process.env, AIGILE_SECRETS_DIR: sd, AIGILE_DATA: sd }, encoding: 'utf8' });
    let o = {}; try { o = JSON.parse(pr.stdout.trim().split('\n').pop()); } catch {}
    check('kept.json: nothing yet reads as empty', o.empty === '[]', pr.stderr);
    check('kept.json: a save renames a temp file in (none left) and keeps the previous good version as .bak', o.main === 'A,B' && o.bak === 'A' && o.tmp === false, o);
    check('kept.json damaged: values come from the .bak', o.fromBak === 'one,null', o);
    check('kept.json damaged and no good .bak: reading throws, a save is refused and the file is left alone', o.damaged === 'threw' && o.save === 'refused' && o.left === '{"A":', o);
  } finally { b.stop(); if (b2) b2.stop(); if (b3) b3.stop(); relay.stop(); }
}, false, { AIGILE_DM_POLL_MS: '300' });
