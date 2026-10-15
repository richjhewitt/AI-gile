// 👁️ Expiry watch and backup check (AIG-1124, AIG-1126, docs/SERVICE-MGMT-PLAN.md phase 3): one plain check over the configuration items
// (lib/ci.js), run from one timer. It never repeats itself: a card is made only while no open card for that item and reason exists.
//   expiry: an item whose `expires` is within 30 days (or past) gets ONE card "Renew <name> by <date>", priority high, for the on-call agent.
//   backup: an item with backup {where, everyDays, last?} whose `last` is older than everyDays gets ONE card "Backup of <name> is N days old".
//   restore test: an item with a backup gets a "Restore test for <name>" task card every 30 days (the first sight only begins the count).
// Cards carry ciWatch: { ci, why: expiry | backup | restore }. State for the restore count: data/ciwatch.conf { restore: { 'slug/ci-1': 'YYYY-MM-DD' } }.
// A plain file data/ciwatch.stub holding YYYY-MM-DD stands in for today (tests only). AIGILE_NO_CIWATCH switches the timer off.
const fs = require('fs');
const path = require('path');
const { DATA, load, save, now, bad, listSlugs } = require('./store');
const { t } = require('./i18n');

const WARN_DAYS = 30, RESTORE_DAYS = 30, CHECK_MS = 60 * 60e3;
const FILE = () => path.join(DATA, 'ciwatch.conf');
const STUB = () => path.join(DATA, 'ciwatch.stub');
const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return j && typeof j === 'object' ? j : {}; } catch { return {}; } };
const write = j => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(j)); };
const pad = n => String(n).padStart(2, '0');
function today() {
  try { const s = fs.readFileSync(STUB(), 'utf8').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch {}
  const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);

// An open card of this kind for this item?
const openFor = (p, id, why) => p.cards.find(c => c.ciWatch && c.ciWatch.ci === id && c.ciWatch.why === why && c.status !== 'done');
function make(p, x, why, title, type, priority, body) {
  const at = now(), who = require('./service').onCall(p);
  const c = { id: p.key + '-' + p.nextId++, title, description: body, testSteps: '', type, priority, status: 'todo', assignee: who, sprint: '', blocked: false, needsYou: false, createdBy: 'CI watch',
    from: 'ci watch', created: at, updated: at, ciWatch: { ci: x.id, why }, comments: [{ author: 'CI watch', text: body, at, mark: 'task' }] };
  p.cards.push(c);
  return c;
}

// One pass over every project; returns the ids of the cards made.
function check() {
  const d = today(), conf = read(), restore = conf.restore || {}, made = [];
  let confChanged = false;
  for (const slug of listSlugs()) {
    let p; try { p = load(slug); } catch { continue; }
    if (!p || p.archived || !Array.isArray(p.ci) || !p.ci.length) continue;
    let changed = false;
    for (const x of p.ci) {
      if (x.expires && days(d, x.expires) <= WARN_DAYS && !openFor(p, x.id, 'expiry')) {
        made.push(make(p, x, 'expiry', t('ciw.expiry.title', { name: x.name, date: x.expires }), 'task', 'high', t('ciw.expiry.body', { name: x.name, date: x.expires, days: days(d, x.expires) })).id); changed = true;
      }
      const b = x.backup; if (!b) continue;
      if (b.last && days(b.last, d) > b.everyDays && !openFor(p, x.id, 'backup')) {
        const n = days(b.last, d);
        made.push(make(p, x, 'backup', t('ciw.backup.title', { name: x.name, days: n }), 'task', 'high', t('ciw.backup.body', { name: x.name, where: b.where, days: n, every: b.everyDays })).id); changed = true;
      }
      const key = slug + '/' + x.id;
      if (!restore[key]) { restore[key] = d; confChanged = true; }
      else if (days(restore[key], d) >= RESTORE_DAYS && !openFor(p, x.id, 'restore')) {
        made.push(make(p, x, 'restore', t('ciw.restore.title', { name: x.name }), 'task', 'normal', t('ciw.restore.body', { name: x.name, where: b.where })).id);
        restore[key] = d; confChanged = true; changed = true;
      }
    }
    if (changed) { p.updated = now(); save(p); }
  }
  if (confChanged) write({ ...conf, restore });
  return { date: d, made };
}

// "Backed up today" (page, CLI): sets backup.last.
function backedUp(slug, id) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const x = (p.ci || []).find(y => y.id.toLowerCase() === String(id || '').trim().toLowerCase());
  if (!x) throw bad('no such item', 404);
  if (!x.backup) throw bad('this item has no backup set');
  x.backup.last = today(); p.updated = now(); save(p);
  return x;
}

function start() {
  if (process.env.AIGILE_NO_CIWATCH) return;
  setTimeout(function tick() { try { check(); } catch {} setTimeout(tick, CHECK_MS).unref(); }, 100e3).unref();
}
module.exports = { check, backedUp, start, today };
