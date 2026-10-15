// QA area: emojisdm (AIG-650, custom emojis 3/3): a DM with :name: carries the small picture once per friend; the friend's board keeps it per sender,
// shows it inline in that friend's chat, and ⭐ Save adds it to their own list; a bad received picture is dropped. Uses the 🧪 pretend friend (Davy).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { until, check, def, tmp, openPage, noErrors } from '../lib.mjs';

// A real 2x2 red PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8Dwn4EBAAv7Af8F4ZXPAAAAAElFTkSuQmCC', 'base64');
const B64 = PNG.toString('base64');

def('emojisdm', 'custom emojis in DMs: the picture goes once per friend inside the message, shows in his chat, Save adds it to his own list, bad pictures are dropped (AIG-650)', async (s, ctx) => {
  // The receiver's checks, on their own in a throwaway data folder (the lib is loaded fresh and put back).
  {
    const req = createRequire(import.meta.url), root = path.resolve(import.meta.dirname, '../../..');
    const keys = ['lib/store.js', 'lib/emojis.js'].map(f => path.join(root, f));
    const was = process.env.AIGILE_DATA, dir = tmp('emojisdm-unit');
    process.env.AIGILE_DATA = dir; keys.forEach(k => delete req.cache[k]);
    try {
      const E = req(keys[1]);
      const n = E.receive('abc123', {
        good_one: B64,
        'Bad Name': B64,
        '../evil': B64,
        text_file: Buffer.from('hello, this is not a picture').toString('base64'),
        huge: Buffer.concat([PNG, Buffer.alloc(40000)]).toString('base64'),
        empty: '',
        notastring: 42,
      });
      check('only the one good picture is kept', n === 1 && E.listFrom('abc123').map(e => e.name).join() === 'good_one', E.listFrom('abc123'));
      check('nothing else was written', fs.readdirSync(path.join(dir, 'emojis-from', 'abc123')).sort().join() === 'good_one.png,index.json');
      check('a contact id that is a path is refused', (() => { try { E.receive('../x', { a: B64 }); return false; } catch { return true; } })());
      check('a non-object payload is ignored', E.receive('abc123', 'nope') === 0 && E.receive('abc123', [B64]) === 0);
    } finally {
      if (was === undefined) delete process.env.AIGILE_DATA; else process.env.AIGILE_DATA = was;
      keys.forEach(k => delete req.cache[k]);
    }
  }

  let url = '';
  try {
    const r = await s.ok('POST', '/api/pretend', {});
    url = r.url;
    const contact = (await s.ok('GET', '/api/dms/contacts'))[0];
    const davy = async (m, p, b) => (await fetch(url.replace(/\/$/, '') + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }));
    const dj = async (m, p, b) => (await davy(m, p, b)).json();

    await s.ok('POST', '/api/emojis', { name: 'blob_1', data: B64 });
    await s.ok('POST', '/api/emojis', { name: 'unused', data: B64 });
    const first = await s.ok('POST', `/api/dms/contacts/${contact.id}/messages`, { text: 'look :blob_1: and :nope: here' });
    const dc = await until(async () => (await dj('GET', '/api/dms/contacts'))[0]);
    check('the message reaches Davy', !!(await until(async () => (await dj('GET', `/api/dms/contacts/${dc.id}/messages`)).find(m => m.dir === 'in' && /:blob_1:/.test(m.text)))));
    const got = await dj('GET', `/api/dms/contacts/${dc.id}/emojis`);
    check('Davy keeps only the name that was used, for this sender', got.length === 1 && got[0].name === 'blob_1', got);
    const pic = await davy('GET', `/api/dms/contacts/${dc.id}/emojis/blob_1`);
    check("his board serves the picture as a png", pic.status === 200 && pic.headers.get('content-type') === 'image/png' && (await pic.arrayBuffer()).byteLength === PNG.length);
    check('a name he was not sent is a 404', (await davy('GET', `/api/dms/contacts/${dc.id}/emojis/unused`)).status === 404);
    check('it is not in his own list yet', (await dj('GET', '/api/emojis')).length === 0);

    // the second message does not send the bytes again
    const second = await s.ok('POST', `/api/dms/contacts/${contact.id}/messages`, { text: 'again :blob_1:' });
    await until(async () => (await dj('GET', `/api/dms/contacts/${dc.id}/messages`)).find(m => m.dir === 'in' && /again/.test(m.text)));
    const ct = async id => (await s.ok('GET', `/api/dms/contacts/${contact.id}/messages/${id}/raw`)).envelope.ct.length;
    const c1 = await ct(first.id), c2 = await ct(second.id);
    check('the first message carries the picture, the second does not', c1 > B64.length && c2 < c1 - B64.length + 50, { c1, c2 });
    check('the friend still shows it after the second message', (await dj('GET', `/api/dms/contacts/${dc.id}/emojis`)).length === 1);

    // Davy's page: inline in the chat, hover Save
    const pd = await ctx.newPage(); pd.errors = [];
    pd.on('pageerror', e => pd.errors.push(e.message));
    await pd.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    await dj('POST', '/api/setup', { prefs: { wizardSeen: true } });   // Davy's board is a first run: its welcome dialog would sit over the rail
    await pd.goto(url + '#/');
    await pd.waitForSelector('#dmRail [data-dms]');
    await pd.click('#dmRail [data-dms]');
    await pd.waitForSelector(`#dmPanel [data-dm="dm:${dc.id}"]`);
    await pd.click(`#dmPanel [data-dm="dm:${dc.id}"]`);
    await pd.waitForSelector('#dmList .cemoji-w img.cemoji', { timeout: 10000 });
    const view = await pd.evaluate(() => ({ n: document.querySelectorAll('#dmList img.cemoji').length, nope: document.querySelector('#dmList').textContent.includes(':nope:'), h: document.querySelector('#dmList img.cemoji').getBoundingClientRect().height, vis: getComputedStyle(document.querySelector('#dmList .cemoji-save')).display }));
    check('the picture shows inline in his chat; the unknown name stays text; Save is hidden until hover', view.n === 2 && view.nope && view.h > 10 && view.vis === 'none', view);
    await pd.hover('#dmList .cemoji-w');
    check('Save shows on hover', await pd.isVisible('#dmList .cemoji-save'));
    await pd.click('#dmList .cemoji-save');
    check('Save adds it to his own list', !!(await until(async () => (await dj('GET', '/api/emojis')).some(e => e.name === 'blob_1'))));
    // a clash is refused and a new name works
    const clash = await davy('POST', `/api/dms/contacts/${dc.id}/emojis/blob_1/save`, {});
    check('saving the same name again is a clash (409)', clash.status === 409);
    const again = await dj('POST', `/api/dms/contacts/${dc.id}/emojis/blob_1/save`, { as: 'blob_two' });
    check('with a new name it is saved too', again.map(e => e.name).sort().join() === 'blob_1,blob_two', again);
    check('a bad new name is refused', (await davy('POST', `/api/dms/contacts/${dc.id}/emojis/blob_1/save`, { as: 'Bad Name' })).status === 400);
    check('saving one he was not sent is a 404', (await davy('POST', `/api/dms/contacts/${dc.id}/emojis/unused/save`, {})).status === 404);
    check('his own emojis also show on his side as pictures now', !!(await dj('GET', '/api/emojis')).length);
    noErrors(pd);
    await pd.close();

    const gone = await davy('GET', '/api/dms/contacts/nosuchcontact/emojis');
    check('an unknown contact is a 404', gone.status === 404);
  } finally { try { await s.api('POST', '/api/pretend/stop', { wipe: true }); } catch {} }
}, true, { AIGILE_DM_POLL_MS: '300' });
