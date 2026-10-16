// 🐢 Stall log (AIG-1405): the board is one thread, so anything slow and synchronous holds every window, CLI call and agent at
// once (the page then says it can't reach AI-gile). A tick every half second notices when it came late; a late tick, and any API
// call that took long, adds one line to data/logs/_lag.log with the calls that ran meanwhile. Nothing else is done with it:
// it is the evidence for the next "it froze" report. At most one line per few seconds; the file is kept under about 512 KB.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./store');

const STEP = 500;
const WARN = () => +process.env.AIGILE_LAG_MS || 2000;   // a stall (or a call) this long is written down
const GAP = () => +process.env.AIGILE_LAG_GAP_MS || 5000;   // at most one line per this long
const FILE = () => path.join(DATA, 'logs', '_lag.log');
let last = Date.now(), lastLine = 0, since = [];   // since: the calls that started after the previous tick

function note(text) {
  const now = Date.now(); if (now - lastLine < GAP()) return; lastLine = now;
  try {
    fs.mkdirSync(path.dirname(FILE()), { recursive: true });
    try { if (fs.statSync(FILE()).size > 512e3) fs.renameSync(FILE(), FILE() + '.old'); } catch {}
    fs.appendFileSync(FILE(), new Date(now).toISOString() + ' ' + text + '\n');
  } catch {}
}
// An API call started (server.js); returns the function that says it ended.
function call(method, pathname) {
  const t = Date.now(), what = method + ' ' + String(pathname).slice(0, 80);
  if (since.length < 8) since.push(what);
  return () => { const ms = Date.now() - t; if (ms >= WARN()) note(`slow call ${ms} ms: ${what}`); };
}
let timer = null;
function start() {
  if (timer) return;
  last = Date.now();
  timer = setInterval(() => {
    const now = Date.now(), late = now - last - STEP; last = now;
    if (late >= WARN()) note(`board stalled ${late} ms; calls started meanwhile: ${since.join(', ') || 'none (a timer or start-up work)'}`);
    since = [];
  }, STEP);
  timer.unref();
}

module.exports = { start, call, FILE };
