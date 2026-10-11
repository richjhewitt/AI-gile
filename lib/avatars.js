// Profile pictures (AIG-150). Yours is saved like the app logo (data/logos/_me.<ext>, see logos.js).
// The agents' come from a picture library: a folder the owner drops images in (avatarsDir in aigile.local.json,
// default data/avatars). Each agent picks one the first time it joins a team; it's kept on its roster entry (m.avatar).
const fs = require('fs');
const path = require('path');
const { DATA, localSettings, listSlugs, load, bad } = require('./store');

const EXT = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
const libDir = () => path.resolve(localSettings().avatarsDir || path.join(DATA, 'avatars'));
// The pictures in the library, by file name.
function library() {
  const d = libDir(); if (d === path.join(DATA, 'avatars')) fs.mkdirSync(d, { recursive: true });
  let names; try { names = fs.readdirSync(d); } catch { return []; }
  return names.filter(f => EXT.includes(path.extname(f).toLowerCase()) && fs.statSync(path.join(d, f)).isFile()).sort();
}
// One library file by name, or null; never a path out of the folder.
const avatarFile = f => { f = String(f || ''); return f && f === path.basename(f) && library().includes(f) ? path.join(libDir(), f) : null; };
const urlOf = f => f ? '/api/avatars/' + encodeURIComponent(f) : '';
// Who wears which picture, across every project (retired members don't count).
function wearers() {
  const w = {};
  for (const p of listSlugs().map(load).filter(Boolean)) for (const m of p.team || []) if (m.avatar && !/retired/i.test(m.status || '')) (w[m.avatar] = w[m.avatar] || []).push({ project: p.slug, name: m.name });
  return w;
}
const libraryStatus = () => { const w = wearers(); return { dir: libDir().split(path.sep).join('/'), pictures: library().map(f => ({ file: f, url: urlOf(f), usedBy: w[f] || [] })) }; };
// Give member m of project slug a picture: the one asked for (a file name, or its number in the list), else a free one at random
// (the least used when all are taken). Nothing when the library is empty.
function pickAvatar(slug, m, want) {
  const lib = library(), w = wearers();
  if (want) {
    const f = /^\d+$/.test(String(want)) ? lib[+want - 1] : lib.find(x => x.toLowerCase() === String(want).toLowerCase());
    if (!f) throw bad('no picture "' + want + '" in the library (' + (lib.length ? 'aigile avatar <proj> --as NAME lists them' : 'it is empty: ' + libDir()) + ')');
    return m.avatar = f;
  }
  if (!lib.length) return '';
  const uses = f => (w[f] || []).filter(x => !(x.project === slug && x.name === m.name)).length, least = Math.min(...lib.map(uses));
  const free = lib.filter(f => uses(f) === least);
  return m.avatar = free[Math.floor(Math.random() * free.length)];
}

module.exports = { libDir, library, avatarFile, urlOf, libraryStatus, pickAvatar };
