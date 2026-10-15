// QA area: chatplus (AIG-1164): reply (quote), edit and delete your own message, emoji reactions and a typing line, in
// friends' private DMs (two boards and a local relay) and in 👥 group chats. Ideas and code lifted from ChilledChat.
import fs from 'node:fs';
import path from 'node:path';
import { startRelay, startServer, freePort, until, check, sleep, mkProject, openPage, noErrors, def, readChat } from '../lib.mjs';

def('chatplus', 'chat extras: reply with a quote, edit / delete only your own, emoji reactions (one emoji, toggles), a typing line never saved; friends\' DMs over the relay and 👥 groups, agents react with the CLI (AIG-1164)', async (s, ctx) => {
  const relay = await startRelay({ RELAY_RATE: '100000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const team = (method, url, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'cli', 'x-aigile-as': 'Dev' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(r => r.status);
  try {
    await s.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await s.ok('POST', '/api/dms/invites', { name: 'Beatrix' });
    const cb = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });
    const ca = await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0]);
    const A = `/api/dms/contacts/${ca.id}`, B = `/api/dms/contacts/${cb.id}`;
    const inB = async pred => until(async () => (await b.ok('GET', B + '/messages')).find(pred));
    const inA = async pred => until(async () => (await s.ok('GET', A + '/messages')).find(pred));

    // Reply: the quote rides inside the sealed message, by the message id both boards share
    await b.ok('POST', B + '/messages', { text: 'Hi from Alberto' });
    const hi = await inA(m => m.text === 'Hi from Alberto');
    const rep = await s.ok('POST', A + '/messages', { text: 'Hi back', reply: hi.id });
    check('a reply keeps the quoted message', rep.reply && rep.reply.id === hi.id && rep.reply.text === 'Hi from Alberto', rep);
    const repB = await inB(m => m.text === 'Hi back');
    check('the friend gets the reply pointing at their own message', repB && repB.reply && repB.reply.id === hi.id && (await b.ok('GET', B + '/messages')).some(m => m.id === hi.id && m.dir === 'out'), repB);
    check('a reply to a message not in the chat is refused', (await s.api('POST', A + '/messages', { text: 'x', reply: 'nope-not-there' })).status === 404);

    // Edit: only the author
    const ed = await s.ok('PATCH', `${A}/messages/${rep.id}`, { text: 'Hi back, edited' });
    check('editing my message changes it and marks it edited', ed.text === 'Hi back, edited' && !!ed.edited, ed);
    check('the friend sees the edit', !!(await inB(m => m.id === rep.id && m.text === 'Hi back, edited' && m.edited)));
    check('I cannot edit their message', (await s.api('PATCH', `${A}/messages/${hi.id}`, { text: 'hacked' })).status === 403);
    check('an empty edit is refused', (await s.api('PATCH', `${A}/messages/${rep.id}`, { text: '  ' })).status === 400);
    check('a team call cannot edit, delete, react or type in a friend\'s DM', (await team('PATCH', `${A}/messages/${rep.id}`, { text: 'x' })) === 403 && (await team('DELETE', `${A}/messages/${rep.id}`)) === 403 && (await team('POST', `${A}/messages/${hi.id}/react`, { emoji: '👍' })) === 403 && (await team('POST', `${A}/typing`, {})) === 403);

    // Reactions: one emoji, either side, toggles
    const r1 = await s.ok('POST', `${A}/messages/${hi.id}/react`, { emoji: '👍' });
    check('I react to their message', r1.reacts && r1.reacts.mine.includes('👍'), r1);
    check('the friend sees my reaction on their message', !!(await inB(m => m.id === hi.id && m.reacts && m.reacts.theirs.includes('👍'))));
    await b.ok('POST', `${B}/messages/${hi.id}/react`, { emoji: '🎉' });
    check('they react to their own message too, and I see it', !!(await inA(m => m.id === hi.id && m.reacts && m.reacts.theirs.includes('🎉') && m.reacts.mine.includes('👍'))));
    const r2 = await s.ok('POST', `${A}/messages/${hi.id}/react`, { emoji: '👍' });
    check('the same emoji again takes it back', !r2.reacts.mine.includes('👍'), r2);
    check('and the friend sees it gone', !!(await inB(m => m.id === hi.id && m.reacts && !m.reacts.theirs.includes('👍'))));
    check('a reaction must be one emoji (no text, no HTML)', (await s.api('POST', `${A}/messages/${hi.id}/react`, { emoji: 'lol' })).status === 400 && (await s.api('POST', `${A}/messages/${hi.id}/react`, { emoji: '<img src=x>' })).status === 400 && (await s.api('POST', `${A}/messages/${hi.id}/react`, { emoji: '5' })).status === 400);

    // Typing: in memory on the friend's board for a few seconds, never a chat line
    const linesB = (await b.ok('GET', B + '/messages')).length;
    const ty = await s.ok('POST', A + '/typing', {});
    check('typing goes to the friend', ty.sent === true, ty);
    check('the friend\'s board shows me typing', !!(await until(async () => (await b.ok('GET', '/api/dms/contacts'))[0].typing, 5000)));
    check('again at once is held back (one every 4 s)', (await s.ok('POST', A + '/typing', {})).sent === false);
    check('typing is never kept as a message', (await b.ok('GET', B + '/messages')).length === linesB && !JSON.stringify(readChat(b, path.join(b.data, 'dms', cb.id + '.json'))).includes('typing'));
    check('and it wears off', !!(await until(async () => !(await b.ok('GET', '/api/dms/contacts'))[0].typing, 12000)));

    // Delete: only the author; the line stays as "deleted" on both boards, its text gone
    const del = await s.ok('DELETE', `${A}/messages/${rep.id}`);
    check('deleting my message empties it', !!del.deleted && del.text === '', del);
    check('the friend sees it deleted, the text gone', !!(await inB(m => m.id === rep.id && m.deleted && m.text === '')) && !JSON.stringify(readChat(b, path.join(b.data, 'dms', cb.id + '.json'))).includes('Hi back, edited'));
    check('a deleted message cannot be edited', (await s.api('PATCH', `${A}/messages/${rep.id}`, { text: 'back' })).status === 403);
    check('I cannot delete their message', (await s.api('DELETE', `${A}/messages/${hi.id}`)).status === 403);

    // 👥 Groups: the owner and agents
    await mkProject(s, 'Pix', 'PIX'); await mkProject(s, 'Clo', 'CLO');
    await s.ok('POST', '/api/projects/pix/team', { name: 'Pixel', role: 'Designer' });
    await s.ok('POST', '/api/projects/clo/team', { name: 'Claudia', role: 'Designer' });
    const g = await s.ok('POST', '/api/chats/_groups', { name: 'Logos', members: [{ project: 'pix', name: 'Pixel' }, { project: 'clo', name: 'Claudia' }] });
    const G = '/api/chats/_groups/' + g.id;
    const pm = await s.ok('POST', G + '/say', { as: 'Pixel', text: 'Five designs ready' });
    check('group messages get an id', /^[a-f0-9]{12}$/.test(pm.id || ''), pm);
    await s.ok('POST', G, { text: 'Love number 3', reply: pm.id });
    let th = await s.ok('GET', G);
    const mine = th.messages.find(m => m.text === 'Love number 3');
    check('a group reply quotes the member\'s message', mine && mine.reply && mine.reply.id === pm.id && /Pixel/.test(mine.reply.author) && mine.reply.text === 'Five designs ready', mine);
    check('the thread says who is typing (members running for it; none now)', Array.isArray(th.typing) && th.typing.length === 0, th.typing);
    const gr = await s.ok('POST', `${G}/msgs/${pm.id}/react`, { emoji: '❤️' });
    check('the owner reacts to a member\'s message', gr.on && gr.reacts.some(r => r.e === '❤️' && r.mine), gr);
    const cr = s.cli(['group', 'react', g.id, pm.id, '🎉', '--as', 'Claudia']);
    check('an agent reacts with aigile group react', cr.code === 0 && /reacted/.test(cr.out), cr);
    th = await s.ok('GET', G);
    check('both reactions show, with who', th.messages.find(m => m.id === pm.id).reacts.some(r => r.e === '🎉' && r.who.includes('Claudia')), th.messages.find(m => m.id === pm.id));
    check('aigile group show lists message ids and reactions', (o => o.code === 0 && o.out.includes('[' + pm.id + ']') && o.out.includes('🎉1'))(s.cli(['group', 'show', g.id])));
    check('someone not in the group cannot react', (await s.api('POST', `${G}/msgs/${pm.id}/react`, { emoji: '👍', as: 'Nobody' })).status === 403);
    check('a team call cannot react as the owner', (await team('POST', `${G}/msgs/${pm.id}/react`, { emoji: '👍' })) === 403);
    check('the owner edits his own message', (await s.ok('PATCH', `${G}/msgs/${mine.id}`, { text: 'Love number 3!' })).edited && (await s.ok('GET', G)).messages.find(m => m.id === mine.id).text === 'Love number 3!');
    check('the owner cannot edit or delete a member\'s message', (await s.api('PATCH', `${G}/msgs/${pm.id}`, { text: 'x' })).status === 403 && (await s.api('DELETE', `${G}/msgs/${pm.id}`)).status === 403);
    check('a team call cannot edit or delete in a group', (await team('PATCH', `${G}/msgs/${mine.id}`, { text: 'x' })) === 403 && (await team('DELETE', `${G}/msgs/${mine.id}`)) === 403);
    await s.ok('DELETE', `${G}/msgs/${mine.id}`);
    th = await s.ok('GET', G);
    check('a deleted group message stays as deleted, text gone', (m => m.deleted && m.text === '')(th.messages.find(m => m.id === mine.id)));

    // The page: a friend's chat
    await b.ok('POST', B + '/messages', { text: 'Pick a colour' });
    const pc = await inA(m => m.text === 'Pick a colour');
    const page = await openPage(ctx, '#/');
    await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]');
    await page.click(`#dmPanel [data-dm="dm:${ca.id}"]`);
    const row = `#dmList .dm-msg[data-mid="${pc.id}"]`;
    await page.waitForSelector(row);
    check('my deleted line shows as deleted', /Message deleted/.test(await page.textContent(`#dmList .dm-msg[data-mid="${rep.id}"]`)));
    await page.hover(row);
    check('their line has reply and react, but no edit or delete', await page.locator(`${row} [data-dmact="reply"]`).isVisible() && await page.locator(`${row} [data-dmact="react"]`).isVisible() && await page.locator(`${row} [data-dmact="edit"]`).count() === 0);
    await page.click(`${row} [data-dmact="reply"]`);
    check('↩ shows who you reply to over the box', /Replying to Beatrix/.test(await page.textContent('#dmReplyBar')) && /Pick a colour/.test(await page.textContent('#dmReplyBar')));
    await page.fill('#dmText', 'Blue'); await page.press('#dmText', 'Enter');
    const blue = await inB(m => m.text === 'Blue');
    check('the reply reaches the friend with its quote', blue && blue.reply && blue.reply.id === pc.id, blue);
    await page.waitForSelector(`#dmList .dm-msg[data-mid="${blue.id}"] .dm-quote`);
    check('the reply shows the quote in the chat, and the bar is gone', /Pick a colour/.test(await page.textContent(`#dmList .dm-msg[data-mid="${blue.id}"] .dm-quote`)) && await page.locator('#dmReplyBar').isHidden());
    await page.hover(row); await page.click(`${row} [data-dmact="react"]`);
    await page.click(`${row} .dm-picker [data-dmpick="❤️"]`);
    await page.waitForSelector(`${row} .dm-react.mine`);
    check('😊 adds a reaction chip', /❤️/.test(await page.textContent(`${row} .dm-react.mine`)));
    check('the friend gets the ❤️', !!(await inB(m => m.id === pc.id && m.reacts && m.reacts.theirs.includes('❤️'))));
    const myRow = `#dmList .dm-msg[data-mid="${blue.id}"]`;
    await page.hover(myRow); await page.click(`${myRow} [data-dmact="edit"]`);
    await page.fill(`${myRow} .dm-edit`, 'Navy blue'); await page.press(`${myRow} .dm-edit`, 'Enter');
    await page.waitForFunction(sel => /Navy blue/.test((document.querySelector(sel) || {}).textContent || '') && /edited/.test(document.querySelector(sel).textContent), myRow, { timeout: 6000 }).catch(() => {});
    check('✏️ edits my line in place, marked edited', /Navy blue/.test(await page.textContent(myRow)) && /edited/.test(await page.textContent(myRow)));
    check('the friend gets the edit', !!(await inB(m => m.id === blue.id && m.text === 'Navy blue')));
    await b.ok('POST', B + '/typing', {});
    await page.waitForFunction(() => /Alberto|Beatrix/.test(document.getElementById('dmTyping').textContent), null, { timeout: 8000 }).catch(() => {});
    check('the friend typing shows over the box', /Beatrix is typing/.test(await page.textContent('#dmTyping')), await page.textContent('#dmTyping'));
    page.once('dialog', d => d.accept());
    await page.hover(myRow); await page.click(`${myRow} [data-dmact="del"]`);
    check('🗑 deletes my line for both', !!(await inB(m => m.id === blue.id && m.deleted)) && !!(await page.waitForFunction(sel => /Message deleted/.test((document.querySelector(sel) || {}).textContent || ''), myRow, { timeout: 6000 }).catch(() => null)));
    noErrors(page);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
