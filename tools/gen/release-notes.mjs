#!/usr/bin/env node
// Writes docs/releases/<version>.md: the done cards since the last tag, grouped like the timeline, and what is still open (AIG-977).
// Run: node tools/gen/release-notes.mjs [version] [since-tag]   (defaults v0.42 and v0.1; needs the board on AIGILE_URL, default http://localhost:4321)
// A card's date is its last update, so a card edited after it was done can move into a later release.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DONE, PLANNED } from './stages.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_BASE = process.env.AIGILE_URL || 'http://localhost:4321';
const SLUG = 'ai-gile';
const [VERSION = 'v0.42', SINCE = 'v0.1'] = process.argv.slice(2);
const SHOW = 12;   // titles per stage; the rest are counted

const since = new Date(execFileSync('git', ['log', '-1', '--format=%aI', SINCE], { cwd: ROOT, encoding: 'utf8' }).trim());
const res = await fetch(`${URL_BASE}/api/projects/${SLUG}?full=1`);
if (!res.ok) { console.error(`board answered ${res.status} on ${URL_BASE}`); process.exit(1); }
const cards = (await res.json()).cards;
const chore = c => /^(💬|📣|🧹)/u.test(c.title);   // DMs, stand-ups and tidy-ups are not features
const done = cards.filter(c => c.status === 'done' && !chore(c) && new Date(c.updated) >= since);
const open = cards.filter(c => c.status === 'todo' || c.status === 'backlog');
const groupBy = (rules, list) => { const g = new Map(rules.map(r => [r.id, []])); for (const c of list) g.get(rules.find(r => (r.test ? r.test(c) : r.re.test(c.title))).id).push(c); return g; };
const day = d => new Date(d).toISOString().slice(0, 10);

const out = [`# ${VERSION}: release notes`, '', `- ${done.length} cards done since ${SINCE} (${day(since)}), written ${day(Date.now())}`, '', '## What\'s new'];
const dg = groupBy(DONE, done);
for (const r of DONE) {
  const list = dg.get(r.id).sort((a, b) => a.updated.localeCompare(b.updated));
  if (!list.length) continue;
  out.push('', `### ${r.name || 'Smaller fixes'} (${list.length})`);
  if (r.line) out.push('', r.line);
  out.push('', ...list.slice(0, SHOW).map(c => `- ${c.title} (${c.id})`));
  if (list.length > SHOW) out.push(`- and ${list.length - SHOW} more`);
}
out.push('', '## Still to come', '', `- ${open.length} cards in To do and the backlog`);
const pg = groupBy(PLANNED, open);
for (const r of PLANNED) if (pg.get(r.id).length) out.push(`- **${r.name}** (${pg.get(r.id).length}): ${r.line}`);

const file = path.join(ROOT, 'docs', 'releases', `${VERSION}.md`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, out.join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, file)}: ${done.length} done, ${open.length} open`);
