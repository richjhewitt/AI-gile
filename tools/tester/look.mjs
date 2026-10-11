// AI tester's eyes (AIG-163): open a page, do a few steps, print what is on it in a few lines, save one screenshot.
// Cheap on tokens: the tester reads the printed text first and only looks at the screenshot when it must.
//
//   node tools/tester/look.mjs <url> [steps...] [--text "css"] [--shot out.png] [--lines 40]
//   steps, in order:  --click "visible text or css"   --fill "css=value"   --press Enter   --goto url   --wait 500
//
// Prints: the page title, any page errors, then the visible text of --text (default: the whole page), trimmed.
// Needs playwright: `npm i` in tools/qa, or set QA_PLAYWRIGHT to a playwright package path (like the QA does).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const loadPw = () => {
  for (const p of ['playwright', '../qa/node_modules/playwright', process.env.QA_PLAYWRIGHT].filter(Boolean)) { try { return require(p); } catch {} }
  console.error('playwright not found: run npm i in tools/qa, or set QA_PLAYWRIGHT'); process.exit(2);
};

const args = process.argv.slice(2), url = args.shift();
if (!url || url === '--help') { console.log('usage: node tools/tester/look.mjs <url> [--click X] [--fill css=value] [--press Key] [--goto url] [--wait ms] [--text css] [--shot out.png] [--lines N]'); process.exit(url ? 0 : 2); }
const steps = [], opt = { text: 'body', shot: '', lines: 40 };
for (let i = 0; i < args.length; i += 2) {
  const k = args[i].replace(/^--/, ''), v = args[i + 1];
  if (k in opt) opt[k] = v; else steps.push([k, v]);
}

const { chromium } = loadPw();
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let code = 0;
try {
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(800);
  for (const [k, v] of steps) {
    if (k === 'click') {
      // What a person would click: exact button, link or text first, then a button or text containing it, then css.
      const tries = [page.getByRole('button', { name: v, exact: true }), page.getByRole('link', { name: v, exact: true }), page.getByText(v, { exact: true }), page.getByRole('button', { name: v }), page.getByText(v)];
      let hit = null;
      for (const l of tries) { const f = l.filter({ visible: true }).first(); if (await f.count().catch(() => 0)) { hit = f; break; } }
      await (hit || page.locator(v).first()).click({ timeout: 5000 });
    } else if (k === 'fill') { const at = v.indexOf('='); await page.fill(v.slice(0, at), v.slice(at + 1), { timeout: 5000 }); }
    else if (k === 'press') await page.keyboard.press(v);
    else if (k === 'goto') await page.goto(v, { waitUntil: 'load' });
    else if (k === 'wait') { await page.waitForTimeout(+v || 500); continue; }
    else throw new Error('unknown step --' + k);
    await page.waitForTimeout(600);
  }
} catch (e) { console.log('STEP FAILED: ' + e.message.split('\n')[0]); code = 1; }
console.log('TITLE: ' + await page.title());
console.log('URL: ' + page.url());
if (errors.length) console.log('PAGE ERRORS: ' + errors.slice(0, 5).join(' | ').slice(0, 600));
const text = await page.locator(opt.text).first().innerText({ timeout: 3000 }).catch(e => 'NO SUCH ELEMENT: ' + opt.text);
const lines = text.split('\n').map(l => l.trim()).filter(Boolean), n = +opt.lines || 40;
console.log('TEXT (' + lines.length + ' lines' + (lines.length > n ? ', first ' + n : '') + '):\n' + lines.slice(0, n).map(l => l.slice(0, 160)).join('\n'));
if (opt.shot) { await page.screenshot({ path: opt.shot }); console.log('SHOT: ' + opt.shot); }
await browser.close();
process.exit(code);
