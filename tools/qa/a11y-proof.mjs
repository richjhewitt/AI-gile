import fs from 'node:fs';
export const SHOTS = 'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots';
export async function proof(page, id) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${id}.png`, fullPage: true });
  const viewport = page.viewportSize(), theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.screenshot({ path: `${SHOTS}/${id}-phone.png`, fullPage: true });
  await page.evaluate(theme => { if (theme === null) document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = theme; }, theme);
  await page.setViewportSize(viewport);
}

export async function contrastTokens(page, themes) {
  return page.evaluate(themes => {
    const lum = hex => {
      const c = hex.trim().replace('#', '');
      const rgb = (c.length === 3 ? [...c].map(x => x + x).join('') : c).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const fails = [];
    const sheet = document.createElement('style'); sheet.textContent = INBOX_CSS; document.head.appendChild(sheet);
    for (const theme of themes) {
      document.documentElement.dataset.theme = theme === 'night' ? 'dark' : theme;
      document.documentElement.toggleAttribute('data-night', theme === 'night');
      const style = getComputedStyle(document.documentElement), token = k => style.getPropertyValue('--' + k).trim();
      for (const [fg, bg] of [['on-fill', 'accent'], ['on-fill', 'done'], ['on-fill', 'danger'], ['on-fill', 'you'], ['q-fg', 'q-bg']]) {
        const a = lum(token(fg)), b = lum(token(bg)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < 4.5) fails.push({ theme, fg, bg, ratio });
      }
      for (const fg of ['text', 'muted', 'accent', 'done', 'danger', 'you', 'warn-ink']) for (const bg of ['bg', 'panel', 'col']) {
        const a = lum(token(fg)), b = lum(token(bg)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < 4.5) fails.push({ theme, fg, bg, ratio });
      }
    }
    sheet.remove();
    return fails;
  }, themes);
}

// AIG-1430: real text in the Inbox items measured against the item tint it sits on (question, blocked, to test, task),
// for each theme and system setting, Night on a light system included. Fixture items fill in any kind the page lacks.
export const TINT_CASES = [
  { label: 'light', scheme: 'light', theme: 'light' }, { label: 'system light', scheme: 'light', theme: null },
  { label: 'system dark', scheme: 'dark', theme: null }, { label: 'dark', scheme: 'light', theme: 'dark' },
  { label: 'black', scheme: 'light', theme: 'black' },
  { label: 'night, system light', scheme: 'light', theme: null, night: true }, { label: 'night, system dark', scheme: 'dark', theme: null, night: true },
  { label: 'night, dark', scheme: 'light', theme: 'dark', night: true }, { label: 'night, light', scheme: 'light', theme: 'light', night: true },
  { label: 'night, black', scheme: 'dark', theme: 'black', night: true },
];
export async function contrastInboxTints(page, cases = TINT_CASES, shotAt) {
  const fails = [];
  for (const c of cases) {
    await page.emulateMedia({ colorScheme: c.scheme });
    fails.push(...await page.evaluate(c => {
      const root = document.documentElement;
      if (c.theme) root.dataset.theme = c.theme; else delete root.dataset.theme;
      root.toggleAttribute('data-night', !!c.night);
      let fx = document.getElementById('qaTints');
      if (!fx) {
        const item = (k, tag) => `<div class="ib-item ${k}" data-project="qa"><div class="ib-top"><span class="ib-tag">${tag}</span> <span class="ib-proj">QA</span> <span class="ib-id">QA-1</span></div>`
          + `<div class="ib-title"><a href="#/">Fixture card title</a></div><div class="ib-who">asked just now</div><div>Messages</div><div class="ib-hint">A hint under the box</div>`
          + `<details class="ib-steps"><summary>Steps</summary></details></div>`;
        fx = document.createElement('div'); fx.id = 'qaTints'; fx.className = 'ib';
        fx.innerHTML = item('q', 'Question') + item('q blk', 'Blocked') + item('t', 'To test') + item('k', 'Task');
        (document.querySelector('.ib') || document.getElementById('app') || document.body).appendChild(fx);
      }
      const rgb = s => { const m = s.match(/[\d.]+/g); return m ? { v: m.slice(0, 3).map(Number), a: m[3] === undefined ? 1 : +m[3] } : null; };
      const lum = v => v.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b && b.a > .9) return b.v; } return [255, 255, 255]; };
      const out = [];
      for (const item of document.querySelectorAll('.ib-item')) for (const el of [item, ...item.querySelectorAll('*')]) {
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        if (!/[\p{L}\p{N}]/u.test(own) || el.matches(':disabled, textarea, input, select') || !el.getClientRects().length) continue;
        const st = getComputedStyle(el), fg = rgb(st.color);
        if (!fg || st.visibility === 'hidden') continue;
        const a = lum(fg.v), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        const size = parseFloat(st.fontSize), large = size >= 24 || (size >= 18.66 && +st.fontWeight >= 700);
        if (ratio < (large ? 3 : 4.5)) out.push({ theme: c.label, kind: item.className.replace('ib-item ', ''), text: own.slice(0, 30), ratio: +ratio.toFixed(2) });
      }
      return out;
    }, c));
    if (shotAt && c.label === 'night, system light') await page.screenshot({ path: shotAt, fullPage: true });
  }
  await page.evaluate(() => document.getElementById('qaTints')?.remove());
  await page.emulateMedia({ colorScheme: 'light' });
  return fails;
}
