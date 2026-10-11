// GIF search (AIG-343): the board's server asks Giphy, so the owner's key (⚙️ Setup, aigile.local.json) never reaches the page.
// Docs: GET {base}/v1/gifs/search?api_key&q&limit&offset&rating=pg-13 and GET {base}/v1/gifs/{id}?api_key.
// AIGILE_GIPHY_BASE points the board at a fake Giphy in QA.
const { localSettings, bad } = require('./store');

const BASE = () => (process.env.AIGILE_GIPHY_BASE || 'https://api.giphy.com').replace(/\/+$/, '');
const MAX_GIF = 8 * 1024 * 1024;   // what a DM can carry
const key = () => String(localSettings().giphyKey || '').trim();
const mask = k => k ? '••••••••' + k.slice(-4) : '';
const isMask = v => /^•{4,}/.test(String(v || ''));

async function ask(path, params) {
  const k = key(); if (!k) throw bad('add a Giphy key in Setup first', 400);
  const url = new URL(BASE() + path); url.search = new URLSearchParams({ api_key: k, ...params, rating: 'pg-13' });
  let r; try { r = await fetch(url, { signal: AbortSignal.timeout(10000) }); } catch { throw bad('could not reach Giphy', 502); }
  if (r.status === 401 || r.status === 403) throw bad('Giphy did not accept the key', 400);
  if (!r.ok) throw bad('Giphy answered ' + r.status, 502);
  return r.json();
}
const imgOf = (g, ...names) => { for (const n of names) { const i = (g.images || {})[n]; if (i && i.url) return i; } return null; };

async function search(b) {
  const q = String(b.q || '').trim().slice(0, 50), offset = Math.max(0, Math.min(4999, parseInt(b.offset, 10) || 0));
  const j = await ask(q ? '/v1/gifs/search' : '/v1/gifs/trending', { ...(q ? { q } : {}), limit: 18, offset });
  const results = (j.data || []).map(g => { const p = imgOf(g, 'fixed_width_small', 'fixed_width', 'original'); return p ? { id: String(g.id), title: String(g.title || '').slice(0, 100), preview: p.url, w: +p.width || 0, h: +p.height || 0 } : null; }).filter(Boolean);
  return { results, next: results.length >= 18 ? offset + 18 : null };
}

// Downloads one GIF by id (looked up again at Giphy, so the page can't point the server at any address).
async function pick(b) {
  const id = String(b.id || ''); if (!/^[\w-]{3,40}$/.test(id)) throw bad('bad GIF id');
  const j = await ask('/v1/gifs/' + id, {}), g = j.data || {};
  const cands = ['original', 'downsized_large', 'fixed_height', 'fixed_width'].map(n => (g.images || {})[n]).filter(i => i && i.url && (!+i.size || +i.size <= MAX_GIF));
  const img = cands[0]; if (!img) throw bad('that GIF is too big');
  const u = new URL(img.url), base = new URL(BASE());
  if (!(u.host === base.host || /(^|\.)giphy\.com$/.test(u.hostname)) || (u.protocol !== 'https:' && base.protocol !== 'http:')) throw bad('unexpected GIF address', 502);
  let r; try { r = await fetch(u, { signal: AbortSignal.timeout(20000) }); } catch { throw bad('could not download the GIF', 502); }
  if (!r.ok || !/^image\/gif/i.test(r.headers.get('content-type') || '')) throw bad('Giphy did not send a GIF', 502);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > MAX_GIF) throw bad('that GIF is too big');
  const name = (String(g.slug || g.title || id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gif') + '.gif';
  return { name, type: 'image/gif', data: buf.toString('base64') };
}

module.exports = { search, pick, mask, isMask, hasKey: () => !!key(), key };
