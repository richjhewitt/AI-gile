// AI-gile QA: starts its own server on a temp data folder and checks the API, the CLI and the page.
//   node tools/qa/qa.mjs [area ...]     (no args = all areas; --list shows them; QA_PORT changes the port)
// The page areas need playwright: `cd tools/qa && npm i`, or it falls back to the shared install (QA_PLAYWRIGHT).
// This file is the runner only. Shared helpers: lib.mjs. The areas themselves: areas/*.mjs (each calls def()).
import './hide-windows.mjs';   // no terminal windows popping up (AIG-391)
import fs from 'node:fs';
import { areas, CHROME, loadPw, startServer, check, sleep, setArea, getFailures } from './lib.mjs';

// Every file in areas/ registers its areas on import; add a new file here.
for (const f of ['api-cli', 'board', 'card', 'projects-docs', 'inbox', 'team-quiet-1-presence', 'team-quiet-2-quietinbox', 'team-quiet-3-watchman', 'team-quiet-4-light', 'team-quiet-5-runin', 'chats-dms', 'standup-tester', 'look-setup-1-look', 'look-setup-2-popout', 'look-setup-3-i18n', 'look-setup-4-glossary', 'share', 'dm-invite', 'ask', 'ideabtn', 'decide', 'pretend-friend', 'budget', 'notokens', 'join', 'dispatch', 'wizard', 'emoji', 'starter', 'teamroles', 'pack', 'lightbox', 'servers', 'platform', 'share-board', 'bump', 'plainnote', 'gifs', 'scrummaster', 'timed', 'helplevels', 'groups', 'inforead', 'badges', 'lifetasks', 'focus', 'undo', 'checklist', 'follow', 'phone', 'onelead', 'trusttester', 'pace', 'assumptions', 'assume', 'terminal']) await import(`./areas/${f}.mjs`);

// Run order (the order the areas were written in); a new area goes at the end.
const ORDER = ['api', 'cli', 'board', 'card', 'filters', 'inbox', 'inboxlive', 'usage', 'presence', 'quiet', 'quietinbox', 'poke', 'blocked', 'docs', 'mdlinks', 'newproject', 'perms', 'gobutton', 'attach', 'refresh', 'look', 'logos', 'guard', 'owner', 'setup', 'update', 'foryou', 'popout', 'popchat', 'columns', 'cardview', 'wip', 'lanes', 'quick', 'standup', 'views', 'steps', 'fynext', 'theme', 'i18n', 'chats', 'answerbtns', 'aitester', 'discover', 'dms', 'openit', 'testnotes', 'drafts', 'proof', 'queue', 'editor', 'runtokens', 'newscrum', 'dmchats', 'dmstore', 'share', 'ask', 'ideabtn', 'decide', 'bump', 'taskreply', 'plainnote', 'follow'];
for (const n of Object.keys(areas)) if (!ORDER.includes(n)) ORDER.push(n);
for (const n of ORDER) if (!areas[n]) throw new Error('area in ORDER but not defined: ' + n);

/* ---------- runner ---------- */
const args = process.argv.slice(2);
if (args.includes('--list')) { for (const n of ORDER) console.log(n.padEnd(10) + areas[n].doc); process.exit(0); }
const wanted = args.length ? args : ORDER;
for (const w of wanted) if (!areas[w]) { console.error('unknown area: ' + w + '  (try --list)'); process.exit(2); }

let browser = null;
for (const name of wanted) {
  setArea(name);
  const s = await startServer(areas[name].env);
  let ctx = null;
  try {
    if (areas[name].needsBrowser) {
      if (!browser) browser = await loadPw().chromium.launch({ executablePath: CHROME, headless: true });
      ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    }
    await areas[name].fn(s, ctx);
  } catch (e) {
    check('area ran to the end', false, String(e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    s.stop();
    await sleep(300);
    try { fs.rmSync(s.dir, { recursive: true, force: true }); } catch {}   // the temp data folder is not kept
  }
}
if (browser) await browser.close();
const failures = getFailures();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
