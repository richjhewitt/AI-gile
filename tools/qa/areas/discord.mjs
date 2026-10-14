// QA area: discord (AIG-481): only listed users are heard, DMs reach the open question's card, replies come back once, the token never shows.
import { spawnSync } from 'node:child_process';
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
  check('the right code (any case) links the sender, saved in the config, and the bot says so', o.good && o.good.linked && o.usersAfter.join() === '123456789,777777' && o.done.linked && o.done.username === 'Rich' && o.thanks.includes('Linked'), o);
  check('a code works once', o.reuse === null && o.usersFinal.join() === '123456789,777777', o);
  check('an expired code links nobody', o.late === null && o.exp.expired && o.usersEnd.join() === '123456789,777777', o);
  check('Discord errors come as plain words', o.words[0].includes("isn't a Discord user") && o.words[1].includes("isn't a Discord user") && o.words[2].includes('share a server') && o.words[3].includes('token is wrong') && o.err.includes("isn't a Discord user") && !/400/.test(o.err), [o.words, o.err]);
});
