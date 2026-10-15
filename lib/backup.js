// 🗄️ Daily backup of the boards (AIG-1258) and putting one back (AIG-1259).
// Once a day (at start when today has none, then checked every hour) the board files (data/<slug>.json), the project order and
// the settings file are copied to data/backups/YYYY-MM-DD/. The last 7 days are kept. Attachments, chats, logs and data/secrets/
// and data/keys/ are never copied. Secrets: the board's own logins and DM keys live in data/secrets/ and data/keys/ (left out);
// the settings file can hold a Discord bot or Twitch chat token in plain text, so those fields are taken out of the copy
// (SECRET_KEY below) and the copy's backup.json lists where they were. A board file that does not parse is left out of the day
// (it is never a "good" copy), so the last day that has a board is its last good version.
// Putting back (restore): the current file is copied first into data/backups/<day>T<time>-replaced/, so a restore can itself be
// undone from the same list. Those are kept 7 too. Restoring settings keeps the current tokens when the current file reads.
const fs = require('fs');
const path = require('path');
const S = require('./store');

const KEEP = 7;
const DIR = () => path.join(S.DATA, 'backups');
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, REPLACED_RE = /^\d{4}-\d{2}-\d{2}T\d{6}-replaced$/;
const SETTINGS = '_settings';   // its name in a backup folder: a slug never starts with _
const ORDER = 'project-order.conf';
const SECRET_KEY = /token|secret|passw|^pw$|sudopw|key$/i;   // key$: giphyKey, calls.key and the like
const pad = n => String(n).padStart(2, '0');
const dayOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;   // the owner's own date
const timeOf = (d = new Date()) => `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const okId = id => DAY_RE.test(id) || REPLACED_RE.test(id);
const okName = n => n === SETTINGS || /^[a-z0-9-]+$/.test(String(n));
const fileFor = name => name === SETTINGS ? S.LOCAL_FILE : path.join(S.DATA, name + '.json');

// Takes the secret-looking fields out of a settings object; returns the paths it took ([['discord','bots',0,'token'], ...]).
function scrub(o, at = [], out = []) {
  if (Array.isArray(o)) o.forEach((v, i) => scrub(v, [...at, i], out));
  else if (o && typeof o === 'object') for (const k of Object.keys(o)) {
    if (SECRET_KEY.test(k) && typeof o[k] === 'string') { delete o[k]; out.push([...at, k]); } else scrub(o[k], [...at, k], out);
  }
  return out;
}
const getAt = (o, p) => p.reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o);
function setAt(o, p, val) { const last = p[p.length - 1], parent = getAt(o, p.slice(0, -1)); if (parent && typeof parent === 'object') parent[last] = val; }

const readManifest = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'backup.json'), 'utf8')); } catch { return null; } };
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));
function cardsOf(text) { const p = JSON.parse(text); return { cards: Array.isArray(p.cards) ? p.cards.length : 0, name: String(p.name || '') }; }

// Copies the files into a fresh folder `id` (written as .tmp first, then renamed, so a half-made day is never listed).
// names: which files (slugs and/or SETTINGS); undefined = every board + settings + the project order.
function snapshot(id, why, names) {
  const final = path.join(DIR(), id), tmp = final + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const man = { at: S.now(), why, projects: {}, settings: false, scrubbed: [], skipped: [] };
  const list = names || [...S.listSlugs().filter(okName), SETTINGS];
  for (const name of list) {
    let text; try { text = fs.readFileSync(fileFor(name), 'utf8'); } catch { continue; }   // not there
    if (name === SETTINGS) {
      let s; try { s = JSON.parse(text); } catch { if (why !== 'replaced') { man.skipped.push(SETTINGS); continue; } s = null; }
      if (s) { man.scrubbed = scrub(s); writeJson(path.join(tmp, SETTINGS + '.json'), s); }
      else fs.writeFileSync(path.join(tmp, SETTINGS + '.bad'), text);   // the damaged file being replaced, kept as it was
      man.settings = true;
      continue;
    }
    let info; try { info = cardsOf(text); } catch { info = null; }
    if (!info) {   // damaged: never a good copy; a replaced damaged board is kept as .bad so nothing is lost
      if (why !== 'replaced') { man.skipped.push(name); try { S.load(name); } catch {} continue; }   // load() marks it for the Home warning
      fs.writeFileSync(path.join(tmp, name + '.bad'), text); man.projects[name] = { cards: null, name: '', damaged: true }; continue;
    }
    fs.writeFileSync(path.join(tmp, name + '.json'), text);
    man.projects[name] = info;
  }
  if (!names) try { fs.copyFileSync(path.join(S.DATA, ORDER), path.join(tmp, ORDER)); } catch {}
  writeJson(path.join(tmp, 'backup.json'), man);
  fs.renameSync(tmp, final);
  return man;
}

// Only our own folders are ever removed, and only inside data/backups/.
function prune() {
  let ents; try { ents = fs.readdirSync(DIR(), { withFileTypes: true }); } catch { return []; }
  const gone = [];
  for (const re of [DAY_RE, REPLACED_RE]) {
    const mine = ents.filter(e => e.isDirectory() && re.test(e.name)).map(e => e.name).sort();
    for (const n of mine.slice(0, Math.max(0, mine.length - KEEP))) {
      const f = path.join(DIR(), n);
      if (path.dirname(f) !== DIR()) continue;
      try { fs.rmSync(f, { recursive: true, force: true }); gone.push(n); } catch {}
    }
  }
  return gone;
}

// Today's backup, once: nothing happens when today's folder is there already.
function daily() {
  const id = dayOf();
  let made = null;
  if (!fs.existsSync(path.join(DIR(), id))) {
    try { fs.mkdirSync(DIR(), { recursive: true }); made = snapshot(id, 'daily'); }
    catch (e) { console.error('Daily backup: ' + e.message); }
  }
  return { day: id, made: !!made, removed: prune() };
}

// Every backup, newest first: { id, at, kind: 'daily' | 'replaced', projects: { slug: { cards, name, damaged? } }, settings }.
function list() {
  let ents; try { ents = fs.readdirSync(DIR(), { withFileTypes: true }); } catch { ents = []; }
  return ents.filter(e => e.isDirectory() && okId(e.name)).map(e => {
    const m = readManifest(path.join(DIR(), e.name)) || {};
    return { id: e.name, at: m.at || '', kind: REPLACED_RE.test(e.name) ? 'replaced' : 'daily', projects: m.projects || {}, settings: !!m.settings, scrubbed: (m.scrubbed || []).length };
  }).sort((a, b) => (b.at || b.id).localeCompare(a.at || a.id));
}

// The newest backup that holds a good copy of this file (for the Home warning's Put back).
function lastGood(name) {
  const b = list().find(x => name === SETTINGS ? x.settings && fs.existsSync(path.join(DIR(), x.id, SETTINGS + '.json')) : x.projects[name] && !x.projects[name].damaged);
  return b ? { id: b.id, at: b.at, kind: b.kind, cards: name === SETTINGS ? null : b.projects[name].cards } : null;
}

function status() {
  return { dataDir: S.DATA.replace(/\\/g, '/'), backupsDir: DIR().replace(/\\/g, '/'), settingsFile: S.LOCAL_FILE.replace(/\\/g, '/'), keep: KEEP, list: list() };
}

// Puts one file back from backup `id`. The current file (even a damaged one) is copied aside first.
function restore(b) {
  const id = String((b && b.id) || ''), name = String((b && b.name) || '');
  if (!okId(id) || !okName(name)) throw S.bad('no such backup', 404);
  const src = path.join(DIR(), id, name + '.json');
  let text; try { text = fs.readFileSync(src, 'utf8'); } catch { throw S.bad('that backup has no copy of this', 404); }
  let val; try { val = JSON.parse(text); } catch { throw S.bad('that backup copy does not read', 409); }
  const dest = fileFor(name);
  let replaced = null;
  if (fs.existsSync(dest)) {
    const d = new Date(); let rid = `${dayOf(d)}T${timeOf(d)}-replaced`;
    for (let i = 1; fs.existsSync(path.join(DIR(), rid)); i++) rid = `${dayOf(d)}T${timeOf(new Date(d.getTime() + i * 1000))}-replaced`;
    fs.mkdirSync(DIR(), { recursive: true });
    snapshot(rid, 'replaced', [name]);
    replaced = rid;
  }
  if (name === SETTINGS) {
    const cur = (() => { try { return JSON.parse(fs.readFileSync(dest, 'utf8')); } catch { return null; } })();
    const m = readManifest(path.join(DIR(), id)) || {};
    if (cur) for (const p of m.scrubbed || []) { const v = getAt(cur, p); if (typeof v === 'string' && getAt(val, p.slice(0, -1)) !== undefined) setAt(val, p, v); }   // keep today's tokens
    text = JSON.stringify(val, null, 2) + '\n';
  } else {
    if (!val || !Array.isArray(val.cards)) throw S.bad('that backup copy is not a board', 409);
    val.slug = name; text = JSON.stringify(val);
  }
  S.writeAtomic(dest, text);
  S.forgetFile(dest);
  if (name === SETTINGS) S.forgetOwner();
  prune();
  return { ok: true, name, from: id, replaced, ...status() };
}

let timer = null;
function start() {
  if (timer) return;
  setTimeout(daily, 5000).unref();   // on start, when today has none (after the board is up)
  timer = setInterval(daily, 60 * 60e3); timer.unref();   // the day turns over: checked every hour
}

module.exports = { start, daily, prune, list, lastGood, status, restore, scrub, SETTINGS, KEEP };
