/* ---------- card text: code boxes, bullets, links ---------- */
// Escape, then make web links, this project's card ids (e.g. AIG-12) and its .md files clickable.
// Card text: ```fenced``` blocks become code boxes with a Copy button, `inline` becomes code,
// everything else goes through fmt (escape + links). Also used by inbox.js.
function withCode(text, fmt) {
  return String(text ?? '').split(/```[^\n]*\n?([\s\S]*?)```/g).map((part, i) => i % 2
    ? `<div class="codebox"><button class="copy" onclick="copyCode(this)">📋 Copy</button><pre><code>${esc(part.replace(/\n$/, ''))}</code></pre></div>`
    : spaceBullets(fmt(i ? part.replace(/^\n/, '') : part).replace(/`([^`\n]+)`/g, '<code>$1</code>'))).join('');
}
// Runs of "- " lines become a spaced bullet list, so cards stay readable whoever wrote them.
function spaceBullets(html) {
  return html.replace(/(^|\n)((?:[ \t]*[-•][ \t]+[^\n]*(?:\n[ \t]*\n?|$))+)/g, (m, pre, block) =>
    pre + '<ul class="bl">' + block.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^[ \t]*[-•][ \t]+/, '')}</li>`).join('') + '</ul>');
}
function copyCode(btn) {
  navigator.clipboard.writeText(btn.nextElementSibling.textContent)
    .then(() => { btn.textContent = '✅ Copied'; setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500); });
}
function linkify(text, p) { return withCode(text, t => linkifyText(t, p)); }
function linkifyText(text, p) {
  const docs = state.docsFor === p.slug ? state.docs || [] : [];
  const docIndex = name => { const n = name.toLowerCase(); return docs.findIndex(d => d.toLowerCase() === n || d.toLowerCase().split('/').pop() === n); };
  return linkifyBase(text, p).replace(/(^|[\s(>"'`])((?:[\w.-]+\/)*[\w.-]+\.md)\b/gi, (m, pre, name) => {
    const i = docIndex(name);
    return i < 0 ? m : `${pre}<a href="#" onclick="showDoc(${i});return false" title="Open ${esc(docs[i])}">${name}</a>`;
  });
}
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
