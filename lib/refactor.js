// 🧹 Refactor offer (AIG-98): for each project with a folder, find the big source files (over 400 lines) that every agent
// change has to read, and estimate what a split saves and costs. Plain code, no AI: line counts times rough tokens a line.
// Accepting makes the work as small cards, one per big file: either in a new "Refactor <name>" project per project, or all in
// one "Refactor" project. Each new project sits inside the one it tidies (a space), with no folder of its own.
const fs = require('fs');
const path = require('path');
const { listSlugs, load, save, now, bad } = require('./store');

const BIG = 400, TOK_PER_LINE = 12, READS_PER_WEEK = 20, SPLIT_COST_PER_LINE = 60;
const EXT = /\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|kt|cs|php|rb|swift|css|scss|html|vue|svelte)$/i;
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'vendor', 'data', 'coverage', '.claude', 'worktrees']);

// The big files in a folder (at most 2,000 files looked at, 6 levels deep).
function bigFiles(dir) {
  const found = []; let seen = 0;
  const walk = (d, depth) => {
    if (depth > 6 || seen > 2000) return;
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') && e.name !== '.') { if (e.isDirectory()) continue; }
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, depth + 1); continue; }
      if (!EXT.test(e.name) || /\.min\./.test(e.name)) continue;
      seen++;
      let size = 0; try { size = fs.statSync(p).size; } catch {}
      if (size > 3e6) continue;
      let lines = 0; try { lines = fs.readFileSync(p, 'utf8').split('\n').length; } catch {}
      if (lines > BIG) found.push({ file: path.relative(dir, p).replace(/\\/g, '/'), lines });
    }
  };
  walk(dir, 0);
  return found.sort((a, b) => b.lines - a.lines).slice(0, 30);
}
function estimate(files) {
  const extra = files.reduce((n, f) => n + (f.lines - BIG), 0);
  return { savedPerWeek: extra * TOK_PER_LINE * READS_PER_WEEK, cost: files.reduce((n, f) => n + f.lines, 0) * SPLIT_COST_PER_LINE };
}

function offer() {
  return listSlugs().map(load).filter(p => p && !p.archived && p.path && fs.existsSync(p.path)).map(p => {
    const files = bigFiles(p.path);
    return { slug: p.slug, name: p.name, files, ...estimate(files) };
  }).filter(x => x.files.length);
}

// { slugs: [...], mode: 'each' | 'one' } -> the projects made, with their cards.
function accept(b) {
  const want = new Set(Array.isArray(b && b.slugs) ? b.slugs.map(String) : []);
  const mode = b && b.mode === 'one' ? 'one' : 'each';
  const list = offer().filter(x => want.has(x.slug));
  if (!list.length) throw bad('pick at least one project with big files');
  const made = [];
  const mk = (name, parent) => {   // no folder of its own: two projects on one folder would share a team
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'refactor', n = 2;
    while (load(slug)) slug = slug.replace(/-\d+$/, '') + '-' + n++;
    const taken = new Set(listSlugs().map(load).filter(Boolean).map(o => o.key));
    let key = 'RF'; for (let i = 1; taken.has(key); i++) key = 'RF' + i;
    const p = { slug, name, key, description: 'Splitting big files so each change reads one small file (AIG-98).', path: '', ...(parent ? { parent } : {}), created: now(), updated: now(), nextId: 1, archived: false, cards: [], team: [], log: [] };
    save(p); made.push(p); return p;
  };
  const card = (p, x, f) => {
    const at = now();
    p.cards.push({ id: p.key + '-' + p.nextId++, title: `Split ${f.file} (${f.lines} lines)` + (mode === 'one' ? ` in ${x.name}` : ''),
      description: `- Project: ${x.name}\n\n- Split it by its sections into files under ${BIG} lines\n\n- No behaviour change; update the code map`,
      testSteps: `- Nothing to click: the project's tests pass and no file over ${BIG} lines is left from this one`, type: 'task', priority: 'normal', status: 'backlog',
      assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: 'Refactor offer', created: at, updated: at, comments: [] });
  };
  if (mode === 'one') { const p = mk('Refactor', ''); for (const x of list) for (const f of x.files) card(p, x, f); save(p); }
  else for (const x of list) { const p = mk('Refactor ' + x.name, x.slug); for (const f of x.files) card(p, x, f); save(p); }   // 🪐 inside the project it tidies
  return { made: made.map(p => ({ slug: p.slug, name: p.name, cards: p.cards.length })) };
}

module.exports = { offer, accept, bigFiles, estimate, BIG };
