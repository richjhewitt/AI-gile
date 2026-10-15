// 💬 Discord box in Setup (AIG-482 guide, AIG-483 assign): one bot per agent or lead, who may DM it, a numbered guide and a Test button.
// The token is only ever typed in here; the board never sends it back (a saved one shows as "saved").
const DiscordSetup = (() => {
  const D = { bots: [], state: [], projects: [], msg: '', open: false, link: {}, helloRes: {} };   // link: bot name -> { code, linked, username } (AIG-1011)
  const GUIDE = [
    'Go to <b>discord.com/developers/applications</b> and click <b>New Application</b>. Name it after the agent.',
    'Open <b>Bot</b> in the left menu, then <b>Reset Token</b> and copy it. It is shown once.',
    'Still on <b>Bot</b>: nothing else to switch on. Direct messages need no special permission.',
    'Paste the token below, pick who the bot talks to and press <b>Save</b>.',
    'Add the bot to a server you are in: after saving, press <b>1. Add the bot to your server</b> (a bot can only be messaged if you share a server with it).',
    'Press <b>Link my Discord</b>, then in that server click the bot in the member list, choose <b>Message</b> and send it the code. (No code needed if you would rather paste your User ID: Discord <b>Settings &gt; Advanced</b>, Developer Mode, right-click your name, <b>Copy User ID</b>.)',
    'Press <b>Send test message</b>.',
  ];
  const optHtml = (cur) => [['_watchman', '🧭 Lead Scrum Master'], ...D.projects.map(p => [p.slug, p.name || p.slug])]
    .map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
  function html() {
    const rows = D.bots.map((b, i) => `<div class="srv-row">
      <label class="f"><span>Bot name</span><input type="text" data-dc="name" data-i="${i}" value="${esc(b.name)}" placeholder="Bot name" onchange="DiscordSetup.edit(this)"></label>
      <label class="f"><span>Which agent it talks to</span><select data-dc="target" data-i="${i}" onchange="DiscordSetup.edit(this)">${optHtml(b.target)}</select></label>
      <label class="f"><span>Bot token</span><input type="password" data-dc="token" data-i="${i}" value="" placeholder="${b.hasToken ? 'Token saved (type to replace)' : 'Bot token'}" autocomplete="off" onchange="DiscordSetup.edit(this)"></label>
      ${inviteHtml(b)}
      <button type="button" class="primary" onclick="DiscordSetup.linkMe(${i})">Link my Discord</button>
      <span class="dc-link">${linkHtml(b)}</span>
      <details ${b.users ? '' : 'open'}><summary>or paste a User ID</summary><label class="f"><span>${esc(t('dc.hello.idlabel'))}</span><input type="text" data-dc="users" data-i="${i}" value="${esc(b.users)}" placeholder="${esc(t('dc.hello.idlabel'))}" onchange="DiscordSetup.edit(this)"></label><small class="muted">${esc(t('dc.hello.idhelp'))}</small></details>
      <div class="dc-hello"><button type="button" onclick="DiscordSetup.hello(${i})">${esc(t('dc.hello.btn'))}</button> <small class="muted">${esc(t('dc.hello.why'))}</small>${helloHtml(b)}</div>
      <div class="actions"><button type="button" onclick="DiscordSetup.test(${i})">Send test message</button> <button type="button" class="dc-del" onclick="DiscordSetup.del(${i})">🗑 Remove bot</button></div>
      <small class="muted">${esc(statusOf(b))}</small></div>`).join('');
    return `<span>💬 Discord</span><small class="muted">Talk to an agent from Discord, as easily as in the board. Optional.</small>
      <details ${D.open ? 'open' : ''} ontoggle="DiscordSetup.open=this.open"><summary>Setup guide (8 steps)</summary><ol>${GUIDE.map(s => `<li>${s}</li>`).join('')}</ol></details>
      ${rows}
      <div><button type="button" onclick="DiscordSetup.add()">+ Add a bot</button> <button type="button" class="primary" onclick="DiscordSetup.save()">Save</button></div>
      <div class="err" id="dc-err"></div><div class="muted">${esc(D.msg)}</div>`;
  }
  const linkHtml = b => { const l = D.link[b.name]; if (l && l.linked) return '✅ Linked as ' + esc(l.username); if (l && l.code) return 'Message this code to <b>' + esc(b.name) + '</b> on Discord: <b class="dc-code" style="font-size:1.3em;letter-spacing:.15em">' + esc(l.code) + '</b> <button class="md-copy" data-copy-text="' + esc(l.code) + '" title="' + esc(t('format.copyvalue')) + '">⧉ Copy</button> <small class="muted">(valid 10 minutes)</small>'; if (l && l.expired) return '⌛ That code ran out: press Link my Discord again'; return b.users ? '✅ Linked' : ''; };
  const inviteHtml = b => { const s = D.state.find(x => x.name === b.name); return s && s.inServer === false && s.invite ? '<a class="btn primary dc-invite" href="' + esc(s.invite) + '" target="_blank" rel="noopener">1. Add the bot to your server</a> <small class="muted">2. In that server’s member list click the bot, choose Message, and send the code.</small>' : ''; };
  // The hello DM's outcome (AIG-482): sent, needs a User ID, or no shared server (plain message + invite link + retry). Never the token.
  const helloHtml = b => {
    const h = D.helloRes[b.name], s = D.state.find(x => x.name === b.name) || {};
    if (h && h.ok) return '<div class="dc-hello-msg">✅ ' + esc(t('dc.hello.sent')) + '</div>';
    if (h && h.needId) return '<div class="dc-hello-msg">' + esc(t('dc.hello.needid')) + '</div>';
    const inv = (h && h.invite) || s.invite;
    if ((h && h.noServer) || s.helloNoServer) return '<div class="dc-hello-msg">' + esc(t('dc.hello.noserver')) + (inv ? ' <a class="btn primary dc-hello-invite" href="' + esc(inv) + '" target="_blank" rel="noopener">' + esc(t('dc.hello.invite')) + '</a> <button type="button" class="dc-hello-retry" onclick="DiscordSetup.hello(' + D.bots.indexOf(b) + ')">' + esc(t('dc.hello.retry')) + '</button>' : '') + '</div>';
    if (h && h.error) return '<div class="dc-hello-msg">⚠️ ' + esc(h.error) + '</div>';
    return '';
  };
  const statusOf =b => { const s = D.state.find(x => x.name === b.name); return !s ? 'Not saved yet' : s.error ? '⚠️ ' + s.error : s.connected ? '🟢 Connected' : '⚪ Connecting…'; };
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
  let poll = null;
  D.linkMe = async i => {
    const b = D.bots[i]; if (!b) return;
    try {
      await D.save();
      const r = await api('POST', '/api/discord/link', { name: b.name });
      D.link[b.name] = { code: r.code }; paint(); clearInterval(poll);
      poll = setInterval(async () => {
        try {
          const s = await api('GET', '/api/discord/link?name=' + encodeURIComponent(b.name));
          if (s.linked) { D.link[b.name] = { linked: true, username: s.username }; clearInterval(poll); D.load(); }
          else if (!s.waiting) { D.link[b.name] = { expired: true }; clearInterval(poll); paint(); }
          else return;
          paint();
        } catch { clearInterval(poll); }
      }, 2000);
    } catch (e) { const x = document.getElementById('dc-err'); if (x) x.textContent = e.message; }
  };
  D.hello = async i => {
    const b = D.bots[i]; if (!b) return;
    try { await D.save(); D.helloRes[b.name] = await api('POST', '/api/discord/hello', { name: b.name }); }
    catch (e) { D.helloRes[b.name] = { error: e.message }; }
    paint();
  };
  D.test = async i => {
    try { await D.save(); await api('POST', '/api/discord/test', { name: D.bots[i].name }); D.msg = 'Test message sent: check your Discord DMs.'; }
    catch (e) { D.msg = ''; const x = document.getElementById('dc-err'); if (x) x.textContent = e.message; return; }
    paint();
  };
  return D;
})();
