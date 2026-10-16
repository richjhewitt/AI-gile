// QA area: speed (AIG-1193). Page files go out gzipped with an ETag (a repeat load answers 304), and an idle page downloads little per tick.
import zlib from 'node:zlib';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib.mjs';
import { def, check, sleep, mkProject, mkCard, openPage, BASE } from '../lib.mjs';

def('pagespeed', 'page files are gzipped with an ETag and answer 304; an idle board page polls under 40 KB in 6 s (AIG-1193)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  for (let i = 0; i < 30; i++) await mkCard(s, 'alpha', 'Card ' + i, { description: 'text '.repeat(40) });
  const getRaw = (url, headers) => new Promise((res, rej) => http.get(url, { headers }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(c) })); }).on('error', rej));   // node's fetch would unpack the gzip for us
  const raw = await getRaw(BASE + '/js/core.js', { 'Accept-Encoding': 'identity' }), rawLen = raw.body.length;
  const gz = await getRaw(BASE + '/js/core.js', { 'Accept-Encoding': 'gzip' }), gzBuf = gz.body;
  check('a script is sent gzipped, much smaller than the file', gz.headers['content-encoding'] === 'gzip' && gzBuf.length < rawLen / 2, [gz.headers['content-encoding'], gzBuf.length, rawLen]);
  check('the gzip body unpacks to the same bytes', zlib.gunzipSync(gzBuf).equals(raw.body));
  const etag = gz.headers.etag;
  check('it carries an ETag and is revalidated, not stored blind', !!etag && /no-cache/.test(gz.headers['cache-control'] || ''), [etag, gz.headers['cache-control']]);
  const again = await fetch(BASE + '/js/core.js', { headers: { 'If-None-Match': etag, 'Accept-Encoding': 'gzip' } });
  check('a repeat request with the ETag answers 304 and no body', again.status === 304 && (await again.arrayBuffer()).byteLength === 0, again.status);
  const sw = await fetch(BASE + '/sw.js');
  check('the service worker file stays no-store', /no-store/.test(sw.headers.get('cache-control') || ''));

  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.card');
  let bytes = 0;
  page.on('response', async r => { try { if (r.url().includes('/api/')) bytes += (await r.body()).length; } catch {} });
  await sleep(2500); bytes = 0; await sleep(6000);
  check('an idle project page downloads under 40 KB in 6 s', bytes < 40000, bytes);
  await page.close();
}, true);

def('coldphone', 'cold phone first card: split scripts versus bundle, 150ms network and 4x CPU (AIG-1393)', async (s, ctx) => {
  await mkProject(s, 'Phone', 'PHN');
  const file = path.join(s.data, 'phone.json'), p = JSON.parse(fs.readFileSync(file, 'utf8'));
  p.cards = Array.from({ length: 1305 }, (_, i) => ({ id:'PHN-'+(i+1), title:'Work item '+i, status:i<1285?'done':'todo', type:'task', priority:'normal', created:new Date().toISOString(), updated:new Date().toISOString(), description:'Details '.repeat(100), comments:[{ author:'Dev', text:'Finished work.', at:new Date().toISOString() }] }));
  p.nextId=1306; fs.writeFileSync(file,JSON.stringify(p));
  const html = fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
  const app = fs.readFileSync(path.join(ROOT,'public/js/app.js'),'utf8').replace("    state.owner = m.owner || state.owner; state.ownerPic = m.ownerPic || ''; state.damaged = m.damaged || []; state.setupNeeded = !!m.setupNeeded;", '').replace('checkBuild(m);', 'checkBuild();').replace("refresh(true); if (!['home', 'inbox'].includes(parseRoute().view)) IB.load().catch(() => {}); Dms.reload().catch(() => {});",'await IB.load(true).catch(() => {}); await Dms.reload(); refresh(true);');
  const inbox = fs.readFileSync(path.join(ROOT,'public/js/inbox.js'),'utf8').replace('  window.Inbox =', '  IB.load().catch(() => {});\n  window.Inbox =');
  const streamer = fs.readFileSync(path.join(ROOT,'public/js/streamer.js'),'utf8').replaceAll('if (was !== o || (force && o))', 'if (was !== o || force)');
  const core = fs.readFileSync(path.join(ROOT,'public/js/core.js'),'utf8').replace('await Promise.all([loadDocs(state.route.slug, { signal: refreshController.signal }), loadProfiles({ signal: refreshController.signal })]);', 'await loadDocs(state.route.slug, { signal: refreshController.signal }); await loadProfiles({ signal: refreshController.signal });');
  const results = [];
  for (const split of [true,false]) {
    const c = await ctx.browser().newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
    const page = await c.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(() => { localStorage.setItem('aigile.theme','dark'); localStorage.setItem('aigile.standupAsked',new Date().toLocaleDateString('sv')); });
    if (split) {
      await page.route(BASE+'/',r=>r.fulfill({contentType:'text/html',body:html}));
      await page.route('**/js/app.js',r=>r.fulfill({contentType:'application/javascript',body:app}));
      await page.route('**/js/core.js',r=>r.fulfill({contentType:'application/javascript',body:core}));
      await page.route('**/js/streamer.js',r=>r.fulfill({contentType:'application/javascript',body:streamer}));
      await page.route('**/js/inbox.js',r=>r.fulfill({contentType:'application/javascript',body:inbox}));
    }
    const cd = await c.newCDPSession(page);
    await cd.send('Network.enable'); await cd.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cd.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8});
    await cd.send('Emulation.setCPUThrottlingRate',{rate:4});
    const start=Date.now(); await page.goto(BASE+'/#/p/phone',{waitUntil:'commit'});
    await page.waitForSelector('.board .card',{timeout:60000});
    const ms=Date.now()-start;
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize})));
    const result={mode:split?'before':'after',ms,requests:resources.length,scripts:resources.filter(r=>/\/js\/.*\.js$/.test(r.url)).length,project:resources.filter(r=>/\/api\/projects\/phone$/.test(r.url)).length,inbox:resources.filter(r=>/\/api\/inbox(?:\?|$)/.test(r.url)).length,wireBytes:resources.reduce((n,r)=>n+r.bytes,0)};
    results.push(result); console.log('PHONE '+JSON.stringify(result));
    check(result.mode+' has no script errors',!errors.length,errors);
    if(!split) {
      check('one ordered script bundle replaces 125 script requests',result.scripts===1,result);
      check('inbox is fetched once before first card',result.inbox===1,result);
      check('project is fetched once before first card',result.project===1,result);
      const shots='C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots';
      fs.mkdirSync(shots,{recursive:true}); await page.evaluate(() => document.querySelector('.card')?.scrollIntoView({ block:'nearest', inline:'nearest' })); await page.screenshot({path:path.join(shots,'AIG-1393.png')});
    }
    await c.close();
  }
  check('bundled first paint uses fewer requests',results[1].requests<results[0].requests,results);
  check('bundled cold phone reaches its first card sooner',results[1].ms<results[0].ms,results);
  const response=await fetch(BASE+'/js/board-bundle.js'), etag=response.headers.get('etag');
  check('bundle revalidates with 304',!!etag && (await fetch(BASE+'/js/board-bundle.js',{headers:{'If-None-Match':etag}})).status===304);
  const home = await ctx.newPage(); let inboxReads=0;
  home.on('request',r => { if(new URL(r.url()).pathname==='/api/inbox') inboxReads++; });
  await home.goto(BASE+'/#/'); await home.waitForSelector('.proj');
  check('Home also shares its first inbox read',inboxReads===1,inboxReads);
  let projectReads=0; const beforeInbox=inboxReads;
  home.on('request',r => { if(new URL(r.url()).pathname==='/api/projects/phone') projectReads++; });
  await home.route('**/api/inbox', async r => { await sleep(200); await r.continue(); });
  await home.route('**/api/projects/phone', async r => { await sleep(200); await r.continue(); });
  await home.evaluate(() => Promise.all([
    IB.load(true), IB.load(true), IB.load(),
    PagePoll.get('/api/projects/phone', { force:true }), PagePoll.get('/api/projects/phone', { force:true }),
  ]));
  check('concurrent forced inbox callers await one read',inboxReads-beforeInbox===1,inboxReads-beforeInbox);
  check('concurrent forced project callers await one read',projectReads===1,projectReads);
  await home.close();
}, true);
