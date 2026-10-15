// Go / no-go chain (AIG-858, spec: docs/CHANGE-CONTROL.md "Go / no-go chain"). A change card (AIG-857) is submitted; the named approvers
// say Go or No go; all Go = approved (the card may go live, AIG-859 checks that too), one No go = back to To do with the note.
// Stored on the card: c.change.approvers ["who"], votes {who:{go,note,at}}, round, rounds (last 10), approved (ISO time of the OK),
// and the AIG-814 field c.approval ('waiting' while the chain runs, 'declined' after a No go, gone once approved), which the
// Approvals module already treats as "not for the team". A "who" is a roster name, the owner's name, or "@<contactId>" for a friend.
const { now, load, save, bad, owner, isRich, listSlugs } = require('./store');
const { t: tr } = require('./i18n');
const approvals = require('./approvals');
const roles = require('./changeroles');
const cw = require('./changewin');

const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };
const chg = (p, id) => {
  const c = (p.cards || []).find(x => x.id.toLowerCase() === String(id).toLowerCase());
  if (!c) throw bad('no such card', 404);
  if (c.type !== 'change') throw bad(c.id + ' is not a change card');
  return c;
};
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const note1 = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 500);
const keyOf = (x, who) => Object.keys((x && x.votes) || {}).find(k => same(k, who));
const view = (p, c) => require('./changes').view(p, c);

// The default approvers: dev lead, test lead, owner (unset roles skipped). An emergency change (from an open incident): owner only.
// Nobody votes on a change they raised or are assigned to: that vote goes to the owner.
function defaults(p, c) {
  const l = roles.leads(p);
  let a = cw.emergency(p, c) ? [owner()] : [l.devLead, l.testLead, owner()].filter(Boolean);
  if (a.some(w => !isRich(w) && (same(w, c.createdBy) || same(w, c.assignee)))) a = a.filter(w => isRich(w) || !(same(w, c.createdBy) || same(w, c.assignee))).concat([owner()]);
  return [...new Set(a.map(w => (isRich(w) ? owner() : w)))];
}
function cleanApprovers(list) {
  if (!Array.isArray(list)) throw bad('approvers must be a list');
  const out = [...new Set(list.map(w => String(w || '').replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).map(w => (isRich(w) ? owner() : w)))];
  if (!out.length || out.length > 10) throw bad('give 1 to 10 approvers');
  return out;
}
function closeRound(x, result) {
  x.rounds = [...(x.rounds || []), { round: x.round || 1, votes: x.votes || {}, result, at: now() }].slice(-10);
}
const post = (c, author, text) => { (c.comments = c.comments || []).push({ author, at: now(), text }); c.updated = now(); };

// Submit: the card shows in the Approvals tab (approval: 'waiting') for each approver without a vote.
function submit(slug, id, b = {}, by = '') {
  const p = proj(slug), c = chg(p, id), x = c.change = c.change || {};
  if (c.status === 'done') throw bad('this change is already done');
  if (approvals.waiting(c)) throw bad('this change is already waiting for go / no go', 409);
  if (x.approved) throw bad('this change is already approved', 409);
  if (!String(x.undo || '').trim()) throw bad('say how to undo it before you submit (undo)');
  x.approvers = b.approvers !== undefined ? cleanApprovers(b.approvers) : defaults(p, c);
  x.round = (x.round || 0) + 1; x.votes = {}; x.submittedBy = String(by || '').slice(0, 80) || undefined;
  c.approval = 'waiting'; c.updated = now(); save(p);
  return view(p, c);
}

// One vote. `who` is the voter's "who"; the caller has already proved who that is.
function vote(slug, id, who, b = {}) {
  const p = proj(slug), c = chg(p, id), x = c.change || {};
  if (!approvals.waiting(c) || !Array.isArray(x.approvers)) throw bad('this change is not waiting for go / no go', 409);
  const w = isRich(who) ? owner() : String(who || '');
  const mine = x.approvers.find(a => same(a, w));
  if (!mine) throw bad(w + ' is not an approver of this change', 403);
  if (!isRich(w) && (same(w, c.createdBy) || same(w, c.assignee))) throw bad('you cannot vote on a change you raised or are assigned to', 403);
  if (b.go === undefined || b.go === null || b.go === '') throw bad('go is true or false');
  const go = b.go === true || b.go === 'true' || b.go === 1;
  const note = note1(b.note);
  if (!go && !note) throw bad('a No go needs a note: say what has to change');
  x.votes = x.votes || {};
  x.votes[mine] = { go, note, at: now() };
  if (!go) {   // the Approvals decline path: back to To do, the note to the author, the round closed
    c.approval = 'declined'; c.status = 'todo'; closeRound(x, 'nogo');
    post(c, mine, tr('gonogo.comment.nogo', { note }));
  } else if (x.approvers.every(a => { const k = keyOf(x, a); return k && x.votes[k].go; })) {   // all Go: the same end state as an owner Approve
    x.approved = now(); delete c.approval; closeRound(x, 'go');
  }
  c.updated = now(); save(p);
  return view(p, c);
}
// A friend's vote over the share link: kind 'vote' { change, go, note }. The caller has checked the link's change role.
function fromFriend(L, p) {
  try { vote(L.slug, String(p.change), '@' + L.contact, { go: p.go === true, note: p.note }); return true; } catch { return false; }
}
// Override (owner only): approved without the vote; logged on the card as a decision.
function goAnyway(slug, id, b = {}) {
  const p = proj(slug), c = chg(p, id), x = c.change = c.change || {};
  if (x.approved) throw bad('this change is already approved', 409);
  const note = note1(b.note);
  x.round = x.round || 1; x.votes = x.votes || {};
  x.approved = now(); x.anyway = { by: owner(), note, at: x.approved }; delete c.approval; closeRound(x, 'anyway');
  post(c, owner(), tr('gonogo.comment.anyway', { note: note || '-' }));
  save(p); return view(p, c);
}
// Who votes, from the request: no As header = the board page = the owner.
function voterOf(req) {
  const h = (req && req.headers) || {}, where = h['x-aigile-where'];
  let as = ''; try { as = decodeURIComponent(String(h['x-aigile-as'] || '')); } catch {}
  if (!where && !as) return owner();
  if (where === 'background') throw bad('a background run cannot vote', 403);
  if (!as) throw bad('--as NAME is required to vote', 400);
  return as;
}
// Done check (AIG-859 calls this): a change card goes live only when approved. Cards with no c.change at all are old data and keep
// working; an emergency change (from an open incident) is excepted.
function guard(p, c) {
  if (c.type !== 'change' || !c.change || c.change.approved || cw.emergency(p, c)) return;
  throw bad('this change is not approved yet: submit it for go / no go' + (approvals.waiting(c) ? ' (waiting for the approvers)' : ''));
}

// Cards waiting for the owner's own vote, for the Approvals tab (merged into its list).
function forOwner() {
  const out = [];
  for (const slug of listSlugs()) {
    const p = load(slug); if (!p) continue;
    for (const c of p.cards || []) {
      const x = c.change;
      if (c.type !== 'change' || !approvals.waiting(c) || !x || !Array.isArray(x.approvers)) continue;
      if (!x.approvers.some(a => same(a, owner())) || keyOf(x, owner())) continue;
      out.push({ link: 'chg~' + slug, share: c.id, friend: x.submittedBy || '', project: slug, projectName: p.name || slug, title: c.title, description: x.what || '', type: 'change', priority: c.priority, req: '', change: true, at: c.updated || c.created });
    }
  }
  return out;
}

module.exports = { defaults, submit, vote, fromFriend, goAnyway, voterOf, guard, forOwner };
