// QA area: setupux (AIG-934, AIG-941). Setup has a sticky index of section links, each section a card with a real heading,
// #/setup/<section> deep links, opens at the top; phone pairing is its own section with steps 1-2-3.
import { check, sleep, openPage, noErrors, mkProject, def } from '../lib.mjs';

def('setupux', 'Setup index: section links scroll to their section, #/setup/<section> deep link, opens at the top; phone pairing in numbered steps (AIG-934, AIG-941)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');   // a board that is set up: no first-run wizard over the page
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#setIndex');
  await page.waitForSelector('#sec-phone #phPair');
  const links = await page.$$eval('#setIndex a', a => a.map(x => x.dataset.sec));
  check('the index lists language, look, plan, teams, discord, mail, servers, phone', ['lang', 'look', 'plan', 'teams', 'discord', 'mail', 'servers', 'phone'].every(k => links.includes(k)), links.join());
  check('core sections come first, in order', links.slice(0, 8).join() === 'lang,look,plan,teams,discord,mail,servers,phone', links.join());
  check('the index is visible and sticky', await page.evaluate(() => { const i = document.getElementById('setIndex'); const r = i.getBoundingClientRect(); return r.height > 0 && getComputedStyle(i).position === 'sticky'; }));
  check('Setup opens at the top', (await page.evaluate(() => window.scrollY)) < 5);
  const hsize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#sec-mail .set-h')).fontSize));
  check('a section heading is a real heading, bigger than body text', hsize >= 18, String(hsize));
  check('an old input is still there (mail address, phone host)', !!(await page.$('#mailAddr')) && !!(await page.$('#phHost')));

  await page.click('#setIndex a[data-sec="mail"]'); await sleep(500);
  const mailTop = await page.evaluate(() => document.getElementById('sec-mail').getBoundingClientRect().top);
  check('a link scrolls to its section', mailTop >= 0 && mailTop < 260 && (await page.evaluate(() => window.scrollY)) > 100, String(mailTop));
  // AIG-1148: one wizard button in its own box at the top, 'How agents work with you', checkbox labels not squeezed
  check('one wizard button, in a box above the index, not in the Language section', (await page.locator('#wzRun').count()) === 1 && (await page.locator('#sec-lang #wzRun').count()) === 0 && (await page.locator('#wizBox #wzRun').count()) === 1);
  check('the plan section is called How agents work with you', /How agents work with you/.test(await page.textContent('#sec-plan .set-h')) && /How agents work with you/.test(await page.textContent('#setIndex a[data-sec="plan"]')));
  const ck = await page.evaluate(() => { const l = document.getElementById('aiOwnList').closest('label'), sp = l.querySelector('span'); return { w: sp.getBoundingClientRect().width, lw: l.getBoundingClientRect().width, h: sp.getBoundingClientRect().height }; });
  check('a More settings checkbox label is not squeezed (one line, full width)', ck.h < 30 && ck.w > ck.lw * 0.8, JSON.stringify(ck));
  check('the address shows the section', (await page.evaluate(() => location.hash)) === '#/setup/mail');
  // AIG-1140: the bar follows the top bar's height and the heading lands fully below it
  await page.evaluate(() => { const h = document.querySelector('body > header'); h.style.paddingBottom = '60px'; }); await sleep(300);
  const bar = await page.evaluate(() => { const h = document.querySelector('body > header'), i = document.getElementById('setIndex'); return { hb: h.getBoundingClientRect().bottom, top: parseFloat(i.style.top), z: +getComputedStyle(i).zIndex, zh: +getComputedStyle(h).zIndex }; });
  check('the index bar sits under a taller top bar, not over it', Math.abs(bar.top - (bar.hb - 0)) < 2 || bar.top >= bar.hb - 2, JSON.stringify(bar));
  await page.click('#setIndex a[data-sec="teams"]'); await sleep(400);
  const gap = await page.evaluate(() => document.querySelector('#sec-teams .set-h').getBoundingClientRect().top - document.getElementById('setIndex').getBoundingClientRect().bottom);
  check('the section heading lands below the index bar', gap >= 0, String(gap));
  await page.evaluate(() => { document.querySelector('body > header').style.paddingBottom = ''; });

  // Deep link from another page lands on the section, and plain Setup is at the top again.
  await page.evaluate(() => { location.hash = '#/'; }); await sleep(400);
  await page.evaluate(() => { location.hash = '#/setup/servers'; });
  await page.waitForSelector('#sec-servers'); await sleep(1500);
  const srvTop = await page.evaluate(() => document.getElementById('sec-servers').getBoundingClientRect().top);
  check('#/setup/servers lands on the servers section', srvTop >= 0 && srvTop < 260, String(srvTop));
  await page.evaluate(() => { location.hash = '#/'; }); await sleep(400);
  await page.evaluate(() => { location.hash = '#/setup'; }); await page.waitForSelector('#setIndex'); await sleep(600);
  check('#/setup opens at the top', (await page.evaluate(() => window.scrollY)) < 5);

  // Phone pairing: numbered steps, one primary button, the scan line by the QR.
  const steps = await page.$$eval('#phSteps .ph-step .ph-n', n => n.map(x => x.textContent.trim()));
  check('phone pairing shows steps 1, 2, 3', steps.join() === '1,2,3', steps.join());
  const prim = await page.$$eval('#sec-phone button.primary', b => b.map(x => x.id));
  check('one clear primary button in the phone section', prim.join() === 'phPair', prim.join());
  await page.fill('#phHost', 'mypc.tail1234.ts.net');
  await page.click('#phPair'); await page.waitForSelector('#phLink');
  check('"Scan this with your phone" sits by the QR', /Scan this|Scan dit/.test(await page.textContent('#phSteps .ph-scan')) && !!(await page.$('#phSteps svg.phone-qr')));

  // AIG-1412: 💬 has Add a friend (All and People); it opens Setup at the paste-their-code box, in view and ready to type in.
  check('Friends is a Setup section in the index', await page.locator('#setIndex a[data-sec="friends"]').count() === 1 && await page.locator('#sec-friends').count() === 1);
  await page.evaluate(() => { location.hash = '#/'; }); await sleep(400);
  await page.click('#dmRail [data-dms]'); await page.waitForSelector('#dmPanel #dmAddFriend');
  check('💬 All shows Add a friend', /Add a friend/.test(await page.textContent('#dmAddFriend')));
  await page.click('#dmPanel [data-dmfilter="people"]'); await page.waitForSelector('#dmPanel #dmAddFriend');
  check('💬 People shows Add a friend above the friends', await page.evaluate(() => { const a = document.getElementById('dmAddFriend'), e = document.querySelector('#dmPanel .dm-empty, #dmPanel .dm-rowwrap'); return !e || !!(a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  await page.click('#dmAddFriend'); await page.waitForSelector('#addFriendBox #dmfCode', { timeout: 8000 }); await sleep(1600);
  const af = await page.evaluate(() => { const r = document.getElementById('dmfCode').getBoundingClientRect(), ix = document.getElementById('setIndex').getBoundingClientRect(); return { hash: location.hash, top: r.top, bottom: r.bottom, ixb: ix.bottom, h: innerHeight, focus: document.activeElement && document.activeElement.id, shut: document.getElementById('dmPanel').hidden, inFriends: !!document.querySelector('#sec-friends #addFriendBox') }; });
  check('Add a friend opens Setup > Friends with the paste box in view, below the index, ready to type, the 💬 panel out of the way', af.hash === '#/setup/addFriend' && af.inFriends && af.top >= af.ixb && af.bottom <= af.h && af.focus === 'dmfCode' && af.shut, JSON.stringify(af));
  if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/setupux-addfriend.png' }).catch(() => {});
  noErrors(page);
  await page.close();

  // Phone width, dark: no sideways scroll, index reachable.
  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  const pp = await openPage(ph, '#/setup');
  await pp.waitForSelector('#setIndex');
  await sleep(600);
  const fit = await pp.evaluate(() => ({ w: document.documentElement.scrollWidth, top: window.scrollY, i: document.getElementById('setIndex').getBoundingClientRect().height }));
  check('phone width: no sideways scroll, at the top, index visible', fit.w <= 390 && fit.top < 5 && fit.i > 0, JSON.stringify(fit));
  noErrors(pp);
  // ⧉ Pop out (AIG-1030): Setup in its own window, filling it; no button there
  const sp = await openPage(ctx, '#/setup'); await sp.waitForSelector('#setIndex');
  check('Setup has a Pop out button', (await sp.locator('#setupPop').count()) === 1);
  const [pw] = await Promise.all([ctx.waitForEvent('page'), sp.click('#setupPop')]);
  await pw.waitForSelector('#setIndex');
  check('#/pop-setup renders Setup alone, no header, no Pop out button', /pop-setup/.test(pw.url()) && !(await pw.isVisible('header')) && (await pw.locator('#setupPop').count()) === 0 && (await pw.locator('#sec-phone').count()) === 1, pw.url());
  await pw.click('#setIndex a[data-sec="mail"]'); await sleep(300);
  check('a section link in the pop-out stays in the pop-out', /pop-setup/.test(pw.url()), pw.url());
  await pw.close(); await sp.close();
  await ph.close();
}, true);
