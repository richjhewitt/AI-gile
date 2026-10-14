// Writes site/teaser-lines.js from site/teaser-lines.json (window.TEASER_LINES), so the teaser pitch also works opened from a file (AIG-697).
//   node tools/gen/teaser-lines.mjs   (run after editing teaser-lines.json; QA teaser checks they match)
import fs from 'node:fs';
const dir = new URL('../../site/', import.meta.url);
const d = JSON.parse(fs.readFileSync(new URL('teaser-lines.json', dir), 'utf8'));
fs.writeFileSync(new URL('teaser-lines.js', dir), '// Made by tools/gen/teaser-lines.mjs from teaser-lines.json: do not edit by hand.\nwindow.TEASER_LINES = ' + JSON.stringify(d) + ';\n');
console.log('site/teaser-lines.js:', d.versions.length, 'versions');
