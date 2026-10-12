// 🎯 Focus mode (AIG-395): the owner works on one task and the whole window shrinks to it. Behind it the teams carry on the
// night way (the watchman, with no "going quiet" card) and the 🧭 Lead Scrum Master keeps them going. Only a showstopper
// from a lead or the Scrum Master gets through, as one small line. State lives in data/focus.conf (not .json, so it is
// never a project); one file means every window, pop-out and the desktop app agree, and it survives a refresh or restart.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs, owner, bad } = require('./store');
const watchman = require('./watchman');
const quiet = require('./quiet');

const FILE = path.join(DATA, 'focus.conf'), SUMMARY = path.join(DATA, 'focus.summary');
const MAX_STOPS_PER_HOUR = 3;
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; } };
const write = s => fs.writeFileSync(FILE, JSON.stringify(s, null, 1));

const elapsed = s => Math.max(0, (s.pausedAt ? Date.parse(s.pausedAt) : Date.now()) - Date.parse(s.since) - (s.pausedMs || 0));
function status() {
  const s = read(); if (!s) return null;
  return { project: s.project, id: s.id, title: s.title, notes: s.notes, since: s.since, paused: !!s.pausedAt, elapsedMs: elapsed(s), stops: (s.stops || []).slice(-3) };
}
const find = (slug, id) => { const p = load(slug); const c = p && p.cards.find(c => c.id === String(id).toUpperCase()); if (!c) throw bad('card not found', 404); return [p, c]; };

function start(slug, id) {
  if (read()) throw bad('already in focus mode', 409);
  const [p, c] = find(slug, id);
  if (c.status === 'done') throw bad('that card is already done');
  // Teams carry on like at night, without the 📣 going-quiet card; if the owner is already quiet the night watchman is already there.
  const ownWatch = !quiet.quietSince() && !watchman.status();
  if (ownWatch) watchman.startWatch();
  write({ project: p.slug, id: c.id, title: c.title, notes: c.description || '', since: now(), pausedMs: 0, ownWatch, stops: [] });
  return status();
}
function pause() { const s = read(); if (!s) throw bad('not in focus mode', 409); if (!s.pausedAt) { s.pausedAt = now(); write(s); } return status(); }
function resume() { const s = read(); if (!s) throw bad('not in focus mode', 409); if (s.pausedAt) { s.pausedMs = (s.pausedMs || 0) + Date.now() - Date.parse(s.pausedAt); delete s.pausedAt; write(s); } return status(); }

// What happened while the owner was busy: counts of hand-overs, questions and showstoppers.
function whileBusy(s) {
  let handedOver = 0, questions = 0;
  for (const p of listSlugs().map(load)) {
    if (!p || p.archived) continue;
    for (const c of p.cards) {
      if ((c.updated || '') <= s.since || (p.slug === s.project && c.id === s.id)) continue;
      if (c.status === 'verify') handedOver++;
      else if (c.needsYou && c.status !== 'done') questions++;
    }
  }
  return { handedOver, questions, showstoppers: (s.stops || []).length };
}
// Ends focus: done = true marks the card done (it is the owner's own task). Restores the mode from before (the watchman only stops if focus started it).
function end(done) {
  const s = read(); if (!s) throw bad('not in focus mode', 409);
  const summary = { ...whileBusy(s), title: s.title, minutes: Math.round(elapsed(s) / 60e3), done: !!done };
  if (done) {
    try {
      const [p, c] = find(s.project, s.id);
      c.status = 'done'; c.needsYou = false; c.updated = now();
      c.comments.push({ author: owner(), at: now(), text: `✅ Done in 🎯 focus (${summary.minutes} min)` });
      save(p);
    } catch {}
  }
  try { fs.unlinkSync(FILE); } catch {}
  if (s.ownWatch && !quiet.quietSince()) watchman.stopWatch(true);
  fs.writeFileSync(SUMMARY, JSON.stringify(summary));
  return summary;
}
function takeSummary() { try { const m = JSON.parse(fs.readFileSync(SUMMARY, 'utf8')); fs.unlinkSync(SUMMARY); return m; } catch { return null; } }

// 🚨 A showstopper: only a project's lead or the Scrum Master, only while in focus, at most 3 an hour, and one per card.
const isLead = (p, name) => {
  const n = String(name || '').trim().toLowerCase(); if (!n) return false;
  if (n === watchman.NAME.toLowerCase() || /scrum ?master/.test(n)) return true;
  const lead = (p.team || []).filter(m => !/retired/i.test(m.status || '')).find(m => /lead/i.test(m.name + ' ' + (m.role || '')));
  return /^lead\b/.test(n) || (!!lead && lead.name.toLowerCase() === n);
};
function showstopper(slug, id, why, by) {
  const s = read(); if (!s) throw bad('not in focus mode: use ask instead', 409);
  why = String(why || '').trim().replace(/\s+/g, ' ').slice(0, 140); if (!why) throw bad('why is required');
  const [p, c] = find(slug, id);
  if (!isLead(p, by)) throw bad('only a lead or the Scrum Master can mark a showstopper', 403);
  if ((s.stops || []).some(x => x.project === p.slug && x.id === c.id)) throw bad('that card is already a showstopper', 429);
  if ((s.stops || []).filter(x => Date.now() - Date.parse(x.at) < 3600e3).length >= MAX_STOPS_PER_HOUR) throw bad('too many showstoppers this hour: use ask and wait', 429);
  s.stops = [...(s.stops || []), { at: now(), project: p.slug, id: c.id, why, by }]; write(s);
  c.needsYou = true; c.updated = now(); c.comments.push({ author: by, at: now(), text: `🚨 Showstopper: ${why}` }); save(p);
  return { ok: true, id: c.id };
}

module.exports = { status, start, pause, resume, end, takeSummary, showstopper };
