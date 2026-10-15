/* ---------- 📱 your phone over your own network (AIG-868) ---------- */
// Setup's Phone box: the phone address (your PC's Tailscale name), Pair a phone (a QR code + a 10-minute, one-use link),
// the paired phones with last seen and Remove. On the phone, Phone.ready() (app.js start-up) trades #/pair/<code> for the
// device cookie before anything else asks the board, and says "not paired" instead of retrying for ever.
const Phone = (() => {
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const PAIR = /^#\/pair\/([A-Za-z0-9_-]{10,100})$/;
  const P = { data: null, host: '', link: null, app: null, err: '', busy: false };   // app: the Android app's QR, shown once (AIG-907)
  let blocked = !LOCAL;   // core.js refresh() waits while this phone is not (yet) let in

  function stop(msg) {
    const a = $('app'); if (a) a.innerHTML = `<div class="phone-stop"><h2>📱 ${esc(t('phone.h'))}</h2><p>${esc(msg)}</p></div>`;
    return new Promise(() => {});   // the start-up stops here
  }
  async function ready() {
    if (LOCAL) return;
    const m = location.hash.match(PAIR);
    if (m) {
      history.replaceState(null, '', location.pathname + '#/');   // the code never stays in the address bar or history
      try { await api('POST', '/api/phone/pair', { code: m[1] }); } catch (e) { return stop(t('phone.pair.bad')); }
    }
    try { const r = await fetch('/api/meta'); if (r.status === 403) return stop(t('phone.unpaired')); } catch {}
    blocked = false;
  }

  /* ---------- a small QR code (byte mode, error level M, or L when M won't fit; versions 1-6) ---------- */
  function qr(text, low) {
    const data = Array.from(new TextEncoder().encode(text));
    const ECC = low ? [0, 7, 10, 15, 20, 26, 18] : [0, 10, 16, 26, 18, 24, 16], BLOCKS = low ? [0, 1, 1, 1, 1, 1, 2] : [0, 1, 1, 1, 2, 2, 4];
    const raw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; } return r; };
    let ver = 1; while (ver <= 6 && Math.floor(raw(ver) / 8) - ECC[ver] * BLOCKS[ver] < data.length + 2) ver++;
    if (ver > 6) return low ? null : qr(text, true);
    const total = Math.floor(raw(ver) / 8), cap = total - ECC[ver] * BLOCKS[ver];
    const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(data.length, 8); data.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0xEC; cw.length < cap; p ^= 0xEC ^ 0x11) cw.push(p);
    // Reed-Solomon over GF(256), polynomial 0x11D
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
    const deg = ECC[ver], div = new Array(deg).fill(0); div[deg - 1] = 1;
    for (let i = 0, root = 1; i < deg; i++) { for (let j = 0; j < deg; j++) { div[j] = mul(div[j], root); if (j + 1 < deg) div[j] ^= div[j + 1]; } root = mul(root, 2); }
    const rs = d => { const r = new Array(deg).fill(0); for (const b of d) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); } return r; };
    const nb = BLOCKS[ver], short = nb - total % nb, shortLen = Math.floor(total / nb), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const d = cw.slice(k, k + shortLen - deg + (i < short ? 0 : 1)); k += d.length; const b = d.concat(rs(d)); if (i < short) b.splice(shortLen - deg, 0, 0); blocks.push(b); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - deg || j >= short) all.push(b[i]); });
    // the grid
    const size = ver * 4 + 17, M = [...Array(size)].map(() => new Array(size).fill(false)), F = [...Array(size)].map(() => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
    if (ver > 1) { const a = [6, size - 7]; for (const ax of a) for (const ay of a) if (!(ax === 6 && ay === 6) && !(ax === 6 && ay === size - 7) && !(ax === size - 7 && ay === 6)) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const format = mask => {
      const d = (low ? 8 : 0) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);   // level M = 00, L = 01
      const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, g(i));
      set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
      set(8, size - 8, true);
    };
    format(0);
    for (let right = size - 1, i = 0; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (!F[y][x] && i < all.length * 8) { M[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const flip = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let k = 0; k < 2; k++) for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b <= size; b++) { const same = b < size && (k ? M[b][a] === M[b - 1][a] : M[a][b] === M[a][b - 1]); if (same) run++; else { if (run >= 5) p += run - 2; run = 1; } } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      M.forEach(r => r.forEach(c => { if (c) dark++; }));
      return p + (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
    };
    let best = 0, least = Infinity;
    for (let m = 0; m < 8; m++) { flip(m); format(m); const s = penalty(); if (s < least) { least = s; best = m; } flip(m); }
    flip(best); format(best);
    return M;
  }
  function qrSvg(text) {
    const M = qr(text); if (!M) return '';
    const n = M.length + 8; let d = '';
    M.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return `<svg class="phone-qr" viewBox="0 0 ${n} ${n}" width="220" height="220" role="img" aria-label="${esc(t('phone.qr'))}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  /* ---------- the Setup box (this computer only) ---------- */
  function html() {
    setTimeout(load, 0);
    return `<div id="phBody" class="muted">…</div>`;
  }
  async function load() {
    if (!$('phBody')) return;
    if (!LOCAL) { $('phBody').textContent = t('phone.onpc'); return; }
    try { P.data = await api('GET', '/api/phone'); P.err = ''; } catch (e) { P.err = e.message; }
    if (!P.host) P.host = (P.data && P.data.hosts[0]) || '';
    paint();
    if (!P.host) try { const ts = await api('GET', '/api/phone/tailscale'); if (ts.host && !P.host && !($('phHost') || {}).value) { P.host = ts.host; paint(); } } catch {}
  }
  // Over my server (AIG-1008): a saved ssh server keeps a tunnel open so the phone can reach this board on a public name.
  function tunnelHtml(d) {
    const tn = d.tunnel, servers = d.sshServers || [];
    const state = !tn ? t('phone.tun.idle') : t('phone.tun.' + (tn.state === 'up' || tn.state === 'starting' ? tn.state : tn.state === 'down' ? 'down' : 'idle'));
    return `<div class="ph-tunnel" id="phTun"><h4 class="ph-h">${esc(t('phone.tun.h'))}</h4><small class="muted">${esc(t('phone.tun.help'))}</small>` + (servers.length
      ? `<label>${esc(t('phone.tun.server'))} <select id="phTunSrv">${servers.map(n => `<option${tn && tn.server.toLowerCase() === n.toLowerCase() ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>${esc(t('phone.tun.host'))} <input id="phTunHost" placeholder="test.aigile.lol" value="${esc(tn ? tn.host : '')}" autocomplete="off" spellcheck="false"></label>
      <label>${esc(t('phone.tun.port'))} <input id="phTunPort" type="number" min="1024" max="65535" placeholder="14321" value="${esc(tn ? tn.port : '')}"></label>
      <div class="actions"><button type="button" class="primary" id="phTunSave">${esc(t('phone.tun.save'))}</button>${tn ? ` <button type="button" class="ph-alt" id="phTunOff">${esc(t('phone.tun.off'))}</button>` : ''}</div>`
      : `<small class="muted">${esc(t('phone.tun.none'))}</small>`)
      + `<small id="phTunState" class="ph-tun-${esc(tn ? tn.state : 'off')}">${esc(state)}${tn && tn.error && tn.state !== 'up' ? ' · ' + esc(t('phone.tun.err', { err: tn.error })) : ''}</small></div>`;
  }
  function paint() {
    const box = $('phBody'); if (!box) return;
    box.className = '';
    const d = P.data || { devices: [] }, when = s => s ? ago(s) : t('phone.never');
    const step = (n, key, inner) => `<li class="ph-step"><b class="ph-n" aria-hidden="true">${n}</b><div class="ph-body"><h4 class="ph-h">${esc(t('phone.step' + n + '.h'))}</h4>${inner}</div></li>`;
    box.innerHTML = `<small class="muted">${esc(t('phone.help'))}</small>
      <ol class="ph-steps" id="phSteps">
      ${step(1, '', `<label>${esc(t('phone.host'))} <input id="phHost" placeholder="mypc.tail1234.ts.net" value="${esc(P.host)}" autocomplete="off" spellcheck="false"></label>
      <label>${esc(t('phone.name'))} <input id="phName" placeholder="${esc(t('phone.name.ph'))}" maxlength="40"></label>
      <small class="muted">${esc(t('phone.serve'))} <code>tailscale serve --bg ${esc(location.port || '4321')}</code></small>
      <div class="actions"><button type="button" class="primary" id="phPair" ${P.busy ? 'disabled' : ''}>${esc(t('phone.pair'))}</button></div>
      <small class="muted">${esc(t('phone.app.or'))} <button type="button" class="ph-alt" id="phApp" ${P.busy ? 'disabled' : ''}>${esc(t('phone.app'))}</button></small>`)}
      ${step(2, '', (P.link ? `<div class="phone-link"><p class="ph-scan">${esc(t('phone.scan'))}</p>${qrSvg(P.link.url)}<p><a href="${esc(P.link.url)}" target="_blank" rel="noopener" id="phLink">${esc(P.link.url)}</a></p><small class="muted">${esc(t('phone.link.help'))}</small></div>` : '') + (P.app ? `<div class="phone-link"><p class="ph-scan">${esc(t('phone.scan'))}</p>${qrSvg(P.app.qr)}<code id="phAppQr" class="phone-key">${esc(P.app.qr)}</code><small class="muted">${esc(t('phone.app.help'))}</small></div>` : '') || `<small class="muted">${esc(t('phone.step2.wait'))}</small>`)}
      ${step(3, '', `<small class="muted">${esc(t('phone.step3.help'))}</small>`)}
      </ol>
      ${tunnelHtml(d)}
      <div class="err" id="phErr">${esc(P.err)}</div>
      ${d.devices.length ? `<ul class="phone-list">${d.devices.map(x => `<li><b>${esc(x.name)}</b> <small class="muted">${esc(x.host)} · ${esc(t('phone.seen', { when: when(x.seen) }))}</small> <button type="button" class="ph-rm" data-id="${esc(x.id)}">${esc(t('phone.remove'))}</button></li>`).join('')}</ul>` : `<small class="muted">${esc(t('phone.none'))}</small>`}`;
  }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest && ev.target.closest('#phPair, #phApp, .ph-rm, #phTunSave, #phTunOff'); if (!b) return;
    P.err = '';
    try {
      if (b.id === 'phApp') {
        P.host = $('phHost').value.trim(); P.link = null; P.busy = true; paint();
        P.app = await api('POST', '/api/phone/app', { host: P.host });
        P.data = await api('GET', '/api/phone');
      } else if (b.id === 'phTunSave' || b.id === 'phTunOff') {
        const body = b.id === 'phTunOff' ? { server: '' } : { server: $('phTunSrv').value, host: $('phTunHost').value.trim(), port: $('phTunPort').value.trim() };
        P.data = await api('POST', '/api/phone/tunnel', body);
        setTimeout(load, 4000);   // up or down, a moment later
      } else if (b.id === 'phPair') {
        P.app = null;
        const name = $('phName').value.trim(); P.host = $('phHost').value.trim(); P.busy = true; paint();
        P.link = await api('POST', '/api/phone/start', { host: P.host, name });
        P.data = await api('GET', '/api/phone');
      } else { P.data = await api('DELETE', '/api/phone/devices/' + b.dataset.id); }
    } catch (e) { P.err = e.message; }
    P.busy = false; paint();
  });

  return { ready, html, load, qr, get blocked() { return blocked; } };
})();
