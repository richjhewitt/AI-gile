// Playground (AIG-818, AIG-819): a project for one friend. create() makes "<Friend> playground" in the Playgrounds space, with its
// folder, the Playground project type, approvals on and a one-use Friends invite whose code carries the project and role. When
// the friend adds the code, onJoin() offers them the project with that role (Member: raise and comment, never admin).
const { load, save, bad, now } = require('./store');
const dm = require('./dm');
const PT = require('./projecttypes');

const ROLE = 'member';
const SPACE = 'playgrounds';
const clean = n => String(n || '').replace(/[\u0000-\u001f<>:"/\|?*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

// make(b): the shared project-making function of POST /api/projects, so keys, folders and spaces behave the same.
function create(friend, make, slugify) {
  const who = clean(friend);
  if (!who) throw bad('friend name is required');
  const name = who + ' playground', slug = slugify(name);
  if (!slug) throw bad('name needs some letters or numbers');
  if (load(slug)) throw bad('project "' + slug + '" already exists', 409);
  const invite = dm.createInvite({ name: who, days: 7, play: { slug, role: ROLE } });   // first: throws if DMs are off, before anything is made
  if (!load(SPACE)) make({ name: 'Playgrounds', slug: SPACE, description: 'One playground project per friend.' });
  const made = make({ name, slug, parent: SPACE, folder: true });
  const p = load(slug);
  PT.apply(p, 'playground');
  p.approvals = true;
  save(p);
  return { slug, name, space: SPACE, folder: made.folder, role: ROLE, code: invite.code, expires: invite.expires };
}

// The friend added the code: offer them the project (their side asks them to accept). No safety-code check: I made this code for them.
function onJoin(contact, play) {
  const p = load(String(play && play.slug || '')); if (!p) return;
  const B = require('./share-base');
  if (B.ofProject(p.slug)) return;
  const L = B.write({ v: 1, id: require('crypto').randomBytes(16).toString('base64url'), contact: contact.id, slug: p.slug, state: 'offered',
    mine: B.cleanAllow({}), theirs: null, theirName: '', on: true, seqOut: 0, seqIn: 0, created: now(), exp: Date.now() + B.OFFER_MS, role: B.isRole(play.role) ? play.role : ROLE });
  B.queueOn(L.id, 'link-offer', { name: B.cleanName(p.name), allow: L.mine, exp: L.exp, role: B.roleOf(L) });
}

module.exports = { create, onJoin, ROLE, SPACE };
