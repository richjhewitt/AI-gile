/* ---------- card text: code boxes, bullets, links ---------- */
// Escape, then make web links, this project's card ids (e.g. AIG-12) and its .md files clickable.
// Card text: ```fenced``` blocks become code boxes with a Copy button (plus Open when the block is one .md path),
// `inline` becomes code (a lone .md path becomes a link), everything else goes through fmt (escape + links).
// slug is the project the .md paths belong to. Also used by inbox.js.
function withCode(text, fmt, slug) {
  return String(text ?? '').split(/```[^\n]*\n?([\s\S]*?)```/g).map((part, i) => {
    if (i % 2) {
      const code = part.replace(/\n$/, ''), one = code.trim();
      const open = isMdPath(one) ? `<button class="copy open" data-p="${esc(one)}" data-s="${esc(slug || '')}" onclick="showDocPath(this.dataset.p,this.dataset.s)">${esc(t('format.open'))}</button>` : '';
      const edit = isFilePath(one) ? editBtn(one, 'copy edit') : isFolderPath(one) ? folderBtn(one, 'copy edit') : '';
      return `<div class="codebox"><button class="copy" onclick="copyCode(this)">${esc(t('format.copy'))}</button>${open}${edit}<pre><code>${esc(code)}</code></pre></div>`;
    }
    const links = [];   // inline code that is a .md path is set aside so fmt leaves it whole
    part = (i ? part.replace(/^\n/, '') : part).replace(/`([^`\n]+)`/g, (m, c) => isMdPath(c) ? `\u0000${links.push(c.trim()) - 1}\u0000` : m);
    return spaceBullets(editLinks(fmt(part)).replace(/`([^`\n]+)`/g, (m, c) => `<code>${c}</code>` + (isFilePath(unesc(c)) ? editBtn(unesc(c)) : isFolderPath(unesc(c)) ? folderBtn(unesc(c)) : ''))
      .replace(/\u0000(\d+)\u0000/g, (m, n) => `<code>${mdLink(esc(links[n]), esc(links[n]), slug)}</code>`));
  }).join('');
}
// 📝 Open in your editor (AIG-156): full file paths (C:\..., C:/..., /home/..., ~/...) get a small button.
const isFilePath = s => /^\s*(?:[A-Za-z]:[\\/]|\/|~[\\/])[^<>|?*\n`"]*\.\w{1,8}\s*$/.test(s) && !/^\s*https?:/i.test(s);
// A full folder path (AIG-240): no extension at the end; it gets a 📂 button that opens the folder.
const isFolderPath = s => /^\s*(?:[A-Za-z]:[\\/]|~[\\/])[^<>|?*\n`"]*[^<>|?*\n`"\\/.]\s*[\\/]?\s*$/.test(s) && !/\.\w{1,8}\s*$/.test(s);
const folderBtn = (p, cls = 'edit-btn') => `<button class="${cls}" data-editor="${esc(p.trim())}" title="${esc(p.trim())}">📂</button>`;
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// A web page (.html) opens in the browser, not the editor (AIG-294).
const isPage = p => /\.html?\s*$/i.test(p);
const editBtn = (p, cls = 'edit-btn') => `<button class="${cls}" data-editor="${esc(p.trim())}" title="${esc(t(isPage(p) ? 'format.browser' : 'format.edit'))}">${isPage(p) ? '🌐' : '📝'}</button>`;
// Bare full paths without spaces in escaped text (paths with spaces belong in `code`).
const editLinks = html => html.replace(/(^|[\s(>])((?:[A-Za-z]:[\\/]|~[\\/])[^\s<>"`]*\.\w{1,8})(?=[\s<).,;:!?]|$)/g, (m, pre, p) => pre + p + editBtn(unesc(p)));
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-editor]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  try { await api('POST', '/api/open-file', { path: b.dataset.editor }); const was = b.textContent; b.textContent = '✓'; setTimeout(() => { b.textContent = was; }, 1500); }
  catch (err) { alert(err.message); }
}, true);
// A whole string that is one .md path (relative or absolute, / or \; spaces allowed).
const isMdPath = s => /^\s*(?:[A-Za-z]:)?[^<>|?*\n`]*[^<>|?*\s\n`]\.md\s*$/i.test(s) && !/^\s*https?:/i.test(s);
const mdLink = (html, p, slug) => `<a href="#" data-p="${p}" data-s="${esc(slug || '')}" onclick="showDocPath(this.dataset.p,this.dataset.s);return false" title="${esc(t('format.openfile', { name: p }))}">${html}</a>`;
// Links bare .md paths (no spaces) in escaped text.
const mdLinks = (html, slug) => html.replace(/(^|[\s(>"'`])((?:[A-Za-z]:)?(?:[\w.-]+[\\/])*[\w.-]+\.md)\b/gi, (m, pre, name) => pre + mdLink(name, name, slug));
// Runs of "- " lines become a spaced bullet list, so cards stay readable whoever wrote them.
function spaceBullets(html) {
  return html.replace(/(^|\n)((?:[ \t]*[-•][ \t]+[^\n]*(?:\n[ \t]*\n?|$))+)/g, (m, pre, block) =>
    pre + '<ul class="bl">' + block.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^[ \t]*[-•][ \t]+/, '')}</li>`).join('') + '</ul>');
}
function copyCode(btn) {
  navigator.clipboard.writeText(btn.parentNode.querySelector('pre').textContent)
    .then(() => { btn.textContent = t('format.copied'); setTimeout(() => { btn.textContent = t('format.copy'); }, 1500); });
}
function linkify(text, p) { return withCode(text, t => linkifyText(t, p), p.slug); }
function linkifyText(text, p) { return mdLinks(linkifyBase(text, p), p.slug); }
function linkifyBase(text, p) {
  const key = String(p.key).replace(/[^A-Za-z0-9]/g, '');
  return esc(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')   // **bold**, used in bullet-point cards
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
    .replace(new RegExp(`(^|[^\\w/#-])(${key}-\\d+)\\b`, 'gi'), (m, pre, id) => `${pre}<a href="#/p/${p.slug}/${id.toUpperCase()}">${id}</a>`);
}

/* ---------- markdown renderer (Docs dialog) ---------- */
// Small markdown renderer: headings, lists, tables, code blocks, links, bold/italic/code.
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n'); let html = '', i = 0;
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^https?:/.test(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t);
  const isList = l => /^\s*([-*]|\d+\.)\s+/.test(l), isRow = l => /^\s*\|/.test(l);
  while (i < lines.length) {
    const l = lines[i]; let m;
    if (/^```/.test(l)) { const b = []; i++; while (i < lines.length && !/^```/.test(lines[i])) b.push(lines[i++]); i++; html += `<pre><code>${esc(b.join('\n'))}</code></pre>`; }
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
