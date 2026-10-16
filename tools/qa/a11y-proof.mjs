import fs from 'node:fs';
const shots = 'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots';
export async function proof(page, id) {
  fs.mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${id}.png`, fullPage: true });
  const viewport = page.viewportSize(), theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.screenshot({ path: `${shots}/${id}-phone.png`, fullPage: true });
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
