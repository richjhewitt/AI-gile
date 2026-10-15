#!/usr/bin/env node
// aigile: CLI for AI dev teams to use the AI-gile board. Zero dependencies, Node 18+.
// Usage: node "<path>/aigile.js" help
// The command code lives in lib/cli/: core.js (settings, http, text), help.js, and one file per group of commands.
const { HELP, CliError, die, parse } = require('./lib/cli/core');
const cmds = Object.assign({}, require('./lib/cli/cmds-read'), require('./lib/cli/cmds-cards'), require('./lib/cli/cmds-team'), require('./lib/cli/cmds-secrets'), require('./lib/cli/cmds-changes'), require('./lib/cli/cmds-mail'));

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(HELP);
  const fn = cmds[cmd];
  if (!fn) die(`unknown command "${cmd}". Try: aigile help`);
  await fn(parse(rest));
})().catch(e => { console.error('error: ' + (e instanceof CliError ? e.message : e.stack || e)); process.exitCode = 1; });
