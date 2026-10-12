// QA area: badges (AIG-396), the free 🎨 badge maker: animal + colour + accessory drawn as SVG, set from the CLI or the team table,
// and dealt at random (no AI choosing) on the lowest plan or in No Token Mode.
import { BASE, check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('badges', '🎨 badge maker: SVG served, aigile avatar badge sets one and lists the parts, bad parts refused, random badge on the 🪰 plan / No Token Mode (no brief invite), owner changes a badge in the team table (AIG-396)', async (s, ctx) => {
  await mkProject(s, 'Zoo', 'ZOO');
  const lib = await s.ok('GET', '/api/avatars');
  check('about 20 animals, 12 colours, 10 accessories', lib.badge.animals.length >= 20 && lib.badge.colours.length === 12 && lib.badge.accessories.length === 10, [lib.badge.animals.length, lib.badge.colours.length, lib.badge.accessories.length]);
  const r = await fetch(BASE + '/api/avatars/badge/fox/teal/glasses');
  const body = await r.text();
  check('the badge is served as an SVG', r.status === 200 && /image\/svg\+xml/.test(r.headers.get('content-type')) && body.startsWith('<svg') && body.includes('#3bb3b0'), body.slice(0, 80));
  check('every animal and accessory draws', (await Promise.all(lib.badge.animals.map(a => fetch(`${BASE}/api/avatars/badge/${a}/blue/none`).then(x => x.status)))).every(c => c === 200) && (await Promise.all(lib.badge.accessories.map(a => fetch(`${BASE}/api/avatars/badge/cat/pink/${a}`).then(x => x.status)))).every(c => c === 200));
  check('an unknown badge is a 404', (await fetch(BASE + '/api/avatars/badge/dodo/teal/none')).status === 404);

  // The brief invites a new member to choose (not on the cheapest plan), the list explains the maker.
  await s.ok('POST', '/api/setup', { prefs: { plan: 'normal' } });
  check('the brief invites a picture when spend is open', /Pick a picture that suits you/.test(s.cli(['brief', 'zoo']).out));
  const list = s.cli(['avatar', 'zoo', '--as', 'Pixel']).out;
  check('aigile avatar lists the maker', /Badge maker/.test(list) && /animals: .*fox/.test(list) && /accessories: .*glasses/.test(list), list);
  const set = s.cli(['avatar', 'zoo', 'badge', 'fox', 'teal', 'glasses', '--as', 'Pixel']);
  check('aigile avatar badge sets one', /badge:fox\/teal\/glasses/.test(set.out), set);
  const mem = async n => ((await s.ok('GET', '/api/projects/zoo')).team.find(m => m.name === n) || {}).avatar;
  check('stored on the roster entry', (await mem('Pixel')) === 'badge:fox/teal/glasses');
  check('a bad badge is refused', s.cli(['avatar', 'zoo', 'badge', 'dodo', 'teal', 'glasses', '--as', 'Pixel']).code !== 0 && (await mem('Pixel')) === 'badge:fox/teal/glasses');

  // Spend guard: lowest plan, then No Token Mode.
  await s.ok('POST', '/api/setup', { prefs: { plan: 'fly' } });
  check('the brief does not invite on the 🪰 plan', !/Pick a picture/.test(s.cli(['brief', 'zoo']).out));
  await s.ok('POST', '/api/projects/zoo/team', { name: 'Fly1', status: '🔄 working' });
  check('a new member gets a random badge on the 🪰 plan', /^badge:[a-z]+\/[a-z]+\/[a-z]+$/.test(await mem('Fly1')), await mem('Fly1'));
  await s.ok('POST', '/api/setup', { prefs: { plan: 'normal' } });
  await s.ok('POST', '/api/notokens', { on: true });
  await s.ok('POST', '/api/projects/zoo/team', { name: 'Quiet1', status: '🔄 working' });
  check('and in No Token Mode', /^badge:/.test(await mem('Quiet1')), await mem('Quiet1'));
  check('no brief invite in No Token Mode', !/Pick a picture/.test(s.cli(['brief', 'zoo']).out));
  await s.ok('POST', '/api/notokens', { on: false });

  // The page: shown in the team table, the owner changes one in the Badge maker.
  const page = await openPage(ctx, '#/p/zoo');
  await page.waitForSelector('.side table img.face');
  check('the team table shows the badge', (await page.getAttribute('.side table img.face >> nth=0', 'src')).includes('/api/avatars/badge/'));
  await page.click('.bm-btn');
  await page.waitForSelector('.bm-dlg');
  await page.selectOption('#bm-who', 'Pixel');
  await page.click('.bm-opt[data-k="a"][data-v="owl"]');
  await page.click('.bm-opt[data-k="c"][data-v="purple"]');
  await page.click('.bm-opt[data-k="x"][data-v="crown"]');
  check('the preview follows the clicks', (await page.getAttribute('#bm-prev', 'src')) === '/api/avatars/badge/owl/purple/crown');
  await page.click('.bm-dlg .primary');
  await page.waitForSelector('.bm-dlg', { state: 'detached' });
  check('the owner changed the badge', (await mem('Pixel')) === 'badge:owl/purple/crown');
  noErrors(page);
}, true);
