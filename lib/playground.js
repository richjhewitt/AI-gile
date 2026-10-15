// Playground (AIG-818, AIG-819): a project for one friend. create() makes "<Friend> playground" in the Playgrounds space, with its
// folder, the Playground project type, approvals on, then (last) a one-use Friends invite. The Member role is fixed here (raise and
// comment, never admin); it rides on the invite only through dm.createInvite's second argument, which the public invite route never passes.
// The share is offered once the friend is a checked contact: straight away for a friend already checked, else when the owner ticks
// "They match" (dm.patchContact -> onChecked). The normal safety-code rule is never skipped.
const fs = require('fs');
const path = require('path');
const { load, save, bad, DATA } = require('./store');
const dm = require('./dm');
const PT = require('./projecttypes');

const ROLE = 'member';
const SPACE = 'playgrounds';
const clean = n => String(n || '').replace(/[\u0000-\u001f<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

// make(b): the shared project-making function of POST /api/projects, so keys, folders and spaces behave the same.
async function create(friend, make, slugify) {
  const who = clean(friend);
  if (!who) throw bad('friend name is required');
  const name = who + ' playground', slug = slugify(name);
  if (!slug) throw bad('name needs some letters or numbers');
  if (load(slug)) throw bad('project "' + slug + '" already exists', 409);
  if (!dm.on()) throw bad('turn DMs on first', 409);
  const known = dm.contacts().find(c => !c.blocked && String(c.name).toLowerCase() === who.toLowerCase());
  try {
    if (!load(SPACE)) make({ name: 'Playgrounds', slug: SPACE, description: 'One playground project per friend.', team: false, teamless: true });   // a holder only: the playgrounds inside have the teams (AIG-1298)
    const made = make({ name, slug, parent: SPACE, folder: true });
    const p = load(slug);
    PT.apply(p, 'playground');
    p.approvals = true;
    save(p);
    const out = { slug, name, space: SPACE, folder: made.folder, role: ROLE, code: '', friend: 'new' };
    if (known) {
      out.friend = known.checked ? 'checked' : 'unchecked';
      if (known.checked) await require('./share').offer({ slug, contact: known.id, role: ROLE });
      else dm.holdPlay(known.id, { slug, role: ROLE });
    } else {
      const inv = dm.createInvite({ name: who, days: 7 }, { play: { slug, role: ROLE } });   // last: nothing to undo after it
      out.code = inv.code; out.expires = inv.expires;
    }
    return out;
  } catch (e) {
    if (load(slug)) try { fs.unlinkSync(path.join(DATA, slug + '.json')); } catch {}   // no half playground: a retry starts clean (a made folder is kept)
    throw e;
  }
}

// The owner checked the safety code of a friend with a playground waiting: offer it (a failure just leaves the normal Share dialog).
function onChecked(contactId, play) {
  if (!play || !load(String(play.slug || ''))) return;
  require('./share').offer({ slug: play.slug, contact: contactId, role: ROLE }).catch(() => {});
}

module.exports = { create, onChecked, ROLE, SPACE };
