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
    // AIG-488: his made-up project is named in his language (Flemish), and his board saved that language
    const dp = await (await fetch(url + 'api/projects')).json();
    check("Davy's project has a Flemish name, and his board saved nl-BE", dp.some(p => p.name === 'Tuin van Davy') && (await (await fetch(url + 'api/setup')).json()).prefs.lang === 'nl-BE', JSON.stringify(dp.map(p => p.name)));
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

// AIG-468: the picker beside Start pretend friend and Open a fresh board: window kind and which code. No window is ever opened here:
// window.open is stubbed and the trial request is answered by the test; the server's choice of code folder is checked through the API.
def('launchpick', "Setup: window/code picker renders, the pick is remembered and sent to the API, the server picks today's or the last release folder (AIG-468)", async (s, ctx) => {
  const os = await import('node:os'), path = await import('node:path'), fs = await import('node:fs');
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#trialBtn'); await page.waitForSelector('#pfStart');
  check('the picker is beside Start pretend friend and Open a fresh board', (await page.locator('#pfBody select[data-lp]').count()) === 2 && (await page.locator('.f:has(#trialBtn) select[data-lp]').count()) === 2);
  check("defaults: desktop app, today's build", (await page.inputValue('#pfBody select[data-lp=win]')) === 'app' && (await page.inputValue('#pfBody select[data-lp=code]')) === 'today');
  check('the window choices are desktop, browser, phone', /🖥️.*\|.*🌐.*\|.*📱/.test((await page.locator('#pfBody select[data-lp=win] option').allTextContents()).join('|')));
  await page.selectOption('#pfBody select[data-lp=win]', 'phone'); await page.selectOption('#pfBody select[data-lp=code]', 'release');
  check('the trial picker follows the same pick', (await page.inputValue('.f:has(#trialBtn) select[data-lp=code]')) === 'release');
  const sent = [];
  await page.route('**/api/trial', r => { if (r.request().method() === 'POST') { sent.push(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"http://127.0.0.1:9/"}' }); } else r.continue(); });
  await page.evaluate(() => { window.__opened = []; window.open = (...a) => { window.__opened.push(a); }; });
  await page.click('#trialBtn'); await until(async () => sent.length === 1);
  check('the pick is sent to the API', sent[0] && sent[0].code === 'release' && sent[0].window === 'phone', JSON.stringify(sent));
  const o = await until(async () => { const x = await page.evaluate(() => window.__opened); return x.length ? x : null; });
  check('a phone-size window is asked for, about 412 by 860', !!o && /width=412,height=860/.test(String(o[0][2])), JSON.stringify(o));
  await page.reload(); await page.waitForSelector('#pfStart');
  check('the pick is remembered', (await page.inputValue('#pfBody select[data-lp=win]')) === 'phone' && (await page.inputValue('#pfBody select[data-lp=code]')) === 'release');
  await page.close();
  try {
    const t1 = await s.ok('POST', '/api/trial', { code: 'today' });
    check("the server runs today's folder", t1.code === 'today' && fs.existsSync(path.join(t1.dir, 'tools', 'qa', 'qa.mjs')), JSON.stringify(t1));
    const t2 = await s.ok('POST', '/api/trial', { code: 'release' });
    check('the server runs the last release from a temp cache folder', t2.code === 'release' && path.resolve(t2.dir).startsWith(path.resolve(os.tmpdir())) && fs.existsSync(path.join(t2.dir, 'server.js')), JSON.stringify(t2));
    check('the release board answers', (await fetch('http://127.0.0.1:4400/api/meta')).ok);
  } finally { try { await s.api('DELETE', '/api/trial'); } catch {} }
}, true);
