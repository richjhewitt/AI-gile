// 💬 Discord box in Setup (AIG-482 guide, AIG-483 assign): one bot per agent or lead, who may DM it, a numbered guide and a Test button.
// The token is only ever typed in here; the board never sends it back (a saved one shows as "saved").
const DiscordSetup = (() => {
  const D = { bots: [], state: [], projects: [], msg: '', open: false };
  const GUIDE = [
    'Go to <b>discord.com/developers/applications</b> and click <b>New Application</b>. Name it after the agent.',
    'Open <b>Bot</b> in the left menu, then <b>Reset Token</b> and copy it. It is shown once.',
    'Still on <b>Bot</b>: nothing else to switch on. Direct messages need no special permission.',
    'Open <b>OAuth2</b>, tick <b>bot</b> under Scopes, copy the link, open it and add the bot to any server you are in (a bot can only DM people it shares a server with).',
    'In Discord: <b>Settings &gt; Advanced</b>, switch on <b>Developer Mode</b>. Right-click your own name and choose <b>Copy User ID</b>.',
    'Paste the token and your User ID below, pick who the bot talks to, press <b>Save</b>, then <b>Send test message</b>.',
  ];
  const optHtml = (cur) => [['_watchman', '🧭 Lead Scrum Master'], ...D.projects.map(p => [p.slug, p.name || p.slug])]
    .map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
  function html() {
    const rows = D.bots.map((b, i) => `<div class="srv-row">
      <input type="text" data-dc="name" data-i="${i}" value="${esc(b.name)}" placeholder="Bot name" onchange="DiscordSetup.edit(this)">
      <select data-dc="target" data-i="${i}" onchange="DiscordSetup.edit(this)">${optHtml(b.target)}</select>
      <input type="password" data-dc="token" data-i="${i}" value="" placeholder="${b.hasToken ? 'Token saved (type to replace)' : 'Bot token'}" autocomplete="off" onchange="DiscordSetup.edit(this)">
      <input type="text" data-dc="users" data-i="${i}" value="${esc(b.users)}" placeholder="Your Discord User ID" onchange="DiscordSetup.edit(this)">
      <button type="button" onclick="DiscordSetup.test(${i})">Send test message</button>
      <button type="button" onclick="DiscordSetup.del(${i})" title="Remove">✕</button>
      <small class="muted">${esc(statusOf(b))}</small></div>`).join('');
    return `<span>💬 Discord</span><small class="muted">Talk to an agent from Discord, as easily as in the board. Optional.</small>
      <details ${D.open ? 'open' : ''} ontoggle="DiscordSetup.open=this.open"><summary>Setup guide (6 steps)</summary><ol>${GUIDE.map(s => `<li>${s}</li>`).join('')}</ol></details>
      ${rows}
      <div><button type="button" onclick="DiscordSetup.add()">+ Add a bot</button> <button type="button" class="primary" onclick="DiscordSetup.save()">Save</button></div>
      <div class="err" id="dc-err"></div><div class="muted">${esc(D.msg)}</div>`;
  }
  const statusOf = b => { const s = D.state.find(x => x.name === b.name); return !s ? 'Not saved yet' : s.error ? '⚠️ ' + s.error : s.connected ? '🟢 Connected' : '⚪ Connecting…'; };
  const paint = () => { const el = document.getElementById('discordBox'); if (el) el.innerHTML = html(); };
  D.load = async () => {
    try { const [c, p] = await Promise.all([api('GET', '/api/discord/config'), api('GET', '/api/projects')]); D.bots = c.bots; D.state = c.state; D.projects = p; } catch {}
    paint();
  };
  D.html = html;
  D.edit = el => { const b = D.bots[+el.dataset.i]; if (b) { b[el.dataset.dc] = el.value; if (el.dataset.dc === 'token') b.hasToken = !!el.value || b.hasToken; } };
  D.add = () => { D.bots.push({ name: 'bot' + (D.bots.length + 1), target: '_watchman', users: '', hasToken: false, token: '' }); paint(); };
  D.del = i => { D.bots.splice(i, 1); paint(); };
  D.save = async () => {
    try { const r = await api('POST', '/api/discord/config', { bots: D.bots.map(b => ({ name: b.name, target: b.target, users: b.users, token: b.token || '' })) }); D.bots = r.bots; D.msg = 'Saved.'; setTimeout(D.load, 2500); }
    catch (e) { const x = document.getElementById('dc-err'); if (x) x.textContent = e.message; return; }
    paint();
  };
  D.test = async i => {
    try { await D.save(); await api('POST', '/api/discord/test', { name: D.bots[i].name }); D.msg = 'Test message sent: check your Discord DMs.'; }
    catch (e) { D.msg = ''; const x = document.getElementById('dc-err'); if (x) x.textContent = e.message; return; }
    paint();
  };
  return D;
})();
