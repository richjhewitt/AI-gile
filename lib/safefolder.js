// One gate for everything that writes into a project's folder or runs git there (AIG-944). The tester's sandbox (AIGILE_SANDBOX=1)
// is a copy of the board whose projects point at REAL folders, and QA servers (AIGILE_QA_TOKEN) may be handed one by mistake:
// in both only folders under the OS temp dir may be touched. Anywhere else this returns true.
const path = require('path');
const os = require('os');

const restricted = () => !!(process.env.AIGILE_SANDBOX || process.env.AIGILE_QA_TOKEN);
const norm = x => path.resolve(String(x)).split(path.sep).join('/').toLowerCase().replace(/\/+$/, '');

function mayTouch(folder) {
  if (!restricted()) return true;
  if (!folder) return false;
  const f = norm(folder);
  return [os.tmpdir(), process.env.TEMP, process.env.TMP].filter(Boolean).map(norm).some(t => f.startsWith(t + '/'));
}
// Throws a 409 when the folder is off limits; `what` says what was refused.
function guard(folder, what) {
  if (mayTouch(folder)) return;
  const e = new Error('sandbox: refused to ' + (what || 'touch') + ' in a real project folder (' + folder + ')'); e.code = 409; throw e;
}
module.exports = { mayTouch, guard, restricted };
