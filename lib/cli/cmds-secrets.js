// aigile secret ask | run (AIG-585, AIG-586): see lib/secrets.js for how the value is kept and handed over.
//   secret ask <proj> <id> <NAME> "what it's for" --as X     ask the owner for a secret on a task card (never a value)
//   secret run <proj> <NAME> [--keep] [--as X] -- <command...>   run the command with the value in env var NAME; one-time unless --keep
const fs = require('fs');
const { spawn } = require('child_process');
const { die, api, project, C, who, out } = require('./core');

// Replaces the value (and its base64 form) with **** in a stream, even when it is split across two chunks.
function masker(values, write) {
  const vs = values.filter(Boolean).sort((a, b) => b.length - a.length), keep = Math.max(0, ...vs.map(v => v.length)) - 1;
  let carry = '';
  const mask = s => vs.reduce((t, v) => t.split(v).join('****'), s);
  return {
    push(chunk) {
      const t = mask(carry + chunk), cut = Math.max(0, t.length - keep);
      write(t.slice(0, cut)); carry = t.slice(cut);
    },
    end() { write(mask(carry)); carry = ''; },
  };
}

module.exports = {
  async secret({ pos, flags }) {
    const sub = pos[0];
    if (sub === 'ask') {
      const slug = await project(pos[1]), name = pos[3], why = pos.slice(4).join(' ');
      if (!pos[2] || !name || !why) die('usage: secret ask <proj> <id> <NAME> "what it is for" --as NAME');
      const c = await api('POST', C(slug, pos[2]) + '/secret-ask', { name, purpose: why, by: who(flags) });
      out(flags, { id: c.id, name }, () => `Asked the owner for ${name} on ${c.id}. Wait for the card to say it is stored, then: aigile secret run ${slug} ${name} -- <command>`);
    } else if (sub === 'run') {
      const raw = process.argv.slice(2), at = raw.indexOf('--'), cmd = at < 0 ? [] : raw.slice(at + 1);
      const slug = await project(pos[1]), name = pos[2];
      if (!name || !cmd.length) die('usage: secret run <proj> <NAME> [--keep] -- <command...>');
      const g = await api('POST', '/api/secrets/grant', { slug, name, keep: !!flags.keep, by: process.env.AIGILE_AS || (flags.as && flags.as !== true ? flags.as : '') });
      let value; try { value = fs.readFileSync(g.file, 'utf8'); } finally { try { fs.unlinkSync(g.file); } catch {} }   // one use
      const b64 = Buffer.from(value, 'utf8').toString('base64');
      const child = spawn(cmd[0], cmd.slice(1), { env: { ...process.env, [name]: value }, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true });
      const o = masker([value, b64], s => s && process.stdout.write(s)), e = masker([value, b64], s => s && process.stderr.write(s));
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', d => o.push(d)); child.stderr.on('data', d => e.push(d));
      child.on('error', er => { process.stderr.write('could not start the command: ' + String(er.message).split(value).join('****') + '\n'); process.exitCode = 127; });
      await new Promise(res => child.on('close', code => { o.end(); e.end(); if (code != null) process.exitCode = code; res(); }));
      if (!flags.keep) console.error(`(${name} was one-time and is deleted; use --keep to keep it)`);
    } else die('usage: secret ask <proj> <id> <NAME> "why" --as X   |   secret run <proj> <NAME> [--keep] -- <command...>');
  },

  // aigile sudo <proj> <server> "command" [--card AIG-x] --as NAME (AIG-1023): one server step with sudo over ssh, when sudo-ok says
  // yes. The board hands the server's saved sudo password over as a one-use file (lib/servers.js sudoGrant); it goes to ssh's stdin
  // only (sudo -S), never on a command line or in the environment, and is masked in what is printed. No password saved: sudo -n.
  async sudo({ pos, flags }) {
    const slug = await project(pos[0]), server = pos[1], command = pos.slice(2).join(' ').trim();
    if (!server || !command) die('usage: sudo <proj> <server> "command" [--card AIG-x] --as NAME');
    const me = who(flags), g = await api('POST', '/api/servers/sudo-grant', { name: server, by: me });
    let pw = '';
    if (g.file) { try { pw = fs.readFileSync(g.file, 'utf8'); } finally { try { fs.unlinkSync(g.file); } catch {} } }   // one use
    const q = s => "'" + String(s).replace(/'/g, "'\\''") + "'";   // one argument for the remote shell
    const inner = q('exec </dev/null; ' + command);   // the command itself never reads the password left on stdin
    const remote = pw ? `sudo -k -S -p '' bash -lc ${inner}` : `sudo -n bash -lc ${inner}`;
    const args = ['-o', 'BatchMode=yes', '-T', ...(g.port ? ['-p', String(g.port)] : []), ...(g.key ? ['-i', g.key] : []), '--', g.target, remote];
    if (!pw) console.error('no sudo password saved: Setup → My servers (running with sudo -n)');
    const stub = process.env.AIGILE_SSH_STUB;   // tests: a node script stands in for ssh
    const child = stub ? spawn(process.execPath, [stub, ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }) : spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const vals = pw ? [pw, Buffer.from(pw, 'utf8').toString('base64')] : [];
    const mask = s => vals.reduce((t, v) => t.split(v).join('****'), s);
    let buf = '';
    const take = d => { buf += d; if (buf.length > 400e3) buf = buf.slice(-200e3); };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', take); child.stderr.on('data', take);
    child.stdin.on('error', () => {});
    child.stdin.end(pw ? pw + '\n' : '');
    pw = '';
    const code = await new Promise(res => {
      child.on('error', er => { take('could not start ssh: ' + er.message + '\n'); res(127); });
      child.on('close', c => res(c == null ? 1 : c));
    });
    const lines = mask(buf).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    if (lines.length > 60) console.log(`(… ${lines.length - 60} earlier lines)`);
    if (buf) console.log(lines.slice(-60).join('\n'));
    console.log(`exit ${code}`);
    if (flags.card && flags.card !== true) {
      const cut = s => s.length > 200 ? s.slice(0, 199) + '…' : s;
      await api('POST', C(slug, String(flags.card)) + '/comments', { author: me, text: mask(`ran sudo on ${g.name}: ${cut(command.replace(/\s+/g, ' '))}, exit ${code}`), log: true });   // AIG-1234: each run is new, even with the same words
    }
    process.exitCode = code;
  },
};
