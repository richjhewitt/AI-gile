// QA area: discord (AIG-481): only listed users are heard, DMs reach the open question's card, replies come back once, the token never shows.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, tmp, def } from '../lib.mjs';

def('discord', 'Discord bridge with a stubbed Discord: allowed users only, DM becomes an owner comment, replies sent once, long text chunked (AIG-481)', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), d = tmp('dc');
  const r = spawnSync(process.execPath, [path.join(root, 'tools/qa/areas/discord-stub.cjs'), root], { env: { ...process.env, AIGILE_DATA: d, AIGILE_LOCAL: path.join(d, 'local.json'), AIGILE_PORT: '4998' }, encoding: 'utf8' });
  let o = {}; try { o = JSON.parse(r.stdout.trim().split('\n').pop()); } catch {}
  check('the stub ran', !!o.ok, r);
  check('strangers, servers and bots are ignored', o.stranger === null && o.guild === null && o.bot === null, o);
  check('an allowed DM is the owner answering the open question', o.ok && o.ok.card === 'T-1' && o.calls[0][1] === '/api/projects/t/cards/T-1/comments' && o.calls[0][2].text === 'yes go', o.calls);
  check('first look sends nothing old', Array.isArray(o.first) && !o.first.length, o.first);
  check('the lead\'s reply goes to the user once, the owner\'s own comment never', o.sent === 1 && o.again === 0 && o.sentCalls[1][1].content.includes('Done it') && !JSON.stringify(o.sentCalls).includes('mine'), o);
  check('status never carries the token', !JSON.stringify(o.status).includes('TKN') && o.status[0].users === 1, o.status);
  check('long text is cut under 2000', o.chunks.length === 3 && o.chunks.every(n => n <= 1900), o.chunks);
  check('Link my Discord: a stranger or wrong code, in a server or by a bot, links nobody', o.rand === null && o.wrong === null && o.guildCode === null && o.botCode === null && o.usersBefore.join() === '123456789' && o.wait.waiting, o);
  check('the right code (any case) links the sender, saved in the config, and the bot says so', o.good && o.good.linked && o.usersAfter.join() === '777777,123456789' && o.done.linked && o.done.username === 'Rich' && o.thanks.includes('Linked'), o);
  check('a code works once', o.reuse === null && o.usersFinal.join() === '777777,123456789', o);
  check('an expired code links nobody', o.late === null && o.exp.expired && o.usersEnd.join() === '777777,123456789', o);
  check('Discord errors come as plain words', o.words[0].includes("isn't a Discord user") && o.words[1].includes("isn't a Discord user") && o.words[2].includes('share a server') && o.words[3].includes('token is wrong') && o.err.includes("isn't a Discord user") && !/400/.test(o.err), [o.words, o.err]);
  check('a bot in no server gets an invite link with its client_id, never the token', o.in0.inServer === false && o.in0.invite === 'https://discord.com/oauth2/authorize?client_id=4242&scope=bot%20applications.commands&permissions=68608' && !JSON.stringify(o.in0).includes('TKN'), o.in0);
  check('the answer is kept for a minute, Save looks again, and once in a server the page hides step 1', o.cached === false && o.in1.inServer === true && /s\.inServer === false/.test(fs.readFileSync(path.join(root, 'public/js/discord-setup.js'), 'utf8')) && /dc-invite[^\n]*dc\.setup\.invite'/.test(fs.readFileSync(path.join(root, 'public/js/discord-setup.js'), 'utf8')), [o.cached, o.in1]);
  check('connect: the bot opens a DM to the stored user id and sends the hello', o.hello.ok === true && o.helloCalls[0][1] === '/users/@me/channels' && o.helloCalls[0][2].recipient_id === '123456789' && /^Hi .+, reply here to message your AI-gile teams$/.test(o.helloCalls[1][2].content) && o.helloCalls[1][1] === '/channels/CH9/messages', [o.hello, o.helloCalls]);
  check('no shared server: plain flag plus the invite link (bot + applications.commands), never the token', o.helloNo.ok === false && o.helloNo.noServer === true && o.helloNo.invite === 'https://discord.com/oauth2/authorize?client_id=4242&scope=bot%20applications.commands&permissions=68608' && !JSON.stringify(o.helloNo).includes('TKN'), o.helloNo);
  check('no user id yet: it asks for one instead of failing', o.helloNoId.ok === false && o.helloNoId.needId === true, o.helloNoId);
  const hsrc = fs.readFileSync(path.join(root, 'public/js/discord-setup.js'), 'utf8');
  check('the page has a Send me a hello DM button, the User ID help, and the invite plus retry on no server', /DiscordSetup\.hello\(/.test(hsrc) && /dc\.hello\.noserver/.test(hsrc) && /dc-hello-invite/.test(hsrc) && /dc-hello-retry/.test(hsrc) && /dc\.hello\.idhelp/.test(hsrc));
  // AIG-1141 labelled fields and a text Remove button; AIG-1333 every text from a language key: render the box in English and in Dutch
  const lang = c => JSON.parse(fs.readFileSync(path.join(root, 'public/lang', c + '.json'), 'utf8'));
  const render = code => {
    const en = lang('en'), dict = lang(code), missing = new Set();
    const t = (k, v) => { let x = dict[k] ?? en[k]; if (x == null) { missing.add(k); x = k; } x = String(x); return v ? x.replace(/\{(\w+)\}/g, (m, n) => n in v ? v[n] : m) : x; };
    const esc = x => String(x ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const cx = { t, esc, api: async () => ({}), document: { getElementById: () => null }, setTimeout, clearInterval, setInterval, encodeURIComponent };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'public/js/discord-setup.js'), 'utf8') + '\nthis.DS = DiscordSetup;', cx);
    const D = cx.DS;
    D.bots = [{ name: 'Forgebot', target: '_watchman', users: '', hasToken: true }, { name: 'Twobot', target: '_watchman', users: '42', hasToken: false }];
    D.state = [{ name: 'Forgebot', inServer: false, invite: 'https://discord.com/oauth2/authorize?client_id=1', connected: true }];
    D.link = { Forgebot: { code: 'AB12CD' } }; D.msg = 'dc.setup.saved';
    return { html: D.html(), missing: [...missing], dict, en };
  };
  const E = render('en'), N = render('nl'), B = render('nl-BE');
  check('Discord setup: bot name, agent and token have labels; Remove bot is a text button', ['Bot name', 'Which agent it talks to', 'Bot token'].every(l => E.html.includes('<label class="f"><span>' + l + '</span>')) && E.html.includes('🗑 Remove bot') && !E.html.includes('title="Remove">✕') && E.html.includes('target="_blank" rel="noopener">1. Add the bot to your server'), E.html);
  const ENGLISH = ['Bot name', 'Which agent it talks to', 'Token saved', 'Link my Discord', 'or paste a User ID', 'Send test message', 'Remove bot', 'Add a bot', 'Setup guide', 'Name it after', 'Talk to an agent', 'Not saved yet', 'Connected', 'Message this code', 'valid 10 minutes', 'Add the bot to your server', 'member list', 'Saved.', '✅ Linked', '>Save<'];
  const keys = Object.keys(E.en).filter(k => /^dc\.(setup|guide)\./.test(k));
  check('every Discord setup text is a language key, filled in English, Dutch and Belgian Dutch', !E.missing.length && !N.missing.length && keys.length >= 30 && keys.every(k => N.dict[k] && B.dict[k]), [E.missing, N.missing, keys.filter(k => !N.dict[k] || !B.dict[k])]);
  check('in Dutch the Discord box has no English left (guide, labels, buttons, code line, statuses)', ENGLISH.filter(w => N.html.includes(w)).length === 0 && N.html.includes('Koppel mijn Discord') && N.html.includes('Stappenplan (7 stappen)') && N.html.includes('🟢 Verbonden') && N.html.includes('Nog niet opgeslagen') && N.html.includes('<b>Forgebot</b>') && B.html.includes('Bewaren'), ENGLISH.filter(w => N.html.includes(w)));
});
