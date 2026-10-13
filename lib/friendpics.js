// Your picture for a friend or a pending invite (AIG-883). Same storage, size limit and formats as the owner's own
// picture (logos.js, data/logos/_fr-<id>.<ext>), kept on this board only: nothing here is ever sent to the friend.
// <id> is the contact id, or the id of the invite that became that contact (the friend joins under the invite's id,
// so the picture follows). `_frt-<id>` is the friend's own picture when one arrives; yours always wins and Remove
// brings theirs back.
const L = require('./logos');
const { bad } = require('./store');

const ID = /^[0-9a-f]{12}$/;
const urls = id => {
  const mine = L.urlFor('_fr-' + id, '/api/friend-pics/' + id), theirs = L.urlFor('_frt-' + id, '/api/friend-pics/' + id + '/theirs');
  return { pic: mine || theirs, mine: !!mine };
};
function known(id) {
  const dm = require('./dm');
  if (!ID.test(String(id))) throw bad('no such friend or invite', 404);
  if (!dm.contacts().some(c => c.id === id) && !dm.pendingInvite(id)) throw bad('no such friend or invite', 404);
  return id;
}
const fileOf = (id, theirs) => { const f = L.logoFile((theirs ? '_frt-' : '_fr-') + known(id)); if (!f) throw bad('no picture', 404); return f; };
function set(id, b) { L.saveLogo('_fr-' + known(id), b); return { id, ...urls(id) }; }
function remove(id) { L.removeLogo('_fr-' + known(id)); return { id, ...urls(id) }; }
function forget(id) { if (ID.test(String(id))) { L.removeLogo('_fr-' + id); L.removeLogo('_frt-' + id); } }

module.exports = { urls, fileOf, set, remove, forget };
