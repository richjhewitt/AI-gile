// Feature crawl (AIG-981): re-checks every feature on docs/features/features.json and writes docs/reports/crawl-YYYY-MM-DD.md.
//   node tools/crawl/crawl.mjs [--only <text>] [--json]      (CRAWL_PORT, default 4988; QA_PLAYWRIGHT as for the QA runner)
// One QA server (temp data folder, stub agent) answers the api, ui and cli checks; the qa checks run through tools/qa/qa.mjs once, at the end.
import '../qa/hide-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, CHROME, loadPw, startServer, mkProject, mkCard, pinAllInit, sleep } from '../qa/lib.mjs';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const oi = args.indexOf('--only'), only = oi >= 0 ? (args[oi + 1] || '').toLowerCase() : '';
const PORT = Number(process.env.CRAWL_PORT) || 4988;
const features = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'features', 'features.json'), 'utf8'));
const list = features.filter(f => !only || String(f.feature).toLowerCase().includes(only));
const results = list.map(f => ({ feature: f.feature, cards: f.cards || [], where: f.where || '', kind: f.check && f.check.kind || '', status: 'nocheck', ms: null, why: '', check: f.check }));
const today = new Date().toLocaleDateString('sv-SE');
// "search box" is a description, not a selector
const isSel = s => typeof s === 'string' && /^(text=|#|\.|\[|[a-z][a-z0-9]*([[.#:]|$))/i.test(s);
const timed = async (r, fn) => { const t = Date.now(); try { const v = await fn(); r.status = v === true ? 'pass' : 'fail'; if (v !== true) r.why = String(v); } catch (e) { r.status = 'fail'; r.why = String(e.message || e).split('\n')[0].slice(0, 200); } r.ms = Date.now() - t; };

// Which QA areas exist (an unknown name is "no check").
const qaPath = path.join(ROOT, 'tools', 'qa', 'qa.mjs');
const known = new Set(spawnSync(process.execPath, [qaPath, '--list'], { encoding: 'utf8', windowsHide: true }).stdout.split(/\r?\n/).map(l => l.split(/\s+/)[0]).filter(Boolean));

const s = await startServer({}, PORT);
let browser = null;
try {
  const proj = await mkProject(s, 'Crawl', 'CRW', { path: s.dir });
  const slug = proj.slug, card = await mkCard(s, slug, 'Crawl card', { openUrl: s.base + '/api/meta' }), id = card.id;
  const fill = t => String(t).replace(/:slug\b/g, slug).replace(/:id\b/g, id).replace(/\/p\/ai-gile\b/, '/p/' + slug);
  let ctx = null;
  for (const r of results) {
    const c = r.check;
    if (!c) continue;
    if (c.kind === 'api') {
      if (!c.path || !c.path.startsWith('/')) continue;
      await timed(r, async () => {
        const post = /^(POST|PUT|PATCH)$/i.test(c.method || '');
        const x = await fetch(s.base + fill(c.path), { method: c.method || 'GET', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: post ? '{}' : undefined });
        await x.arrayBuffer();
        return (x.status >= 200 && x.status < 400) || 'HTTP ' + x.status;
      });
    } else if (c.kind === 'cli') {
      if (!c.cmd) continue;
      const parts = c.cmd.split(/\s+/);
      await timed(r, async () => {
        let o;
        if (parts[0] === 'aigile') o = s.cli(parts.slice(1));
        else { const x = spawnSync(process.execPath, parts.slice(1), { cwd: ROOT, encoding: 'utf8', windowsHide: true, env: { ...process.env, AIGILE_URL: s.base } }); o = { code: x.status, err: (x.stderr || '').trim() }; }
        return o.code === 0 || `exit ${o.code} ${o.err.split('\n')[0]}`;
      });
    } else if (c.kind === 'ui') {
      const page = fill(c.page || '');
      if (!isSel(c.selector) || !page.startsWith('/')) continue;
      if (!browser) browser = await loadPw().chromium.launch({ executablePath: CHROME, headless: true });
      if (!ctx) {
        ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        await ctx.addInitScript(pinAllInit);
        await ctx.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); localStorage.setItem('aigile.homeMoreOpen', '1'); } catch {} });
      }
      await timed(r, async () => {
        const p = await ctx.newPage();
        try { await p.goto(s.base + page); await p.locator(c.selector).first().waitFor({ state: 'visible', timeout: 8000 }); return true; }
        catch (e) { return 'not visible within 8 s: ' + c.selector; }
        finally { await p.close().catch(() => {}); }
      });
    } else if (c.kind === 'qa') {
      if (c.area && known.has(c.area)) r.status = 'pending';
    }
  }
  if (ctx) await ctx.close().catch(() => {});
} finally {
  if (browser) await browser.close().catch(() => {});
  s.stop(); await sleep(500);
  try { fs.rmSync(s.dir, { recursive: true, force: true }); } catch {}
}

// qa checks: one child process for all the areas
const qaAreas = [...new Set(results.filter(r => r.status === 'pending').map(r => r.check.area))];
if (qaAreas.length) {
  const seen = {};   // area -> { fails: [lines] }
  let buf = '';
  const onLine = l => { const m = /^(PASS|FAIL)\s+([\w-]+):\s*(.*)$/.exec(l); if (!m) return; const a = seen[m[2]] ||= { fails: [] }; if (m[1] === 'FAIL') a.fails.push(m[3].slice(0, 160)); };
  await new Promise(res => {
    const ch = spawn(process.execPath, [qaPath, ...qaAreas], { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, QA_PORT: String(PORT + 1) } });
    ch.stdout.on('data', d => { buf += d; const ls = buf.split(/\r?\n/); buf = ls.pop(); ls.forEach(onLine); });
    ch.on('close', () => { if (buf) onLine(buf); res(); });
  });
  for (const r of results) {
    if (r.status !== 'pending') continue;
    const a = seen[r.check.area];
    if (!a) { r.status = 'fail'; r.why = 'qa area printed nothing'; }
    else if (a.fails.length) { r.status = 'fail'; r.why = a.fails[0]; }
    else r.status = 'pass';
  }
}

// report
const n = st => results.filter(r => r.status === st).length;
const slow = results.filter(r => r.status === 'pass' && ['api', 'cli', 'ui'].includes(r.kind) && r.ms > 2000);
const line = r => `- ${r.feature} (${r.cards.join(', ')}) - ${r.where}${r.ms != null ? ' - ' + r.ms + ' ms' : ''}${r.why ? ' - ' + r.why : ''}`;
const sect = (t, rs) => `\n## ${t} (${rs.length})\n\n${rs.length ? rs.map(line).join('\n') : 'none'}\n`;
const summary = `${n('pass')} pass, ${n('fail')} fail, ${n('nocheck')} no check, ${slow.length} slow`;
const md = `# Feature crawl ${today}\n\n${summary} (of ${results.length} features${only ? ', only "' + only + '"' : ''})\n` + sect('Fail', results.filter(r => r.status === 'fail')) + sect('No check', results.filter(r => r.status === 'nocheck')) + sect('Slow (>2 s)', slow) + sect('Pass', results.filter(r => r.status === 'pass'));
const dir = path.join(ROOT, 'docs', 'reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `crawl-${today}.md`), md);
if (wantJson) fs.writeFileSync(path.join(dir, `crawl-${today}.json`), JSON.stringify({ date: today, summary, results: results.map(({ check, ...r }) => r) }, null, 1));
console.log(summary);
for (const r of results.filter(r => r.status === 'fail')) console.log('FAIL ' + r.feature + ' (' + r.cards.join(', ') + '): ' + r.why);
process.exit(0);
