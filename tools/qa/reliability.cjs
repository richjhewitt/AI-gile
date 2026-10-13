const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('node:assert/strict');
const http = require('http');
const { EventEmitter } = require('events');
const root = path.resolve(__dirname, '../..');
async function refreshTests() {
  const source = fs.readFileSync(path.join(root, 'public/js/core.js'), 'utf8');
  const section = source.slice(source.indexOf('let refreshPromise ='), source.indexOf('function renderBoardOnly()'));
  let route = { view: 'project', slug: 'alpha' }, abortedFirst = false;
  const calls = [], elements = new Map(), renders = [];
  const sandbox = {
    AbortController, i18n: { ready: true }, Boot: { failed: false, note: () => {} }, Phone: { blocked: false }, state: { editing: false },
    parseRoute: () => ({ ...route }),
    $: id => { if (!elements.has(id)) elements.set(id, { dataset: {}, firstElementChild: {} }); return elements.get(id); },
    api: (_, url, body, options) => {
      calls.push(url);
      return calls.length === 1 ? new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { abortedFirst = true; reject(new Error('cancelled')); })) : Promise.resolve({ slug: 'beta', cards: [] });
    },
    loadDocs: async () => {}, loadProfiles: async () => {}, renderSig: JSON.stringify,
    render: () => renders.push(sandbox.state.project?.slug), t: x => x, console
  };
  vm.createContext(sandbox); vm.runInContext(section, sandbox);
  const first = sandbox.refresh(true);
  await Promise.resolve();
  for (let i = 0; i < 20; i++) sandbox.refresh(false);
  route = { view: 'project', slug: 'beta' };
  sandbox.state.editing = true;
  sandbox.refresh(true);
  assert.equal(calls.length, 1, 'in-flight requests must not pile up');
  await Promise.race([first, new Promise((_, reject) => setTimeout(() => reject(Error('navigation waited for old request')), 250))]);
  assert(abortedFirst, 'navigation must cancel the pending read');
  assert.equal(sandbox.state.route.slug, 'beta');
  assert.equal(sandbox.state.project.slug, 'beta');
  assert.equal(sandbox.state.editing, true, 'editing changes during fetch survive commit');
  assert.deepEqual(calls, ['/api/projects/alpha', '/api/projects/beta']);
  assert.deepEqual(renders, ['beta'], 'stale project must never render');
  sandbox.api = async () => { throw new Error('offline'); };
  await sandbox.refresh(true);
  sandbox.api = async () => ({ slug: 'beta', cards: [] });
  await sandbox.refresh(true);
  assert.equal(sandbox.state.project.slug, 'beta', 'queue must recover from errors');
  console.log('PASS refresh: coalescing, stale navigation, editing preservation, error recovery');
}
async function streamTests() {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const section = source.slice(source.indexOf('function streamFile('), source.indexOf('const server = http.createServer'));
  const sandbox = { fs, send: (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); } };
  vm.createContext(sandbox); vm.runInContext(section, sandbox);
  const server = http.createServer((req, res) => {
    sandbox.streamFile(req.url === '/missing' ? path.join(__dirname, 'not-a-real-file.txt') : __filename, res, { 'Content-Type': 'text/plain' });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const missing = await fetch(base + '/missing');
    assert.equal(missing.status, 404); await missing.text();
    const healthy = await fetch(base + '/ok');
    assert.equal(healthy.status, 200); assert((await healthy.text()).includes('streamTests'));
    console.log('PASS stream: missing file returns 404 and subsequent request succeeds');
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
async function bodyTests() {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const section = source.slice(source.indexOf('function readBody('), source.indexOf('// Stream errors arrive'));
  const sandbox = { Buffer, bad: (message, code = 400) => Object.assign(new Error(message), { code }) };
  vm.createContext(sandbox); vm.runInContext(section, sandbox);
  const req = new EventEmitter(); req.complete = true;
  const promise = sandbox.readBody(req);
  const bytes = Buffer.from(JSON.stringify({ text: 'Hello 🦊 café' }));
  const cut = bytes.indexOf(Buffer.from('🦊')) + 2;
  req.emit('data', bytes.subarray(0, cut)); req.emit('data', bytes.subarray(cut)); req.emit('end');
  assert.equal((await promise).text, 'Hello 🦊 café');
  const aborted = new EventEmitter(); aborted.complete = false;
  const abortedResult = assert.rejects(sandbox.readBody(aborted), /request aborted/);
  aborted.emit('aborted'); await abortedResult;
  const oversized = new EventEmitter(); let destroyed = false;
  oversized.destroy = () => { destroyed = true; };
  const oversizedResult = assert.rejects(sandbox.readBody(oversized, 3), error => error.code === 413);
  oversized.emit('data', Buffer.from('1234')); await oversizedResult; assert(destroyed);
  console.log('PASS request bodies: split Unicode, aborted upload, byte limit');
}
async function metadataTests() {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const section = source.slice(source.indexOf('async function newest('), source.indexOf('const metadataReady ='));
  let fail = false;
  const sandbox = { STARTED: 100, PUBLIC: '/public', __dirname: '/root', __filename: '/root/server.js', path,
    fs: { promises: {
      readdir: async () => { if (fail) throw Error('temporary file access error'); return [{ name: 'test.js', isDirectory: () => false }, { name: 'removed.js', isDirectory: () => false }]; },
      stat: async file => { if (file.endsWith('removed.js')) throw Object.assign(Error('removed'), { code: 'ENOENT' }); return { mtimeMs: 200 }; }
    } }
  };
  vm.createContext(sandbox); vm.runInContext(section + ';globalThis.snapshot=()=>({build:build(),stale:stale()});', sandbox);
  await sandbox.refreshBuild();
  assert.equal(sandbox.snapshot().build, '100-200'); assert.equal(sandbox.snapshot().stale, true);
  fail = true; await sandbox.refreshBuild();
  assert.equal(sandbox.snapshot().build, '100-200', 'transient scan error preserves last good build');
  console.log('PASS metadata: removed entry tolerated, last good scan preserved');
}
(async () => { await refreshTests(); await streamTests(); await bodyTests(); await metadataTests(); })().catch(e => { console.error(e); process.exitCode = 1; });
