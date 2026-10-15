// Timed cards (AIG-385): a card with a "come back at" time (c.timedUntil) is out of the owner's way and the team's `next` until then.
// Built on the same idea as Wait and see (snoozedUntil, which the team's news clears); a timer is not cleared by comments, only by the time or by Clear.
// Every minute the board looks for timers that have run out: the card is un-timed, goes to the top of For you / the inbox (bumpedAt),
// and a card in the team column wakes its team.
const S = () => require('./store');

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// "2026-10-12 14:00", "+2h", "+30m", "+1d", "tomorrow 9:00", "today 17:30", "mon 14:00". Local time. Returns an ISO string or null.
function parseWhen(input, base = new Date()) {
  const s = String(input || '').trim().toLowerCase();
  let m;
  if ((m = s.match(/^\+\s*(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs|hours?|d|days?)$/))) {
    const n = parseFloat(m[1]), u = m[2][0];
    return new Date(base.getTime() + n * (u === 'm' ? 60e3 : u === 'h' ? 3600e3 : 86400e3)).toISOString();
  }
  const time = t => { const x = t && t.match(/^(\d{1,2})(?::(\d{2}))?$/); return x && +x[1] < 24 && +(x[2] || 0) < 60 ? [+x[1], +(x[2] || 0)] : null; };
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{1,2}(?::\d{2})?))?$/))) {
    const hm = m[4] ? time(m[4]) : [9, 0];
    if (!hm) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], hm[0], hm[1], 0, 0);
    return isNaN(d) ? null : d.toISOString();
  }
  if ((m = s.match(/^(today|tomorrow|[a-z]{3})(?:\s+(\d{1,2}(?::\d{2})?))?$/))) {
    const hm = m[2] ? time(m[2]) : [9, 0];
    if (!hm) return null;
    const d = new Date(base);
    if (m[1] === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (m[1] !== 'today') {
      const w = DAYS.indexOf(m[1]); if (w < 0) return null;
      d.setDate(d.getDate() + ((w - d.getDay() + 7) % 7 || 7));
    }
    d.setHours(hm[0], hm[1], 0, 0);
    return d.toISOString();
  }
  return null;
}

// One pass: bring back what has run out. Returns the cards it brought back.
function tick() {
  const back = [];
  for (const slug of S().listSlugs()) {
    let p; try { p = S().load(slug); } catch { continue; }
    if (!p || p.archived) continue;
    const due = p.cards.filter(c => c.timedUntil && c.timedUntil <= S().now());
    const nag = p.cards.filter(c => require('./life').repeat(c));   // AIG-813: every-N-minutes reminders on life cards
    if (!due.length && !nag.length) continue;
    let wake = false;
    for (const c of due) {
      const at = S().now();
      delete c.timedUntil;
      c.bumpedAt = at; c.bumps = (c.bumps || 0) + 1;   // top of For you / the inbox
      c.updated = at;
      if (c.status === 'team') { c.comments.push({ author: 'Timer', wake: true, at, text: '⏰ Time is up: this card was put off until now. Pick it up.' }); wake = true; }
      back.push({ slug, id: c.id, team: c.status === 'team' });
    }
    S().save(p);
    if (wake) require('./presence').nudge(slug);
  }
  return back;
}
function start() { setInterval(() => { try { tick(); } catch {} }, +process.env.AIGILE_TIMED_MS || 60e3).unref(); setTimeout(() => { try { tick(); } catch {} }, 3e3).unref(); }

module.exports = { parseWhen, tick, start };
