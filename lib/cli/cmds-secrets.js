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
};
