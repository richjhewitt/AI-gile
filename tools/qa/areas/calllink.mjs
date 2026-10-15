// QA area: calllink (AIG-861): a "Join call" link only. p.callUrl per project (stand-up report, DM head) and
// c.change.callUrl per change card. Only http(s) is accepted; the link opens in a new tab with rel=noopener.
import { check, tmp, mkProject, getCard, def, openPage, noErrors } from '../lib.mjs';

def('calllink', '📞 Join call link: project link on the stand-up report and DM head, change card link, javascript: refused (AIG-861)', async (s, ctx) => {
  await mkProject(s, 'Call', 'CAL', { path: tmp('calllink') });
  const url = 'https://meet.example.com/standup-room';
  check('a javascript: link is refused on a project', (await s.api('PATCH', '/api/projects/call', { callUrl: 'javascript:alert(1)' })).status === 400);
  check('a plain word is refused', (await s.api('PATCH', '/api/projects/call', { callUrl: 'standup' })).status === 400);
  check('nothing was saved by the refused ones', !(await s.ok('GET', '/api/projects/call')).callUrl);
  const set = await s.ok('PATCH', '/api/projects/call', { callUrl: url });
  check('the project takes an https link', set.callUrl === url, set);
  check('it reads back and is in the chats list', (await s.ok('GET', '/api/projects/call')).callUrl === url && (await s.ok('GET', '/api/chats')).find(c => c.slug === 'call').callUrl === url);

  // a stand-up exists, so the report lists the project with its link
  await s.ok('POST', '/api/standup', { projects: ['call'] });
  const su = await openPage(ctx, '#/standups/call');
  await su.waitForSelector('.su-proj a.calllink');
  const sl = su.locator('.su-proj a.calllink');
  check('the stand-up report shows Join call, new tab, noopener', await sl.getAttribute('href') === url && await sl.getAttribute('target') === '_blank' && /noopener/.test(await sl.getAttribute('rel')) && /Join call/.test(await sl.innerText()));

  const board = await openPage(ctx, '#/p/call');
  await board.waitForSelector('.toolbar');
  await board.evaluate(() => Dms.show('call'));
  await board.waitForSelector('.dm-head a.calllink');
  check('the DM head shows Join call', await board.locator('.dm-head a.calllink').getAttribute('href') === url);

  // change card
  const ch = await s.ok('POST', '/api/projects/call/changes', { title: 'Move host', callUrl: 'http://jitsi.example.com/room' });
  check('a change card takes a link', ch.callUrl === 'http://jitsi.example.com/room', ch);
  check('a javascript: link is refused on a change', (await s.api('PATCH', `/api/projects/call/changes/${ch.id}`, { callUrl: 'javascript:alert(1)' })).status === 400);
  check('it stayed as it was', (await getCard(s, 'call', ch.id)).change.callUrl === 'http://jitsi.example.com/room');
  const other = await s.ok('POST', '/api/projects/call/changes', { title: 'No call' });
  check('a change without a link has none (old cards unchanged)', !other.callUrl);
  const up = await s.ok('PATCH', `/api/projects/call/changes/${ch.id}`, { callUrl: 'https://meet.example.com/change-call' });
  check('PATCH sets another link', up.callUrl === 'https://meet.example.com/change-call');
  const page = await openPage(ctx, `#/p/call/${ch.id}`);
  await page.waitForSelector('.change a.calllink');
  const cl = page.locator('.change a.calllink');
  check('the change card shows Join call, new tab, noopener', await cl.getAttribute('href') === 'https://meet.example.com/change-call' && await cl.getAttribute('target') === '_blank' && /noopener/.test(await cl.getAttribute('rel')));
  try { await page.locator('.change').screenshot({ path: 'R:/wt/aig861-shot.png' }); } catch {}
  const op = await openPage(ctx, `#/p/call/${other.id}`);
  await op.waitForSelector('.change');
  const projLink = (await s.ok('GET', '/api/projects/call')).callUrl;
  check('a change card without its own link shows the project call link, or none (AIG-861)', projLink ? (await op.getAttribute('.change a.calllink', 'href')) === projLink : (await op.locator('.change a.calllink').count()) === 0, projLink);
  check('an empty link clears it', !(await s.ok('PATCH', `/api/projects/call/changes/${ch.id}`, { callUrl: '' })).callUrl);
  check('an empty project link clears it', !(await s.ok('PATCH', '/api/projects/call', { callUrl: '' })).callUrl);
  await noErrors(su); await noErrors(board); await noErrors(page); await noErrors(op);
}, true);
