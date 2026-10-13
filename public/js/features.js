/* ---------- Personal builds (AIG-847): features the owner switched on for this board ---------- */
// Features.on('<key>') is true when a friend's owner gave this board that switch. The keys come from
// /api/features/mine (what the owner's board told us, only ours). Also sets html[data-feat="a b"] so CSS can show a custom feature.
const Features = (() => {
  let keys = [];
  const apply = () => { const h = document.documentElement; if (keys.length) h.setAttribute('data-feat', keys.join(' ')); else h.removeAttribute('data-feat'); };
  async function load() {
    try {
      const r = await fetch('/api/features/mine'); if (!r.ok) return;
      const k = ((await r.json()).keys || []).filter(x => typeof x === 'string');
      if (k.join() !== keys.join()) { keys = k; apply(); document.dispatchEvent(new CustomEvent('features', { detail: keys })); }
    } catch {}
  }
  load(); setInterval(load, 60000);
  return { on: key => keys.includes(key), all: () => keys.slice(), load };
})();
