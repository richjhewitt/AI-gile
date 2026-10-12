// The same masking as the page's Streamer.mask (public/js/streamer.js, AIG-591), for text that leaves this computer
// (the public board snapshot, AIG-603). Keep the two lists of patterns in step. Passwords, keys, tokens, IP addresses,
// emails and server names become ••••.
const DOTS = '••••';
const oct = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, () => DOTS],
  [/\b(pass(?:word|wd)?|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key)(\s*[:=]\s*)(["']?)([^\s"',;]{4,})\3/gi, (m, k, sep, q) => k + sep + q + DOTS + q],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, () => DOTS],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, () => DOTS],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, () => DOTS],
  [/\bAKIA[0-9A-Z]{16}\b/g, () => DOTS],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, () => DOTS],
  [/\bAIza[0-9A-Za-z_-]{35}/g, () => DOTS],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, () => DOTS],
  [/\b(Bearer\s+)[A-Za-z0-9._~+\/=-]{16,}/g, (m, b) => b + DOTS],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, () => DOTS],
  [new RegExp(`(?<![\\w.])${oct}(?:\\.${oct}){3}(?![\\w]|\\.\\d)`, 'g'), () => DOTS],
  [/(?<![\w:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![\w:])/gi, () => DOTS],
];
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Server names from My servers (name, and for ssh the address and host).
function serverRe() {
  let list = []; try { list = require('./servers').effective(); } catch {}
  const words = new Set();
  for (const s of list) {
    const n = String(s.name || '').trim(), v = String(s.value || '').trim();
    if (n.length >= 3) words.add(n);
    if (v && s.kind === 'ssh') { words.add(v); const h = v.replace(/^.*@/, '').replace(/:\d+$/, ''); if (h.length >= 3) words.add(h); }
  }
  return words.size ? new RegExp(`(?<![\\w-])(?:${[...words].sort((a, b) => b.length - a.length).map(reEsc).join('|')})(?![\\w-])`, 'gi') : null;
}
function make() {
  const sr = serverRe();
  return s => {
    if (typeof s !== 'string' || s.length < 4) return s;
    for (const [re, fn] of PATTERNS) s = s.replace(re, fn);
    return sr ? s.replace(sr, DOTS) : s;
  };
}
module.exports = { make, mask: s => make()(s), DOTS };
