// Import without AI (AIG-340): starter cards for an existing repo from plain file and git reads. No tokens, so it
// works in ⛔ No Token Mode. README to-do items and roadmap bullets, TODO/FIXME lines, the last commit subjects as
// one "Recently done" card, unmerged branches, and a "Wake the team" hint. Every card is marked "from import".
// Only one line per item is kept (never file contents), and anything share.js's scrub flags is dropped.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { now } = require('./store');

const CAP = 25, TITLE = 80;
const git = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8', windowsHide: true, timeout: 8000, maxBuffer: 4e6 }); return r.status === 0 ? (r.stdout || '').trim() : ''; };
const one = s => String(s || '').replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim();
const cut = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[\s,;:.\-]+$/, '') + '…';

const TXT = {
  en: { mark: 'From import', done: 'Recently done', doneIn: n => `The last ${n} commits, grouped here`, branch: 'Branch', branchD: 'An open branch that is not merged yet',
    readme: 'From the README', todo: 'TODO in', fixme: 'FIXME in', wake: 'Wake the team',
    wakeD: 'Press "Wake the team" (top right) so the team reads this folder and the cards here, and turns them into a plan. These starter cards came from a plain script, no AI used.' },
  nl: { mark: 'Uit import', done: 'Onlangs klaar', doneIn: n => `De laatste ${n} commits, hier gegroepeerd`, branch: 'Branch', branchD: 'Een open branch die nog niet is samengevoegd',
    readme: 'Uit de README', todo: 'TODO in', fixme: 'FIXME in', wake: 'Wek het team',
    wakeD: 'Druk op "Wek het team" (rechtsboven) zodat het team deze map en de kaarten hier leest en er een plan van maakt. Deze startkaarten komen van een gewoon script, zonder AI.' },
};
TXT['nl-BE'] = { ...TXT.nl, wakeD: TXT.nl.wakeD.replace('rechtsboven', 'rechts bovenaan') };

function readmeItems(dir) {
  const f = ['README.md', 'readme.md', 'Readme.md'].map(n => path.join(dir, n)).find(x => fs.existsSync(x));
  if (!f) return [];
  const buf = fs.readFileSync(f), text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  const out = []; let plan = false;
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const h = /^#{1,6}\s+(.*)/.exec(raw);
    if (h) { plan = /\b(to-?do|roadmap|planned|plans|next|ideas|wish ?list|backlog|nog te doen|gepland)\b/i.test(h[1]); continue; }
    const box = /^\s*[-*]\s+\[ \]\s+(.+)/.exec(raw), item = plan && /^\s*[-*]\s+(?!\[x\])(.+)/i.exec(raw);
    const t = one((box || item || [])[1]);
    if (t.length > 2) out.push(t);
  }
  return out;
}

function todoLines(dir) {
  const out = git(dir, 'grep', '-n', '-I', '-E', '--no-color', '(TODO|FIXME)[:( ]', '--', '.', ':!*.md', ':!*.lock', ':!package-lock.json', ':!.env*', ':!*.min.*');
  const items = [];
  for (const l of out.split(/\r?\n/)) {
    const m = /^([^:]+):(\d+):(.*)$/.exec(l); if (!m) continue;
    const k = /(TODO|FIXME)[:( ]\s*\)?:?\s*(.*)/.exec(m[3]); if (!k) continue;
    if (require("./share").scrub({ line: m[3] }, { path: dir }).length) continue;   // a secret on the same line: skip the whole item
    const text = one(k[2].replace(/(\*\/|-->)\s*$/, '')); if (text.length < 3) continue;
    items.push({ kind: k[1], file: m[1], line: m[2], text });
  }
  return items;
}

// Starter card specs for a folder, most useful first, capped. lang: en, nl or nl-BE.
function build(dir, lang) {
  const T = TXT[lang] || TXT.en, cards = [];
  const add = (title, description, status, type, priority) => cards.push({ title: '📥 ' + cut(one(title), TITLE), description: T.mark + (description ? '\n\n' + description : ''), status, type, priority });
  const drafts = [];   // [title, description, status, type, priority]
  if (fs.existsSync(path.join(dir, '.git'))) {
    const subj = git(dir, 'log', '-20', '--no-merges', '--format=%s').split(/\r?\n/).map(s => cut(one(s), 100)).filter(Boolean);
    if (subj.length) drafts.push([T.done, T.doneIn(subj.length) + '\n\n' + subj.map(s => '- ' + s).join('\n'), 'done', 'task', 'low']);
  }
  drafts.push([T.wake, T.wakeD, 'todo', 'task', 'high']);
  if (fs.existsSync(path.join(dir, '.git'))) {
    for (const b of git(dir, 'branch', '--no-merged', 'HEAD', '--format=%(refname:short)').split(/\r?\n/).filter(b => b && !/^worktree-|^\(/.test(b)).slice(0, 5))
      drafts.push([T.branch + ': ' + b, T.branchD, 'backlog', 'task', 'normal']);
    for (const x of todoLines(dir).slice(0, 8)) drafts.push([x.text, (x.kind === 'FIXME' ? T.fixme : T.todo) + ' ' + x.file + ':' + x.line, 'backlog', x.kind === 'FIXME' ? 'bug' : 'task', x.kind === 'FIXME' ? 'high' : 'normal']);
  }
  for (const r of readmeItems(dir).slice(0, 8)) drafts.push([r, T.readme, 'backlog', 'task', 'normal']);
  // Never import secrets: drop any card the share scrub flags (paths, key files, tokens).
  const { scrub } = require('./share');
  for (const d of drafts) {
    if (cards.length >= CAP) break;
    if (scrub({ title: d[0], description: d[1] }, { path: dir }).length) continue;
    add(...d);
  }
  return cards;
}

// Adds the cards to a project (once: a project that already has imported cards is left alone).
function importStarter(p, lang) {
  if (!p.path || !fs.existsSync(p.path)) return { added: 0 };
  if (p.cards.some(c => c.from === 'import')) return { added: 0, already: true };
  const at = now(), specs = build(p.path, lang);
  for (const s of specs) p.cards.push({ id: p.key + '-' + p.nextId++, title: s.title, description: s.description, testSteps: '', type: s.type, priority: s.priority, status: s.status,
    assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: '', from: 'import', created: at, updated: at, comments: [] });
  return { added: specs.length };
}

module.exports = { build, importStarter, CAP };
