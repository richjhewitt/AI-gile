// QA area: pretendfriend (AIG-322/323): Setup's 🧪 Pretend friend starts a local relay and a second board, Davy, with the invite
// swapped; Davy's board answers with its "You're Davy (pretend)" bar in Flemish; a DM goes there and back through the local relay;
// the manual invite option; Stop removes the pretend contact, puts the DM settings back and keeps or wipes Davy's data.
import { until, check, def, openPage, noErrors } from '../lib.mjs';

const up = async url => { try { return (await fetch(url + 'api/meta')).ok; } catch { return false; } };

def('pretendfriend', 'Setup: start a pretend friend (local relay + board "Davy"), his banner, a DM there and back, manual invite, stop (AIG-322/323)', async (s, ctx) => {
  let url = '';
  try {
    check('nothing runs at first', (await s.ok('GET', '/api/pretend')).running === false);
    const r = await s.ok('POST', '/api/pretend', {});
    url = r.url;
    check('start gives Davy a web address and a local relay', r.running && /^http:\/\/localhost:\d+\/$/.test(url) && /^http:\/\/127\.0\.0\.1:\d+$/.test(r.relay), JSON.stringify(r));
    check("Davy's board answers", await up(url));
    const me = await (await fetch(url + 'api/pretend')).json();
    check('his board knows it is Davy, in nl-BE', me.me === 'Davy' && me.lang === 'nl-BE', JSON.stringify(me));
    check("the real board's DMs point at the local relay", (await s.ok('GET', '/api/dms')).relay === r.relay);
    const list = await s.ok('GET', '/api/dms/contacts');
    check('Davy is already a checked contact, marked pretend', list.length === 1 && list[0].name === 'Davy' && list[0].checked && list[0].pretend, JSON.stringify(list));

    // his board has the banner on every page, in Flemish
    const pd = await ctx.newPage(); pd.errors = [];
    pd.on('pageerror', e => pd.errors.push(e.message));
    await pd.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    await pd.goto(url); await pd.waitForSelector('#pretendBar');
    await until(async () => /nep/.test(await pd.textContent('#pretendBar')));
    check('the bar says who you are, in Flemish', /Je bent Davy \(nep\)/.test(await pd.textContent('#pretendBar')), await pd.textContent('#pretendBar'));
    await pd.goto(url + '#/setup'); await pd.waitForSelector('#pretendBar');
    check('the bar is on other pages too', await pd.isVisible('#pretendBar'));
    await pd.waitForSelector('#pfBody');
    check('his Setup does not offer another pretend friend', !!(await until(async () => /Dit is het bord van de nepvriend/.test(await pd.textContent('#pfBody')))));
    noErrors(pd);

    // a DM there and back
    const davy = async (m, p, b) => (await fetch(url.replace(/\/$/, '') + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
    await s.ok('POST', `/api/dms/contacts/${list[0].id}/messages`, { text: 'hello Davy' });
    const dc = await until(async () => (await davy('GET', '/api/dms/contacts'))[0]);
    check("Davy's board has the owner as a contact", !!dc && dc.checked === true, JSON.stringify(dc));
    check('the message reaches Davy', !!(await until(async () => (await davy('GET', `/api/dms/contacts/${dc.id}/messages`)).find(m => m.text === 'hello Davy' && m.dir === 'in'))));
    await davy('POST', `/api/dms/contacts/${dc.id}/messages`, { text: 'hoi baas' });
    check('his answer comes back', !!(await until(async () => (await s.ok('GET', `/api/dms/contacts/${list[0].id}/messages`)).find(m => m.text === 'hoi baas' && m.dir === 'in'))));

    // AIG-384: Ask a mate works end to end on Davy's board with no tokens: his stub agent answers ask runs with a canned reply.
    const q = await s.ok('POST', `/api/dms/contacts/${list[0].id}/ask`, { text: 'Is the stub there?' });
    const aq = await until(async () => (await davy('GET', '/api/dms/asks')).asks.find(x => /stub/.test(x.text)));
    check("the question waits in Davy's inbox", !!aq && aq.state === 'waiting', JSON.stringify(aq));
    const yes = await davy('POST', `/api/dms/asks/${aq.contact}/${aq.id}/yes`, {});
    check('Davy says yes and it starts', yes.ok === true && yes.state === 'running', JSON.stringify(yes));
    const ans = await until(async () => (await s.ok('GET', `/api/dms/contacts/${list[0].id}/messages`)).find(m => m.kind === 'answer' && !m.no), 20000);
    check('the canned answer comes back in Flemish, not "no answer came back"', !!ans && /nep-AI/.test(ans.text), JSON.stringify(ans));
    check('and the question shows answered', (await s.ok('GET', `/api/dms/contacts/${list[0].id}/messages`)).find(m => m.id === q.id).state === 'answered');

    // Setup on the real board: running state, Open, Stop asks keep or wipe
    const ps = await openPage(ctx, '#/setup');
    await ps.waitForSelector('#pfOpen');
    check("Setup shows Open Davy's board and Stop", await ps.isVisible('#pfStop'));
    check('the friends list tags him pretend', !!(await until(async () => /pretend/.test(await ps.textContent('#dmfBody')))));
    await ps.click('#pfStop'); await ps.waitForSelector('#pfKeep');
    check('Stop asks whether to keep his data', await ps.isVisible('#pfWipe'));
    await ps.click('#pfKeep');
    await ps.waitForSelector('#pfStart');
    check('Davy is stopped', (await s.ok('GET', '/api/pretend')).running === false);
    check('his board is gone', !!(await until(async () => !(await up(url)), 5000)));
    check('the pretend contact is gone from the real board', (await s.ok('GET', '/api/dms/contacts')).length === 0);
    const back = await s.ok('GET', '/api/dms');
    check('the real DM settings are back', back.on === false && back.relay === '', JSON.stringify(back));
    check('his data is kept', (await s.ok('GET', '/api/pretend')).kept === true);
    noErrors(ps);

    // manual option: no auto swap; his code adds him by hand and he is tagged pretend
    const m = await s.ok('POST', '/api/pretend', { auto: false });
    url = m.url;
    check('manual start adds no contact', (await s.ok('GET', '/api/dms/contacts')).length === 0);
    const inv = await s.ok('POST', '/api/pretend/invite');
    await s.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Davy' });
    await s.ok('GET', '/api/pretend');
    check('a hand-added Davy is marked pretend', (await s.ok('GET', '/api/dms/contacts')).some(c => c.pretend));
    const done = await s.ok('POST', '/api/pretend/stop', { wipe: true });
    check('stop and wipe: stopped, data wiped', !done.running && !done.kept);
    check('stop removes the contact', (await s.ok('GET', '/api/dms/contacts')).length === 0);
    check('his board is down', !!(await until(async () => !(await up(url)), 5000)));
    await ps.close();
  } finally { try { await s.api('POST', '/api/pretend/stop', { wipe: true }); } catch {} }
}, true, { AIGILE_DM_POLL_MS: '300' });
