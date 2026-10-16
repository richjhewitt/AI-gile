#!/usr/bin/env node
// The pre-teaser for aigile.lol (AIG-1320): presite/ holds its own index.html, pre.css and pre.js; everything else is copied
// here from site/ (one source of truth): styles, the language button and every language bundle, the live board, the sealed
// interest form, What we keep, Status, the icons and the installer. The copies are git-ignored (presite/.gitignore).
// Run: node tools/gen/presite.mjs   then deploy the presite folder: sudo bash install-site.sh aigile.lol www.aigile.lol
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = path.join(ROOT, 'site'), PRE = path.join(ROOT, 'presite');
export const FILES = ['style.css', 'i18n.js', 'live.js', 'forms.js', 'interest.html', 'privacy.html', 'status.html', 'install-site.sh', 'assets/icon.png', 'assets/preview.png'];

export function build() {
  const out = [];
  const copy = rel => { const to = path.join(PRE, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(SITE, rel), to); out.push(rel); };
  FILES.forEach(copy);
  // Only the bundles the pages load (lang/<code>.js and languages.js); the JSON sources stay in site/lang.
  for (const f of fs.readdirSync(path.join(SITE, 'lang')).filter(f => f.endsWith('.js')).sort()) copy('lang/' + f);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const n = build().length;
  console.log('presite: ' + n + ' file(s) copied from site/');
}
