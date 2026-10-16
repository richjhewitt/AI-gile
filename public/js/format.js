/* ---------- card text: code boxes, bullets, links ---------- */
// Escape, then make web links, this project's card ids (e.g. AIG-12) and its .md files clickable.
// Card text: ```fenced``` blocks become code boxes with a Copy button (plus Open when the block is one .md path),
// `inline` becomes code (a lone .md path becomes a link), everything else goes through fmt (escape + links).
// slug is the project the .md paths belong to. Also used by inbox.js.
// Your own emojis (AIG-649): :name: for a known name becomes its picture in card and chat text. The list is loaded once and
// refreshed by emoji.js after an add or delete; the img is built only from this list, never from the typed text.
let CUSTOM_EMOJIS = new Map();
function setCustomEmojis(list) { CUSTOM_EMOJIS = new Map((list || []).map(m => [m.name, m.url])); }
fetch('/api/emojis').then(r => r.ok ? r.json() : []).then(setCustomEmojis).catch(() => {});
// AIG-650: in a friend's chat, what that friend sent is looked up first (scoped to them) and gets a hover "Save"; set by withFriendEmojis.
let FRIEND_EMOJIS = null;
function withFriendEmojis(cid, list, fn) {
  FRIEND_EMOJIS = list && list.length ? { cid, map: new Map(list.map(m => [m.name, m.url])) } : null;
  try { return fn(); } finally { FRIEND_EMOJIS = null; }
}
function customEmojis(html) {
  if (typeof emojiFallback === "function") html = emojiFallback(html);
  if ((!CUSTOM_EMOJIS.size && !FRIEND_EMOJIS) || html.indexOf(':') < 0) return html;
  const fe = FRIEND_EMOJIS;
  let inCode = 0;
  return html.split(/(<[^>]*>)/).map(p => {
    if (p[0] === '<' && p.length > 1) { if (/^<code[\s>]/i.test(p)) inCode++; else if (/^<\/code>/i.test(p)) inCode--; return p; }
    return inCode > 0 ? p : p.replace(/:([a-z0-9_]{1,32}):/g, (m, n) => fe && fe.map.has(n)
      ? `<span class="cemoji-w"><img class="cemoji" src="${esc(fe.map.get(n))}" alt=":${n}:" title=":${n}:" style="height:1.4em;width:auto;vertical-align:middle"><button type="button" class="cemoji-save" data-esave="${n}" data-ecid="${esc(fe.cid)}" title="${esc(t('emoji.save.title', { name: n }))}" aria-label="${esc(t('emoji.save.title', { name: n }))}">${esc(t('emoji.save'))}</button></span>`
      : CUSTOM_EMOJIS.has(n) ?`<img class="cemoji" src="${esc(CUSTOM_EMOJIS.get(n))}" alt=":${n}:" title=":${n}:" style="height:1.4em;width:auto;vertical-align:middle">` : m);
  }).join('');
}
function withCode(text, fmt, slug) {
  return String(text ?? '').split(/```[^\n]*\n?([\s\S]*?)```/g).map((part, i) => {
    if (i % 2) {
      const code = part.replace(/\n$/, ''), one = code.trim();
      const open = isMdPath(one) ? `<button class="copy open" data-p="${esc(one)}" data-s="${esc(slug || '')}" onclick="showDocPath(this.dataset.p,this.dataset.s)">${esc(t('format.open'))}</button>` : '';
      const paths = isFilePath(one) ? fileBtns(one, 'copy edit') : isFolderPath(one) ? folderBtn(one, 'copy edit') : '';
      return `<div class="codebox${paths ? ' paths' : ''}"><div class="codebox-acts"><button class="copy" onclick="copyCode(this)">${esc(t('format.copy'))}</button>${open}${paths}</div><pre><code>${esc(code)}</code></pre></div>`;
    }
    const links = [];   // inline code that is a .md path is set aside so fmt leaves it whole
    part = (i ? part.replace(/^\n/, '') : part).replace(/`([^`\n]+)`/g, (m, c) => isMdPath(c) ? `\u0000${links.push(c.trim()) - 1}\u0000` : m);
    return spaceBullets(customEmojis(copyValues(editLinks(fmt(part)).replace(/`([^`\n]+)`/g, (m, c) => `<code data-copy-text="${esc(unesc(c))}" title="${esc(t('format.copyvalue'))}">${c}</code>` + (isFilePath(unesc(c)) ? fileBtns(unesc(c)) : isFolderPath(unesc(c)) ? folderBtn(unesc(c)) : ''))
      .replace(/\u0000(\d+)\u0000/g, (m, n) => `<code>${mdLink(esc(links[n]), esc(links[n]), slug)}${mdCopyBtn(links[n], slug)}</code>`))));
  }).join('');
}
// AIG-470: "**Label:** value" lines get a ⧉ after the value when it is one token (host, path, number, email, URL, key), a link or `code`.
const copyValues = html => html.replace(/(<b>[^<]*:<\/b>[ \t]+)(<code[^>]*>[^<]*<\/code>|<a [^>]*>[^<]*<\/a>|[^\s<]+)[ \t]*(?=\n|$)/gm, (m, label, v) =>
  `${label}${v}<button class="md-copy" data-copy-text="${esc(unesc(v.replace(/<[^>]*>/g, '')))}" title="${esc(t('format.copyvalue'))}">⧉</button>`);
// 📝 Open in your editor (AIG-156): full file paths (C:\..., C:/..., /home/..., ~/...) get a small button.
const isFilePath = s => /^\s*(?:[A-Za-z]:[\\/]|\/|~[\\/])[^<>|?*\n`"]*\.\w{1,8}\s*$/.test(s) && !/^\s*https?:/i.test(s);
// A full folder path (AIG-240): no extension at the end; it gets a 📂 button that opens the folder.
const isFolderPath = s => /^\s*(?:[A-Za-z]:[\\/]|~[\\/])[^<>|?*\n`"]*[^<>|?*\n`"\\/.]\s*[\\/]?\s*$/.test(s) && !/\.\w{1,8}\s*$/.test(s);
// AIG-398: 📂 opens a folder in Explorer (a file's button: the folder it is in); 📋 copies the path.
const dirOf = p => { const d = p.trim().replace(/[\\/][^\\/]*$/, ''); return /^[A-Za-z]:$/.test(d) ? d + '/' : d; };
const openDirBtn = (dir, cls) => `<button class="${cls}" data-open-dir="${esc(dir)}" title="${esc(t('format.opendir'))}" aria-label="${esc(t('format.opendir'))}"><span aria-hidden="true">📂</span></button>`;
const copyPathBtn = (p, cls) => `<button class="${cls}" data-copy-path="${esc(p.trim())}" title="${esc(t('format.copypath'))}" aria-label="${esc(t('format.copypath'))}"><span aria-hidden="true">📋</span></button>`;
const folderBtn = (p, cls = 'edit-btn') => openDirBtn(p.trim(), cls) + copyPathBtn(p, cls);
const fileBtns = (p, cls = 'edit-btn') => editBtn(p, cls) + openDirBtn(dirOf(p), cls) + copyPathBtn(p, cls);
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// A web page (.html) opens in the browser, not the editor (AIG-294).
const isPage = p => /\.html?\s*$/i.test(p);
const editBtn = (p, cls = 'edit-btn') => `<button class="${cls}" data-editor="${esc(p.trim())}" title="${esc(t(isPage(p) ? 'format.browser' : 'format.edit'))}" aria-label="${esc(t(isPage(p) ? 'format.browser' : 'format.edit'))}">${isPage(p) ? '🌐' : '📝'}</button>`;
// Bare full paths without spaces in escaped text (paths with spaces belong in `code`).
const editLinks = html => html.replace(/(^|[\s(>])((?:[A-Za-z]:[\\/]|~[\\/])[^\s<>"`]*\.\w{1,8})(?=[\s<).,;:!?]|$)/g, (m, pre, p) => pre + p + fileBtns(unesc(p)));
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-editor],[data-open-dir]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  try { await api('POST', '/api/open-file', { path: b.dataset.editor ?? b.dataset.openDir }); const was = b.textContent; b.textContent = '✓'; setTimeout(() => { b.textContent = was; }, 1500); }
  catch (err) { alert(err.message); }
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy-path]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  copyDocText(b, b.dataset.copyPath);
}, true);
// Copies text to the clipboard and shows a short "Copied" on the button (AIG-390); the button keeps its own label.
async function copyDocText(btn, text) {
  try { await navigator.clipboard.writeText(text); }
  catch (err) { alert(err.message); return; }
  const was = btn.dataset.was || (btn.dataset.was = btn.textContent);
  btn.textContent = t('format.copied'); setTimeout(() => { btn.textContent = was; }, 1500);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy-text]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  copyDocText(b, b.dataset.copyText);
}, true);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy-md]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  try { const d = await api('GET', `/api/projects/${b.dataset.s || slug()}/file?path=${encodeURIComponent(b.dataset.copyMd)}`); await copyDocText(b, d.text); }
  catch (err) { alert(err.message); }
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy-block]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  copyDocText(b, Streamer.raw(b.parentNode.querySelector('pre')));
}, true);
// A whole string that is one .md path (relative or absolute, / or \; spaces allowed).
const isMdPath = s => /^\s*(?:[A-Za-z]:)?[^<>|?*\n`]*[^<>|?*\s\n`]\.md\s*$/i.test(s) && !/^\s*https?:/i.test(s);
const mdLink = (html, p, slug) => `<a href="#" data-p="${p}" data-s="${esc(slug || '')}" onclick="showDocPath(this.dataset.p,this.dataset.s);return false" title="${esc(t('format.openfile', { name: p }))}" aria-label="${esc(t('format.openfile', { name: p }))}">${html}</a>`;
// Links bare .md paths (no spaces) in escaped text.
// 📋 next to each .md link copies the file's text (AIG-390), through the same route the viewer uses.
const mdCopyBtn = (p, slug) => `<button class="md-copy" data-copy-md="${esc(p)}" data-s="${esc(slug || '')}" title="${esc(t('format.copymd', { name: p }))}" aria-label="${esc(t('format.copymd', { name: p }))}"><span aria-hidden="true">📋</span></button>`;
const mdLinks = (html, slug) => html.replace(/(^|[\s(>"'`])((?:[A-Za-z]:)?(?:[\w.-]+[\\/])*[\w.-]+\.md)\b/gi, (m, pre, name) => pre + mdLink(name, name, slug) + mdCopyBtn(name, slug));
// Runs of "- " lines become a spaced bullet list, so cards stay readable whoever wrote them.
function spaceBullets(html) {
  return html.replace(/(^|\n)((?:[ \t]*[-•][ \t]+[^\n]*(?:\n[ \t]*\n?|$))+)/g, (m, pre, block) =>
    pre + '<ul class="bl">' + block.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^[ \t]*[-•][ \t]+/, '')}</li>`).join('') + '</ul>');
}
function copyCode(btn) {
  navigator.clipboard.writeText(Streamer.raw(btn.closest('.codebox').querySelector('pre')))
    .then(() => { btn.textContent = t('format.copied'); setTimeout(() => { btn.textContent = t('format.copy'); }, 1500); });
}
// A pasted GIF link (AIG-343) shows under the link as a picture: https only, a .gif address or a giphy/tenor media address; the browser
// only draws real images (anything else just fails and hides), loaded lazily, and a click opens it in the lightbox.
function gifLink(u) {
  const raw = u.replace(/&amp;/g, '&'); let x; try { x = new URL(raw); } catch { return ''; }
  const h = x.hostname.toLowerCase();
  let src = '';
  if (x.protocol === 'https:' && (/\.gif$/i.test(x.pathname) || (/^(media\d*|i)\.giphy\.com$/.test(h) && /\/media\//.test(x.pathname)) || (/^(media\d*|c)\.tenor\.com$/.test(h) && /\.gif$/i.test(x.pathname)))) src = raw;
  else { const m = x.protocol === 'https:' && /^(www\.)?giphy\.com$/.test(h) && x.pathname.match(/^\/gifs\/(?:[^/]*-)?([A-Za-z0-9]+)\/?$/); if (m) src = 'https://media.giphy.com/media/' + m[1] + '/giphy.gif'; }
  return src ? `<img class="gif-inline" src="${esc(src)}" alt="GIF" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
}
function linkify(text, p) { return withCode(text, t => linkifyText(t, p), p.slug); }
function linkifyText(text, p) { return mdLinks(linkifyBase(text, p), p.slug); }
function linkifyBase(text, p) {
  const key = String(p.key || '').replace(/[^A-Za-z0-9]/g, '');   // a DM thread carries its project's key (AIG-449); a friend's chat has none
  const keep = [];   // finished links are parked here so the bare-address rules below cannot link inside them (AIG-732)
  const park = h => '\u0001' + (keep.push(h) - 1) + '\u0002';
  const out = esc(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')   // **bold**, used in bullet-point cards
    // [text](url) and bare vscode:// links; only http, https and vscode are allowed (the text is already escaped)
    .replace(/\[([^\]\n]+)\]\(((?:https?|vscode):\/\/[^\s<)]+)\)/gi, (m, label, u) => park(linkTag(u, label)))
    .replace(/(^|[^\w"=\u0001])(vscode:\/\/[^\s<]+[^\s<.,;:!?)\]])/gi, (m, pre, u) => pre + park(linkTag(u, u)))
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>${gifLink(u)}`)
    // A bare web address like test.locoradio.live/?x (AIG-318); common endings only, so file names stay plain.
    .replace(/(^|[^\w@/.:"=-])((?:[a-z0-9-]+\.)+(?:com|net|org|io|live|dev|app|co|uk|nl|be|ai|me|tv|gg|xyz|info|site|online)(?::\d+)?(?:\/[^\s<]*[^\s<.,;:!?)\]])?)(?![\w-])/gi,
      (m, pre, u) => `${pre}<a href="https://${u}" target="_blank" rel="noopener">${u}</a>`)
    .replace(key ? new RegExp(`(^|[^\\w/#-])(${key}-\\d+)\\b`, 'gi') : /(?!)/g, (m, pre, id) => `${pre}<a href="#/p/${p.slug}/${id.toUpperCase()}">${id}</a>`);
  return out.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[i]);
}
// One safe link: http(s) opens in a new tab, vscode:// opens normally. The address is already escaped.
const linkTag = (u, label) => /^https?:/i.test(u) ? `<a href="${u}" target="_blank" rel="noopener">${label}</a>` : `<a href="${u}">${label}</a>`;

/* ---------- markdown renderer (Docs dialog) ---------- */
// Small markdown renderer: headings, lists, tables, code blocks, links, bold/italic/code.
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n'); let html = '', i = 0;
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^https?:/.test(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t);
  const isList = l => /^\s*([-*]|\d+\.)\s+/.test(l), isRow = l => /^\s*\|/.test(l);
  while (i < lines.length) {
    const l = lines[i]; let m;
    if (/^```/.test(l)) { const b = []; i++; while (i < lines.length && !/^```/.test(lines[i])) b.push(lines[i++]); i++; html += `<div class="codebox"><button class="copy" data-copy-block title="${esc(t('docs.copyblock'))}" aria-label="${esc(t('docs.copyblock'))}"><span aria-hidden="true">📋</span></button><pre><code>${esc(b.join('\n'))}</code></pre></div>`; }
    else if ((m = l.match(/^(#{1,6})\s+(.*)/))) { html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; }
    else if (isRow(l)) {
      const rows = []; while (i < lines.length && isRow(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => inline(c.trim().replace(/\\\|/g, '|')));
      html += '<table>' + rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r, k) => '<tr>' + cells(r).map(c => k ? `<td>${c}</td>` : `<th>${c}</th>`).join('') + '</tr>').join('') + '</table>';
    }
    else if (isList(l)) {
      const ol = /^\s*\d+\./.test(l), items = []; while (i < lines.length && isList(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      html += `<${ol ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`;
    }
    else if (/^---+\s*$/.test(l)) { html += '<hr>'; i++; }
    else if (!l.trim()) i++;
    else {
      const p = [lines[i++]]; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|---+\s*$)/.test(lines[i]) && !isRow(lines[i]) && !isList(lines[i])) p.push(lines[i++]);
      html += `<p>${inline(p.join(' '))}</p>`;
    }
  }
  return html;
}
