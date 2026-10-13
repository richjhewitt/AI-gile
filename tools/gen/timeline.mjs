#!/usr/bin/env node
// Writes site/timeline.json for the teaser timeline (AIG-778, AIG-779).
// Run: node tools/gen/timeline.mjs   (needs the board on AIGILE_URL, default http://localhost:4321)
// Real dates only: the first chat's timestamp (never its text), the first git commit, and done cards' dates.
// Planned stages come from To do and backlog cards, grouped the same way, with no dates.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_BASE = process.env.AIGILE_URL || 'http://localhost:4321';
const SLUG = 'ai-gile';
const OUT = path.join(ROOT, 'site', 'timeline.json');

// Done stages: first matching rule wins. `line` is the one-line summary shown on the page.
const DONE = [
  { id: 'first-board', name: 'First board', line: 'A board that tracks its own build: cards, columns, drag and drop, projects.', test: c => /^M[0-3]$/.test(c.sprint) },
  { id: 'night-watch', name: 'Night watch', line: 'A watchman and Scrum Master keep the teams on task while you sleep.', re: /night|watchman|scrum master|tidy the for you/i },
  { id: 'ai-tester', name: 'AI tester', line: 'A tester checks every hand-over first and shows what it saw.', re: /\btesters?\b|ai test/i },
  { id: 'usage-saver', name: 'Usage saver', line: 'Measure what runs cost, keep the code lean, save your limit.', re: /token|usage|saver|🪶/i },
  { id: 'languages', name: 'Languages', line: 'Every screen text in a language file, with Dutch and Flemish first.', re: /🌍|language|dutch|flemish|glossary/i },
  { id: 'friends', name: 'Friends and sharing', line: 'Private DMs, a scrambled relay, invites, roles and shared projects.', re: /friend|shar(e|ing)|\bdms?\b|relay|invite|roles?\b|people|mate|encrypt/i },
  { id: 'team-roles', name: 'Team and roles', line: 'Agent profiles, team templates, spaces and who does what.', re: /profile|template|team|spaces?\b|🪐|lead|stand-?ups?|topics/i },
  { id: 'install', name: 'Install and releases', line: 'A zip a friend can install, self-updates, channels and roll back.', re: /install|zip|release|F1\b|update|restart|setup|wizard/i },
  { id: 'streaming', name: 'Chat and streaming', line: 'Discord, Twitch, OBS, streamer mode, GIFs and emojis.', re: /discord|twitch|obs\b|stream|gif|emoji|chat/i },
  { id: 'no-ai', name: 'No AI edition', line: 'A board for people who code without AI, and public boards.', re: /no[ -]ai|licen[cs]e|public/i },
  { id: 'website', name: 'The website', line: 'aigile.lol, the teaser and this timeline.', re: /aigile\.lol|teaser|\bsite\b|dns|domain|timeline|stats/i },
  // Cards that match no stage (small fixes, chat notes) are left out of the stages.
  { id: 'other', name: '', line: '', re: /./ },
];

// Planned stages: no dates promised.
const PLANNED = [
  { id: 'p-android', name: 'Phone and Android', line: 'Reach your board from a phone, then a native Android app.', re: /android|phone|pwa|linux/i },
  { id: 'p-engines', name: 'More AI engines', line: 'Pick Claude, Codex or Gemini per agent.', re: /codex|gemini|copilot|cursor|engine/i },
  { id: 'p-languages', name: 'More languages', line: 'More than a hundred languages, and an immersion mode for learners.', re: /🌍|language|immersion/i },
  { id: 'p-pro', name: 'Pro practice', line: 'Risk labels, merge gates, incident cards and guard rails.', re: /pro practice|incident|guard rail/i },
  { id: 'p-livestream', name: 'Streaming extras', line: 'Twitch chat, custom emojis and a public live view.', re: /twitch|emoji|public live|obs/i },
  { id: 'p-self', name: 'Looking after you', line: 'Tired mode, self-care reminders and 4:20.', re: /tired|self-care|4:20/i },
  { id: 'p-servers', name: 'Servers and scale', line: 'Global server settings, roles and planning for growth.', re: /server|scaling|ssh|sudo|role:/i },
  { id: 'p-release', name: 'Alpha and beyond', line: 'Closed alpha, the live site, then beta.', re: /alpha|beta|release|aigile\.lol|teaser|roadmap|licence|feedback/i },
  { id: 'p-more', name: 'Everything else', line: 'Smaller ideas still waiting their turn.', re: /./ },
];

async function firstChat() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  const dirs = fs.readdirSync(base).filter(d => /^c--users-rich-desktop-bots--n--code-stuff-ai-gile/i.test(d));
  let best = null;
  for (const d of dirs) {
    const dir = path.join(base, d);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, f)), crlfDelay: Infinity });
      let n = 0;
      for await (const line of rl) {
        if (++n > 200) break;
        try { const t = JSON.parse(line).timestamp; if (t && (!best || t < best)) best = t; } catch {}
      }
      rl.close();
    }
  }
  return best && new Date(best).toISOString();
}

const firstCommit = () => new Date(execFileSync('git', ['log', '--reverse', '--format=%aI'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n')[0]).toISOString();

const res = await fetch(`${URL_BASE}/api/projects/${SLUG}`);
if (!res.ok) { console.error('board not reachable: ' + res.status); process.exit(1); }
const cards = (await res.json()).cards;
const iso = s => new Date(s).toISOString();

const chat = await firstChat();
const commit = firstCommit();
const done = cards.filter(c => c.status === 'done');
const groups = new Map(DONE.map(r => [r.id, []]));
for (const c of done) groups.get(DONE.find(r => (r.test ? r.test(c) : r.re.test(c.title))).id).push(c);

const stages = [];
for (const r of DONE) {
  const g = groups.get(r.id); if (!g.length || !r.name) continue;
  // Cards get touched again later, so use when they were made: the 5th to 95th percentile keeps odd ones out.
  const t = g.map(c => c.created).sort(), at = p => t[Math.min(t.length - 1, Math.floor(p * t.length))];
  const start = at(0.05), end = at(0.95);
  stages.push({ id: r.id, name: r.name, start: iso(start), end: iso(end), cards: g.length, line: r.line });
}
// The first real commit opens the first board; everything else follows by start time.
const first = stages.find(s => s.id === 'first-board');
if (first && commit < first.start) first.start = commit;
stages.sort((a, b) => a.start.localeCompare(b.start));
if (chat) stages.unshift({ id: 'first-idea', name: 'The first idea', start: chat, end: commit, cards: 0, line: 'The very first conversation, before any code existed.' });

const pg = new Map(PLANNED.map(r => [r.id, []]));
for (const c of cards.filter(c => c.status === 'todo' || c.status === 'backlog')) pg.get(PLANNED.find(r => r.re.test(c.title)).id).push(c);
const planned = PLANNED.filter(r => pg.get(r.id).length).map(r => ({ id: r.id, name: r.name, cards: pg.get(r.id).length, line: r.line, planned: true }))
  .sort((a, b) => b.cards - a.cards);

const out = { generated: new Date().toISOString(), stages, planned };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)}: ${out.stages.length} stages, ${planned.length} planned`);
