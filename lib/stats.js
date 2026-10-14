// Project stats (AIG-726/727): plain-code numbers for one project's #/stats page. No AI, no tokens.
// A card counts as done on the day it was last updated (there is no separate done date).
const { execFile } = require('child_process');
const { load } = require('./store');
const GIT_MS = 5 * 60e3, gitCache = {};
const day = t => { const d = new Date(t); if (isNaN(d)) return ''; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayNo = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const mondayOf = s => { const [y, m, d] = s.split('-').map(Number), x = new Date(y, m - 1, d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return day(x); };

// Commits and lines changed from git log --shortstat in the project's folder; cached for five minutes.
function gitStats(folder) {
  return new Promise(res => {
    if (!folder) return res(null);
    const hit = gitCache[folder];
    if (hit && Date.now() - hit.at < GIT_MS) return res(hit.v);
    execFile('git', ['log', '--shortstat', '--pretty=format:@@'], { cwd: folder, windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 20000 }, (err, out) => {
      let v = null;
      if (!err) {
        v = { commits: 0, added: 0, removed: 0, lines: 0 };
        for (const l of String(out).split(/\r?\n/)) {
          if (l === '@@') v.commits++;
          else { const a = /(\d+) insertion/.exec(l), r = /(\d+) deletion/.exec(l); if (a) v.added += +a[1]; if (r) v.removed += +r[1]; }
        }
        v.lines = v.added + v.removed;
      }
      gitCache[folder] = { at: Date.now(), v };
      res(v);
    });
  });
}

function compute(p) {
  const cards = p.cards || [], done = cards.filter(c => c.status === 'done');
  const perDay = {};
  for (const c of done) { const d = day(c.updated); if (d) perDay[d] = (perDay[d] || 0) + 1; }
  const days = Object.keys(perDay).sort();
  let best = null, streak = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev !== null && dayNo(d) - prev === 1 ? run + 1 : 1; prev = dayNo(d);
    if (run > streak) streak = run;
    if (!best || perDay[d] > perDay[best]) best = d;
  }
  // Cards done in each of the last 12 weeks (Monday to Sunday), oldest first.
  const weeks = [], [y, m, d0] = mondayOf(day(Date.now())).split('-').map(Number);
  for (let i = 11; i >= 0; i--) weeks.push({ week: day(new Date(y, m - 1, d0 - 7 * i)), done: 0 });
  for (const d of days) { const w = weeks.find(x => x.week === mondayOf(d)); if (w) w.done += perDay[d]; }
  let most = null;
  for (const c of cards) { const n = (c.comments || []).length; if (n && (!most || n > most.comments)) most = { id: c.id, title: c.title, comments: n }; }
  const made = cards.map(c => day(c.created)).filter(Boolean).sort();
  return {
    project: p.name, slug: p.slug,
    done: done.length, made: cards.length,
    comments: cards.reduce((n, c) => n + (c.comments || []).length, 0),
    busiestDay: best ? { day: best, done: perDay[best] } : null,
    longestStreak: streak,
    firstCard: made[0] || '',
    weeks,
    records: { mostComments: most, biggestDay: best ? { day: best, done: perDay[best] } : null },
  };
}

async function stats(slug) {
  const p = load(slug);
  if (!p) return null;
  const out = compute(p);
  out.git = await gitStats(p.path);
  return out;
}
module.exports = { stats, compute };
