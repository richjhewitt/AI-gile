// AIG-1177: transient read failures must never turn existing chat history into an empty chat.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('chat read errors stop a read-modify-write without losing history', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-read-errors-'));
  process.env.AIGILE_DATA = dir;
  process.env.AIGILE_SECRETS_DIR = dir;
  const A = require('../../lib/atrest');
  const file = path.join(dir, 'history.chat');
  const originalRead = fs.readFileSync;
  try {
    A.writeText(file, JSON.stringify([{ text: 'keep this history' }]));
    const before = originalRead(file);
    assert.deepEqual(A.readJson(path.join(dir, 'missing.chat'), []), []);
    for (const code of ['EACCES', 'EIO', 'EPERM']) {
      let failed = false;
      fs.readFileSync = function (target, ...args) {
        if (target === file && !failed) {
          failed = true;
          throw Object.assign(new Error('simulated read failure'), { code, syscall: 'read' });
        }
        return originalRead.call(this, target, ...args);
      };
      try {
        assert.throws(() => {
          const messages = A.readJson(file, []);
          messages.push({ text: 'new message' });
          A.writeText(file, JSON.stringify(messages));
        }, { code });
      } finally { fs.readFileSync = originalRead; }
      assert.deepEqual(originalRead(file), before, code + ' must leave the sealed history unchanged');
      assert.deepEqual(A.readJson(file, []), [{ text: 'keep this history' }]);
    }
  } finally {
    fs.readFileSync = originalRead;
    // dir is the exact directory made by mkdtemp above, never a user-selected location.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
