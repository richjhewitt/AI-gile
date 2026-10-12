// AI-gile DM relay (AIG-112): passes sealed messages between boards. Standalone: Node only, no packages,
// and nothing from the rest of AI-gile, so this one file can be copied to a server.
//   node relay.js     (RELAY_PORT default 4500, RELAY_HOST default 0.0.0.0, RELAY_DATA default ./data next to this file)
//
// What it sees: envelopes addressed to random mailbox ids, already encrypted and signed by the sending board,
// and each mailbox owner's public signing key (to check that only the owner collects). No names, no text, no
// other keys. It never logs requests.
//   POST /m/:box           drop a sealed envelope in a mailbox (anyone; the mailbox must have been claimed)
//   GET  /m/:box           the owner collects pending envelopes (signed request; the first one claims the mailbox)
//   POST /m/:box/ack       the owner deletes what it collected: { rids } (signed)
//   GET  /health
// Signed requests carry x-relay-key (Ed25519 public key, base64url), x-relay-ts (ms), x-relay-nonce and x-relay-sig:
// an Ed25519 signature over "aigile-relay-v1\n<METHOD>\n<path>\n<ts>\n<nonce>\n<sha256 hex of the body>".
// Envelopes are deleted as soon as the owner acks them, else after 7 days (big ones, over 1 MB: after 48 hours).
// Nothing else is kept: no copies, no logs, no temp files (an envelope is one file, written in place and unlinked on ack/expiry).
//   Public boards (AIG-602..605): a board publishes a clean snapshot of a project that its owner made Public.
//   POST   /b/:name          publish the snapshot (signed; the first key to publish claims the name, only that key can update it)
//   DELETE /b/:name          the owner makes it private again: the snapshot is deleted at once (signed)
//   GET    /b/:name          a read-only page anyone can open (one self-contained HTML file, no external scripts)
//   GET    /b/:name.json     the snapshot and the number of viewers; 404 once private
//   GET    /b/:name/live     server-sent events: each new snapshot, and the viewer count
//   One snapshot per name (up to 256 KB), kept in DATA/pub/<name>/. It holds what the board chose to publish (card ids, titles,
//   types, priorities, assignees, team names), nothing else. Viewers need no login.
//   Business licence applications (AIG-601):
//   POST /apply            { company, website, what, how, email }: one file in DATA/apply/ (5 per hour per address, 8 KB at most)
//   GET  /apply            the applications, only if RELAY_STATS_KEY is set and the request is signed by it (the operator's board)
//   POST /bug              { title, text, build, channel }: a Live tester's bug report (10 per hour per address, 8 KB at most)
//   GET  /bug, POST /bug/ack { ids }: the operator's board collects reports and deletes them (signed by RELAY_STATS_KEY)
//   GET  /stats            { envelopes, bytes }: only if RELAY_STATS_KEY (the operator's public signing key) is set, and signed by it
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.RELAY_PORT) || 4500;
const HOST = process.env.RELAY_HOST || '0.0.0.0';
const DATA = path.resolve(process.env.RELAY_DATA || path.join(__dirname, 'data'));
const MAX_BODY = 12 * 1024 * 1024;                       // one envelope (attachments later)
const KEEP_MS = (Number(process.env.RELAY_KEEP_HOURS) || 7 * 24) * 3600e3;          // unacked envelopes are deleted after 7 days
const BIG_BYTES = Number(process.env.RELAY_BIG_BYTES) || 1024 * 1024;               // an envelope over this size ...
const BIG_KEEP_MS = (Number(process.env.RELAY_BIG_KEEP_HOURS) || 48) * 3600e3;      // ... is deleted after 48 hours
const STATS_KEY = process.env.RELAY_STATS_KEY || '';
const SKEW_MS = 2 * 60e3;                                 // a signed request is only good for 2 minutes
const RATE = Number(process.env.RELAY_RATE) || 300;       // requests per minute per IP
const BOX_MAX = 500, BOX_BYTES = Number(process.env.RELAY_BOX_BYTES) || 50 * 1024 * 1024;      // per mailbox
const TOTAL_BYTES = Number(process.env.RELAY_MAX_BYTES) || 2 * 1024 ** 3;
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.RELAY_TRUST_PROXY || '');   // behind a reverse proxy: use X-Forwarded-For

const isBox = s => /^[A-Za-z0-9_-]{16,64}$/.test(s);
const isRid = s => /^\d{13}-[0-9a-f]{16}$/.test(s);
const sha256 = d => crypto.createHash('sha256').update(d).digest('hex');
const fail = (msg, code) => Object.assign(new Error(msg), { code });
const boxDir = box => path.join(DATA, box);

fs.mkdirSync(DATA, { recursive: true });

/* ---------- storage ---------- */
// DATA/<box>/owner.json: { key } (the owner's public signing key); DATA/<box>/<ms>-<hex>.json: one envelope.
// An envelope's age is in its name. Expired ones (7 days; big ones 48 hours) are deleted whenever a mailbox is looked at.
const expired = (f, size) => Date.now() - Number(f.split('-')[0]) > (size > BIG_BYTES ? BIG_KEEP_MS : KEEP_MS);
const envFiles = box => {
  let names; try { names = fs.readdirSync(boxDir(box)).filter(f => isRid(f.slice(0, -5)) && f.endsWith('.json')).sort(); } catch { return []; }
  return names.filter(f => {
    const file = path.join(boxDir(box), f), n = sizeOf(file);
    if (!expired(f, n)) return true;
    try { fs.unlinkSync(file); used -= n; count--; } catch {}
    return false;
  });
};
const ownerIn = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8')).key; } catch { return null; } };
const ownerOf = box => ownerIn(boxDir(box));
const sizeOf = f => { try { return fs.statSync(f).size; } catch { return 0; } };
var used = 0, count = 0;   // bytes and envelopes held across all mailboxes
function sweep() {
  used = 0; count = 0;
  for (const box of fs.readdirSync(DATA).filter(isBox)) for (const f of envFiles(box)) { used += sizeOf(path.join(boxDir(box), f)); count++; }
}

/* ---------- rate limit and replay protection ---------- */
const hits = new Map();   // ip -> { start, n }
function limited(ip) {
  const t = Date.now(), h = hits.get(ip);
  if (!h || t - h.start > 60e3) { hits.set(ip, { start: t, n: 1 }); return false; }
  return ++h.n > RATE;
}
const nonces = new Map();   // key + nonce -> time seen
setInterval(() => {
  const t = Date.now();
  for (const [ip, h] of hits) if (t - h.start > 60e3) hits.delete(ip);
  for (const [n, at] of nonces) if (t - at > 2 * SKEW_MS) nonces.delete(n);
}, 30e3).unref();

// A request from the mailbox owner: valid signature, fresh timestamp, unused nonce. The first signed request claims an unclaimed mailbox.
function owner(req, box, pathname, body, onlyKey) {
  const h = n => String(req.headers[n] || '');
  const key = h('x-relay-key'), ts = h('x-relay-ts'), nonce = h('x-relay-nonce'), sig = h('x-relay-sig');
  if (!/^[A-Za-z0-9_-]{43}$/.test(key) || !/^\d{13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^[A-Za-z0-9_-]{86}$/.test(sig)) throw fail('sign the request', 401);
  if (Math.abs(Date.now() - Number(ts)) > SKEW_MS) throw fail('the request is too old (or the clock is wrong)', 401);
  let pub;
  try { pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key }, format: 'jwk' }); } catch { throw fail('bad key', 401); }
  const msg = ['aigile-relay-v1', req.method, pathname, ts, nonce, sha256(body)].join('\n');
  if (!crypto.verify(null, Buffer.from(msg), pub, Buffer.from(sig, 'base64url'))) throw fail('bad signature', 401);
  if (nonces.has(key + nonce)) throw fail('that request was already used', 401);
  nonces.set(key + nonce, Date.now());
  if (onlyKey) { if (key !== onlyKey) throw fail('not allowed', 403); return; }   // the operator's /stats
  const pubSlot = box && typeof box === 'object', dir = pubSlot ? box.dir : boxDir(box), known = ownerIn(dir);   // a public name passes { dir }
  if (known && known !== key) throw fail(pubSlot ? 'that name belongs to another board' : 'not your mailbox', 403);
  if (!known) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ key }));
  }
}

/* ---------- http ---------- */
function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let n = 0;
    req.on('data', d => {
      n += d.length;
      if (n > limit) { reject(fail('too big (' + (limit >= 1048576 ? Math.round(limit / 1048576) + ' MB' : Math.round(limit / 1024) + ' KB') + ' at most)', 413)); req.pause(); return; }
      parts.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function handle(req, res) {
  const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
  if (limited(ip)) throw fail('slow down', 429);
  const { pathname } = new URL(req.url, 'http://relay');
  if (req.method === 'GET' && pathname === '/health') return send(res, 200, { ok: true });
  if (req.method === 'GET' && pathname === '/stats' && STATS_KEY) { owner(req, null, pathname, '', STATS_KEY); sweep(); return send(res, 200, { envelopes: count, bytes: used }); }
  if (pathname.startsWith('/b/')) return board(req, res, pathname, ip);
  if (pathname === '/apply') return apply(req, res, pathname, ip);
  if (pathname === '/bug' || pathname === '/bug/ack') return bugs(req, res, pathname, ip);   // 🐞 Live testers (AIG-561)
  const m = pathname.match(/^\/m\/([^/]+)(\/ack)?$/);
  if (!m || !isBox(m[1])) throw fail('not found', 404);
  const box = m[1], ack = !!m[2];
  if (req.headers['content-length'] && Number(req.headers['content-length']) > MAX_BODY) throw fail('too big (12 MB at most)', 413);
  const body = req.method === 'POST' ? await readBody(req) : '';

  // Drop an envelope: only checks the outside (it is addressed to this mailbox); the inside is sealed.
  if (req.method === 'POST' && !ack) {
    let env;
    try { env = JSON.parse(body); } catch { throw fail('send an envelope as JSON', 400); }
    if (!env || typeof env !== 'object' || Array.isArray(env) || env.to !== box || typeof env.ct !== 'string' || typeof env.sig !== 'string') throw fail('not an envelope for this mailbox', 400);
    if (!ownerOf(box)) throw fail('no such mailbox (yet)', 404);
    const files = envFiles(box);
    const bytes = files.reduce((a, f) => a + sizeOf(path.join(boxDir(box), f)), 0);
    if (files.length >= BOX_MAX || bytes + body.length > BOX_BYTES || used + body.length > TOTAL_BYTES) throw fail('mailbox full', 507);
    const rid = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(path.join(boxDir(box), rid + '.json'), body);
    used += Buffer.byteLength(body); count++;
    return send(res, 201, { ok: true });
  }
  // Collect: the owner gets what is waiting (up to 100 envelopes / 24 MB per call).
  if (req.method === 'GET' && !ack) {
    owner(req, box, pathname, '');
    const envelopes = [];
    let bytes = 0;
    for (const f of envFiles(box).slice(0, 100)) {
      let text; try { text = fs.readFileSync(path.join(boxDir(box), f), 'utf8'); } catch { continue; }
      if (envelopes.length && bytes + text.length > 24 * 1024 * 1024) break;
      bytes += text.length;
      try { envelopes.push({ rid: f.slice(0, -5), env: JSON.parse(text) }); } catch {}
    }
    return send(res, 200, { envelopes });
  }
  // Ack: delete what was collected.
  if (req.method === 'POST' && ack) {
    owner(req, box, pathname, body);
    let rids;
    try { rids = JSON.parse(body).rids; } catch {}
    if (!Array.isArray(rids)) throw fail('send { rids }', 400);
    let deleted = 0;
    for (const rid of rids.slice(0, 1000)) {
      if (!isRid(String(rid))) continue;
      const f = path.join(boxDir(box), rid + '.json'), n = sizeOf(f);
      try { fs.unlinkSync(f); deleted++; used -= n; count--; } catch {}
    }
    return send(res, 200, { deleted });
  }
  throw fail('not found', 404);
}

/* ---------- public boards (AIG-602..605) ---------- */
const PUB = path.join(DATA, 'pub');
const SNAP_MAX = 256 * 1024;                              // one snapshot
const NAME_MAX = 5000;                                    // names claimed on this relay
const isName = s => /^[a-z0-9][a-z0-9-]{2,39}$/.test(s);
const pubDir = name => path.join(PUB, name);
const viewers = new Map();                                // name -> Set of open /live responses
const perIp = new Map();                                  // ip -> open /live count
const lastPub = new Map();                                // name -> last publish time (one every 2 s at most)
let live = 0;
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
// The relay trusts the board only for who it is, never for the shape of the snapshot: it keeps a short list of fields.
function cleanSnap(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send a snapshot as JSON', 400);
  const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, n).filter(x => x && typeof x === 'object');
  return {
    v: 1, title: str(o.title, 80), at: new Date().toISOString(),
    columns: list(o.columns, 12).map(c => ({ id: str(c.id, 30), label: str(c.label, 40) })),
    cards: list(o.cards, 3000).map(c => ({ id: str(c.id, 20), title: str(c.title, 200), type: str(c.type, 12), priority: str(c.priority, 12), status: str(c.status, 30), assignee: str(c.assignee, 60) })),
    team: list(o.team, 50).map(m => ({ name: str(m.name, 60), role: str(m.role, 60), avatar: /^https:\/\/[^\s"'<>]{1,300}$/.test(String(m.avatar || '')) ? String(m.avatar) : '' })),
  };
}
const readSnap = name => { try { return JSON.parse(fs.readFileSync(path.join(pubDir(name), 'snap.json'), 'utf8')); } catch { return null; } };
const watching = name => (viewers.get(name) || new Set()).size;
function push(name, event, data) {
  for (const r of viewers.get(name) || []) { try { r.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch {} }
}
setInterval(() => { for (const set of viewers.values()) for (const r of set) { try { r.write(': \n\n'); } catch {} } }, 25e3).unref();

async function board(req, res, pathname, ip) {
  const m = pathname.match(/^\/b\/([a-z0-9-]+)(\.json|\/live)?$/);
  if (!m || !isName(m[1])) throw fail('not found', 404);
  const name = m[1], kind = m[2] || '';
  if (req.method === 'GET' && !kind) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    return res.end(PAGE.replace('__NAME__', name));
  }
  if (req.method === 'GET' && kind === '.json') {
    const s = readSnap(name);
    if (!s) throw fail('This board is private now', 404);
    return send(res, 200, { ...s, name, viewers: watching(name) });
  }
  if (req.method === 'GET' && kind === '/live') {
    if (live >= 2000 || (perIp.get(ip) || 0) >= 20) throw fail('too many viewers', 429);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    if (!viewers.has(name)) viewers.set(name, new Set());
    viewers.get(name).add(res); live++; perIp.set(ip, (perIp.get(ip) || 0) + 1);
    const s = readSnap(name);
    res.write('retry: 3000\n\n');
    res.write(s ? 'event: snapshot\ndata: ' + JSON.stringify({ ...s, name, viewers: watching(name) }) + '\n\n' : 'event: private\ndata: {}\n\n');
    push(name, 'viewers', { viewers: watching(name) });
    req.on('close', () => {
      const set = viewers.get(name); if (set) { set.delete(res); if (!set.size) viewers.delete(name); }
      live--; perIp.set(ip, Math.max(0, (perIp.get(ip) || 1) - 1));
      push(name, 'viewers', { viewers: watching(name) });
    });
    return;
  }
  if (kind) throw fail('not found', 404);
  // Publish and make private: signed by the board; the first key claims the name.
  if (req.method === 'POST' || req.method === 'DELETE') {
    if (req.headers['content-length'] && Number(req.headers['content-length']) > SNAP_MAX) throw fail('too big (256 KB at most)', 413);
    const body = req.method === 'POST' ? await readBody(req, SNAP_MAX) : '';
    if (!fs.existsSync(pubDir(name)) && fs.existsSync(PUB) && fs.readdirSync(PUB).length >= NAME_MAX) throw fail('this relay has no names left', 507);
    owner(req, { dir: pubDir(name) }, pathname, body);
    if (req.method === 'DELETE') {
      try { fs.unlinkSync(path.join(pubDir(name), 'snap.json')); } catch {}
      push(name, 'private', {});
      return send(res, 200, { ok: true, viewers: watching(name) });
    }
    if (Date.now() - (lastPub.get(name) || 0) < 1500) throw fail('slow down', 429);
    lastPub.set(name, Date.now());
    let o; try { o = JSON.parse(body); } catch { throw fail('send a snapshot as JSON', 400); }
    const snap = cleanSnap(o), text = JSON.stringify(snap);
    const file = path.join(pubDir(name), 'snap.json');
    fs.writeFileSync(file + '.tmp', text); fs.renameSync(file + '.tmp', file);
    push(name, 'snapshot', { ...snap, name, viewers: watching(name) });
    return send(res, 201, { ok: true, viewers: watching(name) });
  }
  throw fail('not found', 404);
}
// The read-only page: no external scripts or styles; text only goes in with textContent; a picture only from an https address.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Board</title><style>
:root{--bg:#f4f5f7;--card:#fff;--text:#1d2430;--muted:#667085;--line:#d9dde4;--accent:#3b82f6}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--card:#1f242c;--text:#e6e9ee;--muted:#98a2b3;--line:#323946;--accent:#60a5fa}}
*{box-sizing:border-box}body{margin:0;font:15px system-ui,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}.muted{color:var(--muted);font-size:13px}.team{display:flex;gap:6px;flex-wrap:wrap}.who{display:inline-flex;gap:5px;align-items:center;font-size:12px;border:1px solid var(--line);border-radius:99px;padding:2px 8px;background:var(--card)}
.who img{width:18px;height:18px;border-radius:50%}main{display:flex;gap:12px;padding:14px;overflow-x:auto;align-items:flex-start}
.col{flex:0 0 240px;background:color-mix(in srgb,var(--card) 60%,transparent);border:1px solid var(--line);border-radius:10px;padding:8px;min-height:80px}
.col h2{font-size:13px;margin:2px 4px 8px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.c{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:14px}
.c.bug{border-left-color:#ef4444}.c.feature{border-left-color:var(--accent)}.c.task{border-left-color:#8b5cf6}
.c .id{font-size:11px;color:var(--muted)}.c .m{font-size:12px;color:var(--muted);margin-top:4px}.c.new{animation:pop .9s ease}
@keyframes pop{0%{box-shadow:0 0 0 3px var(--accent)}100%{box-shadow:0 0 0 0 transparent}}
#msg{padding:40px 16px;text-align:center;font-size:18px}[hidden]{display:none!important}
@media (max-width:600px){.col{flex-basis:80vw}}
</style></head><body>
<header><h1 id="t">Board</h1><span class="muted" id="v"></span><span class="team" id="team"></span></header>
<div id="msg" hidden></div><main id="cols"></main>
<script>
(function(){
var name="__NAME__",$=function(i){return document.getElementById(i)},pos={},first=true,es;
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function gone(){$("cols").textContent="";$("team").textContent="";$("t").textContent="Board";$("v").textContent="";$("msg").hidden=false;$("msg").textContent="This board is private now."}
function draw(s){
  $("msg").hidden=true;$("t").textContent=s.title||name;document.title=(s.title||name)+" (live)";
  $("v").textContent=s.viewers!=null?(s.viewers+(s.viewers===1?" viewer":" viewers")):"";
  var tm=$("team");tm.textContent="";(s.team||[]).forEach(function(m){var w=el("span","who");if(m.avatar){var i=el("img");i.src=m.avatar;i.alt="";i.referrerPolicy="no-referrer";i.onerror=function(){i.remove()};w.appendChild(i)}w.appendChild(el("span",null,m.name+(m.role?" · "+m.role:"")));tm.appendChild(w)});
  var before={};document.querySelectorAll(".c").forEach(function(c){before[c.dataset.id]=c.getBoundingClientRect()});
  var main=$("cols");main.textContent="";var now={};
  (s.columns||[]).forEach(function(col){
    var d=el("section","col");d.appendChild(el("h2",null,col.label));
    (s.cards||[]).filter(function(c){return c.status===col.id}).forEach(function(c){
      var e=el("div","c "+c.type);e.dataset.id=c.id;e.dataset.col=col.id;e.appendChild(el("div","id",c.id));e.appendChild(el("div",null,c.title));
      var m=[c.priority!=="normal"?c.priority:"",c.assignee].filter(Boolean).join(" · ");if(m)e.appendChild(el("div","m",m));
      d.appendChild(e);now[c.id]=col.id});
    main.appendChild(d)});
  document.querySelectorAll(".c").forEach(function(c){
    var b=before[c.dataset.id],r=c.getBoundingClientRect();
    if(!first&&!b){c.classList.add("new")}
    else if(b&&(Math.abs(b.left-r.left)>2||Math.abs(b.top-r.top)>2)){
      c.style.transition="none";c.style.transform="translate("+(b.left-r.left)+"px,"+(b.top-r.top)+"px)";c.style.position="relative";c.style.zIndex=2;c.classList.add("new");
      requestAnimationFrame(function(){requestAnimationFrame(function(){c.style.transition="transform .6s ease";c.style.transform="none"})})}});
  first=false;pos=now}
function start(){
  es=new EventSource("/b/"+name+"/live");
  es.addEventListener("snapshot",function(e){draw(JSON.parse(e.data))});
  es.addEventListener("viewers",function(e){var n=JSON.parse(e.data).viewers;$("v").textContent=n+(n===1?" viewer":" viewers")});
  es.addEventListener("private",gone);
}
fetch("/b/"+name+".json").then(function(r){if(!r.ok){gone();return null}return r.json()}).then(function(s){if(s){draw(s)}start()}).catch(start);
})();
</script></body></html>`;

/* ---------- business licence applications (AIG-601) ---------- */
const APPLY = path.join(DATA, 'apply');
const applyHits = new Map();   // ip -> times in the last hour
async function apply(req, res, pathname, ip) {
  res.setHeader('Access-Control-Allow-Origin', '*');   // the licence form lives on the website, not on the relay
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end(); }
  if (req.method === 'GET') {
    if (!STATS_KEY) throw fail('not found', 404);
    owner(req, null, pathname, '', STATS_KEY);
    let names = []; try { names = fs.readdirSync(APPLY).filter(f => /^\d{13}-[0-9a-f]{16}\.json$/.test(f)).sort(); } catch {}
    const items = [];
    for (const n of names.slice(-500)) { try { items.push({ id: n.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(APPLY, n), 'utf8')) }); } catch {} }
    return send(res, 200, { applications: items });
  }
  if (req.method !== 'POST') throw fail('not found', 404);
  const now = Date.now(), recent = (applyHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 5) throw fail('too many applications from here: try again later', 429);
  const body = await readBody(req, 8 * 1024);
  let o; try { o = JSON.parse(body); } catch { throw fail('send the application as JSON', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send the application as JSON', 400);
  const a = { company: str(o.company, 120), website: str(o.website, 200), what: str(o.what, 1000), how: str(o.how, 1000), email: str(o.email, 160) };
  if (!a.company || !a.what || !a.how) throw fail('company, what you do and how it helps the world are needed', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) throw fail('a valid email is needed', 400);
  let have = 0; try { have = fs.readdirSync(APPLY).length; } catch {}
  if (have >= 2000) throw fail('the list is full', 507);
  fs.mkdirSync(APPLY, { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(path.join(APPLY, id + '.json'), JSON.stringify({ ...a, at: new Date().toISOString() }), { mode: 0o600 });
  recent.push(now); applyHits.set(ip, recent);
  return send(res, 201, { ok: true });
}

// 🐞 Bug reports from Live testers (AIG-561): a tester's board posts one; the operator's board collects them (signed with
// RELAY_STATS_KEY, like /apply), files each as a card on its own board and acks it, which deletes it here.
const BUGS = path.join(DATA, 'bugs');
const bugHits = new Map();   // ip -> times in the last hour
const BUG_ID = /^\d{13}-[0-9a-f]{16}$/;
async function bugs(req, res, pathname, ip) {
  if (req.method === 'GET' || pathname === '/bug/ack') {
    if (!STATS_KEY) throw fail('not found', 404);
    const body = req.method === 'POST' ? await readBody(req, 64 * 1024) : '';
    owner(req, null, pathname, body, STATS_KEY);
    if (req.method === 'POST') {
      let ids = []; try { ids = JSON.parse(body).ids || []; } catch {}
      for (const id of [].concat(ids).slice(0, 500)) if (BUG_ID.test(String(id))) fs.rmSync(path.join(BUGS, id + '.json'), { force: true });
      return send(res, 200, { ok: true });
    }
    let names = []; try { names = fs.readdirSync(BUGS).filter(f => BUG_ID.test(f.slice(0, -5)) && f.endsWith('.json')).sort(); } catch {}
    const items = [];
    for (const n of names.slice(0, 200)) { try { items.push({ id: n.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(BUGS, n), 'utf8')) }); } catch {} }
    return send(res, 200, { bugs: items });
  }
  if (req.method !== 'POST' || pathname !== '/bug') throw fail('not found', 404);
  const now = Date.now(), recent = (bugHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 10) throw fail('too many reports from here: try again later', 429);
  const body = await readBody(req, 8 * 1024);
  let o; try { o = JSON.parse(body); } catch { throw fail('send the report as JSON', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send the report as JSON', 400);
  const b = { title: str(o.title, 140), text: String(o.text == null ? '' : o.text).slice(0, 4000), build: str(o.build, 40), channel: str(o.channel, 20) };
  if (!b.title && !b.text) throw fail('a title or some text is needed', 400);
  let have = 0; try { have = fs.readdirSync(BUGS).length; } catch {}
  if (have >= 5000) throw fail('the list is full', 507);
  fs.mkdirSync(BUGS, { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(path.join(BUGS, id + '.json'), JSON.stringify({ ...b, at: new Date().toISOString() }), { mode: 0o600 });
  recent.push(now); bugHits.set(ip, recent);
  return send(res, 201, { ok: true });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    const known = typeof e.code === 'number';   // our own errors; anything else is not described (no paths leak)
    if (e.code === 413) res.setHeader('Connection', 'close');
    send(res, known ? e.code : 500, { error: known ? e.message : 'relay error' });
  });
});
server.requestTimeout = 60e3;
sweep();
setInterval(sweep, 3600e3).unref();
server.listen(PORT, HOST, () => console.log(`AI-gile relay on ${HOST}:${PORT}, data in ${DATA}`));
