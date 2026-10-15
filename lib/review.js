// 📆 Monthly service review (AIG-1155, docs/SERVICE-MGMT-PLAN.md phase 4): plain-code numbers for one service project and one month,
// for the page #/review/<slug>?month=YYYY-MM. Incidents opened and closed (a card is done on its `updated` time), average time to fix,
// cards that met their reply-by target (lib/targets.js), uptime % (the uptime incidents' down time, lib/uptime.js), tokens the project's
// runs used (data/logs/_runs.jsonl), and CPU / disk peaks of its server items (lib/serverhealth.js, kept 7 days). No AI, no tokens.
// summary(): the optional two-line text from one tiny agent call, only when AI is allowed; AIGILE_REVIEW_STUB=<text> stands in (tests).
const fs = require('fs');
const path = require('path');
const { DATA, load, bad } = require('./store');
const targets = require('./targets');

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const keyOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
function range(month) {
  const m = MONTH.exec(month); if (!m) throw bad('the month must be YYYY-MM');
  return { from: new Date(+m[1], +m[2] - 1, 1).getTime(), to: new Date(+m[1], +m[2], 1).getTime() };
}
// The last 12 months up to now, newest first.
function months(n = 12) {
  const d = new Date(targets.now()), out = [];
  for (let i = 0; i < n; i++) out.push(keyOf(new Date(d.getFullYear(), d.getMonth() - i, 1).getTime()));
  return out;
}
const ms = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; };
const inside = (t, r) => t >= r.from && t < r.to;

// Down time in the month from the uptime incidents: from the card's start to its "Up again" comment (else its done time, else now).
function downMs(cards, r, end) {
  let sum = 0;
  for (const c of cards) {
    if (c.from !== 'uptime') continue;
    const up = (c.comments || []).slice(1).find(m => m.author === 'Uptime');
    const a = ms(c.created), b = up ? ms(up.at) : c.status === 'done' ? ms(c.updated) : end;
    const lo = Math.max(a, r.from), hi = Math.min(b || end, end);
    if (hi > lo) sum += hi - lo;
  }
  return sum;
}
function runTokens(slug, r) {
  const t = { in: 0, out: 0, cache: 0, runs: 0 };
  let txt = ''; try { txt = fs.readFileSync(path.join(DATA, 'logs', '_runs.jsonl'), 'utf8'); } catch {}
  for (const l of txt.split('\n')) {
    let x; try { x = l && JSON.parse(l); } catch { x = null; }
    if (!x || x.slug !== slug || !inside(Number(x.end) || 0, r)) continue;
    t.in += Number(x.in) || 0; t.out += Number(x.out) || 0; t.cache += Number(x.cache) || 0; t.runs++;
  }
  return t;
}
function servers(p, r) {
  let file = {}; try { file = JSON.parse(fs.readFileSync(path.join(DATA, 'serverhealth.conf'), 'utf8')); } catch {}
  const out = [];
  for (const x of (p.ci || []).filter(x => x.kind === 'server')) {
    const rs = ((file.servers || {})[String(x.name).trim().toLowerCase()] || []).filter(y => inside(ms(y.at), r));
    const peak = k => rs.reduce((m, y) => typeof y[k] === 'number' && y[k] > m ? y[k] : m, -1);
    out.push({ name: x.name, readings: rs.length, cpu: rs.length ? Math.max(0, peak('cpu')) : null, disk: rs.length ? Math.max(0, peak('disk')) : null });
  }
  return out;
}

function review(slug, month) {
  const p = load(slug); if (!p) throw bad('no such project', 404);
  const svc = require('./service').of(p); if (!svc) throw bad('this project is not a service', 400);
  const key = month || keyOf(targets.now()), r = range(key), now = targets.now(), end = Math.min(now, r.to);
  const cards = p.cards || [], inc = cards.filter(c => c.type === 'incident');
  const opened = inc.filter(c => inside(ms(c.created), r)), closed = inc.filter(c => c.status === 'done' && inside(ms(c.updated), r));
  const avg = closed.length ? Math.round(closed.reduce((n, c) => n + Math.max(0, ms(c.updated) - ms(c.created)), 0) / closed.length / 60e3) : null;
  // Reply targets: cards of a kind with a target made this month; counted once answered (by someone but the maker) or the time is up.
  const tb = targets.table(); let met = 0, of = 0;
  for (const c of cards) {
    const k = targets.kindOf(c), h = k ? (tb[k] || {})[c.priority] || 0 : 0;
    if (!h || !inside(ms(c.created), r)) continue;
    const by = String(c.createdBy || '').toLowerCase(), dead = ms(c.created) + h * 3600e3;
    const rep = (c.comments || []).find(m => String(m.author || '').toLowerCase() !== by && m.author !== 'Uptime');
    const at = rep ? ms(rep.at) : 0;
    if (at && at <= dead) { met++; of++; } else if (at || dead <= now) of++;
  }
  const watched = require('./uptime').view()[slug], span = Math.max(1, end - r.from);
  const down = downMs(cards, r, end), anyUp = cards.some(c => c.from === 'uptime');
  const uptime = (watched || anyUp) && end > r.from ? Math.max(0, Math.round((1 - down / span) * 10000) / 100) : null;
  return { slug, name: p.name, month: key, months: months(), current: key === keyOf(now),
    incidents: { opened: opened.length, closed: closed.length, still: inc.filter(c => c.status !== 'done').length, avgFixMin: avg,
      list: opened.concat(closed.filter(c => !opened.includes(c))).slice(0, 30).map(c => ({ id: c.id, title: c.title, status: c.status })) },
    replies: { met, of }, uptime, downMin: Math.round(down / 60e3), tokens: runTokens(slug, r), servers: servers(p, r),
    ai: require('./scrummaster').aiAllowed() };
}

// The optional two-line summary of the numbers. { ok, text } or { ok: false, why: 'noai' | 'failed' }.
async function summary(slug, month) {
  const v = review(slug, month);
  const sm = require('./scrummaster');
  if (!sm.aiAllowed()) return { ok: false, why: 'noai' };
  if (process.env.AIGILE_REVIEW_STUB) return { ok: true, text: process.env.AIGILE_REVIEW_STUB };
  const i = v.incidents, prompt = `You are the on-call agent of the service "${v.name}". Write a two-line summary (two short plain sentences, no markdown) of its month ${v.month}: `
    + `${i.opened} incidents opened, ${i.closed} closed, average time to fix ${i.avgFixMin == null ? 'n/a' : i.avgFixMin + ' min'}; `
    + `${v.replies.met} of ${v.replies.of} cards met their reply-by target; uptime ${v.uptime == null ? 'not measured' : v.uptime + '%'}; ${v.tokens.in + v.tokens.out} tokens used.`;
  const out = await sm.haikuText(prompt);
  const text = String(out || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2).join('\n').slice(0, 400);
  return text ? { ok: true, text } : { ok: false, why: 'failed' };
}
module.exports = { review, summary, months, range };
