// QA area: emojis (AIG-648), your own emojis: picture + :name: added from the :emoji: popup, kept on this PC, shown under "Yours", deleted.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, sleep, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

// A real 2x2 red PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8Dwn4EBAAv7Af8F4ZXPAAAAAElFTkSuQmCC', 'base64');

def('emojis', 'custom emojis: API add/list/serve/delete with bad names, duplicates, huge and fake files refused; the :emoji: popup adds one from a PNG, lists it under Yours, inserts :name:, deletes it with the x', async (s, ctx) => {
  const b64 = PNG.toString('base64');
  check('starts empty', (await s.ok('GET', '/api/emojis')).length === 0);
  const bad1 = await s.api('POST', '/api/emojis', { name: 'Bad Name!', data: b64 });
  check('a bad name is refused', bad1.status === 400, bad1);
  check('not a picture is refused', (await s.api('POST', '/api/emojis', { name: 'fake', data: Buffer.from('hello world, not a png').toString('base64') })).status === 400);
  check('over 32 KB is refused', (await s.api('POST', '/api/emojis', { name: 'huge', data: Buffer.concat([PNG, Buffer.alloc(40000)]).toString('base64') })).status === 400);
  const added = await s.ok('POST', '/api/emojis', { name: 'blob_1', data: b64 });
  check('add returns the list', added.length === 1 && added[0].name === 'blob_1' && added[0].ext === '.png', added);
  check('a duplicate name is refused', (await s.api('POST', '/api/emojis', { name: 'blob_1', data: b64 })).status === 409);
  const r = await fetch(BASE + added[0].url);
  check('the picture is served', r.status === 200 && r.headers.get('content-type') === 'image/png' && (await r.arrayBuffer()).byteLength === PNG.length);
  check('an unknown picture is a 404', (await fetch(BASE + '/api/emojis/nope')).status === 404);
  check('delete removes it', (await s.ok('DELETE', '/api/emojis/blob_1')).length === 0 && (await s.ok('GET', '/api/emojis')).length === 0);
  check('deleting an unknown one is a 404', (await s.api('DELETE', '/api/emojis/blob_1')).status === 404);

  // The page.
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Chatty', { status: 'verify', testSteps: 'Step one' });
  const file = path.join(tmp('emojis'), 'qzblob.png');
  fs.writeFileSync(file, PNG);
  const page = await openPage(ctx, '#/p/alpha/ALP-1');
  await page.waitForSelector('#modal .panel');
  await page.click('.ctab[data-ctab=reply]');
  await page.click('#r-text');
  await page.keyboard.type(':smi');
  await page.waitForSelector('.emj');
  check('the popup ends with the Add your own entry', /Add your own/.test(await page.textContent('.emj-add')));
  check('no Yours section yet', !(await page.$('.emj-sec')));
  await page.click('.emj-add');
  await page.waitForSelector('#emj-file');
  await page.setInputFiles('#emj-file', file);
  await page.waitForSelector('#emj-prev:not([hidden])');
  check('the name is suggested from the file', (await page.inputValue('#emj-name')) === 'qzblob');
  await page.fill('#emj-name', 'Bad Name');
  await page.click('#emj-go');
  check('a bad name shows an error and nothing is stored', /lowercase/.test(await page.textContent('#emj-err')) && (await s.ok('GET', '/api/emojis')).length === 0);
  await page.fill('#emj-name', 'smile');
  await page.click('#emj-go');
  check('a built-in name is refused', /already taken/.test(await page.textContent('#emj-err')));
  await page.fill('#emj-name', 'qzblob');
  await page.click('#emj-go');
  await page.waitForSelector('#emj-file', { state: 'detached' });
  check('stored on the server', (await s.ok('GET', '/api/emojis')).map(e => e.name).join() === 'qzblob');
  await page.fill('#r-text', '');
  await page.click('#r-text');
  await page.keyboard.type(':qzb');
  await page.waitForSelector('.emj-sec');
  check('it shows under Yours with its picture', /Yours/i.test(await page.textContent('.emj-sec')) && !!(await page.$('.emj-row[data-mine=qzblob] img')));
  await page.click('.emj-row[data-mine=qzblob]').catch(() => {});
  check('picking inserts :qzblob:', (await page.inputValue('#r-text')).includes(':qzblob:'), await page.inputValue('#r-text'));
  await page.fill('#r-text', '');
  await page.keyboard.type(':qzb');
  await page.waitForSelector('.emj-row[data-mine=qzblob]');
  await page.click('.emj-row[data-mine=qzblob] .emj-x');
  await sleep(500);
  check('the x deletes it', (await s.ok('GET', '/api/emojis')).length === 0 && !(await page.$('.emj-row[data-mine=qzblob]')));

  // Shown in text (AIG-649): a comment and a DM; unknown names and code stay text.
  await s.ok('POST', '/api/emojis', { name: 'qzblob', data: b64 });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const card = await mkCard(s, 'alpha', 'Emoji text');
  await s.ok('POST', `/api/projects/alpha/cards/${card.id}/comments`, { author: 'Owner', text: 'Hi :qzblob: and :nope: and `:qzblob:`' });
  s.cli(['ask', 'alpha', card.id, 'Like it :qzblob: or :nope:? Assuming yes', '--as', 'Lead']);
  const p2 = await openPage(ctx, `#/p/alpha/${card.id}`);
  await p2.waitForSelector('#modal .panel');
  await p2.waitForSelector('#modal img.cemoji', { timeout: 8000 }).catch(() => {});
  const cm = await p2.evaluate(() => { const i = document.querySelector('#modal img.cemoji'); return { n: document.querySelectorAll('#modal img.cemoji').length, alt: i && i.alt, title: i && i.title, h: i && i.getBoundingClientRect().height, codeBad: [...document.querySelectorAll('#modal code')].some(c => c.querySelector('img')), codeText: [...document.querySelectorAll('#modal code')].some(c => c.textContent === ':qzblob:'), nope: document.querySelector('#modal').textContent.includes(':nope:') }; });
  check('a comment shows :qzblob: as a picture, alt and title set', cm.n >= 1 && cm.alt === ':qzblob:' && cm.title === ':qzblob:' && cm.h > 10, cm);
  check('unknown :nope: stays text; inline code stays text', cm.nope && cm.codeText && !cm.codeBad, cm);
  await p2.goto(BASE + '/#/');
  await p2.waitForSelector('#dmRail [data-dms]');
  await p2.click('#dmRail [data-dms]');
  await p2.click('#dmPanel [data-dm="alpha"]');
  await p2.waitForSelector('#dmList .dm-msg');
  await p2.waitForSelector('#dmList img.cemoji', { timeout: 8000 }).catch(() => {});
  check('a DM shows the picture and keeps :nope: as text', !!(await p2.$('#dmList img.cemoji')) && /:nope:/.test(await p2.textContent('#dmList')));
  noErrors(p2);
  noErrors(page);
}, true);
