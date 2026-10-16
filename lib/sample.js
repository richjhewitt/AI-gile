// A sample project for demos (AIG-1072): one click makes a small, believable board (cards in every column, two comments, a test in
// For you, a question), marked `sample: true`, with no agent runs and no folder. One click removes it again (and only it).
// The texts are the page's language files (sample.*), written in the owner's language.
// AIG-1327: it is also a pretend service with one practice incident (card field practice: 'incident'): Major, review and runbook
// skip the swarm, wakes and files on a sample project (lib/major.js, lib/pir.js), so it all works with no AI and no folder.
const fs = require('fs');
const path = require('path');
const { load, save, now, listSlugs, DATA, bad } = require('./store');
const { t } = require('./i18n');

const SLUG = 'sample-project';
// AIG-1370: the pretend helper's name is in the owner's language too (sample.who: Sam (sample), Sam (voorbeeld)).
const who = () => t('sample.who');

function exists() { const p = load(SLUG); return !!(p && p.sample); }

function create() {
  const WHO = who();
  if (load(SLUG)) throw bad(load(SLUG).sample ? 'the sample project is already there' : 'a project called "' + SLUG + '" already exists', 409);
  const taken = new Set(listSlugs().map(load).filter(Boolean).map(o => o.key));
  const key = ['SMP', 'SMPL', 'SAMP', 'SMP2', 'SMP3'].find(k => !taken.has(k)) || 'SM' + Date.now() % 1000;
  const p = {
    slug: SLUG, name: t('sample.name'), key, parent: undefined, description: t('sample.desc'), path: '',
    created: now(), updated: now(), nextId: 1, archived: false, cards: [], team: [], log: [], sample: true,
    // AIG-1327: a made-up service with no web address (nothing is checked, nothing goes public) for the practice incident.
    service: { on: true, offers: t('sample.svc.offers'), users: t('sample.svc.users') },
  };
  // [title, status, type, priority, extra]
  const rows = [
    ['c1', 'backlog', 'feature', 'low'], ['c2', 'backlog', 'feature', 'normal'], ['c3', 'backlog', 'bug', 'normal'],
    ['c4', 'todo', 'feature', 'high'], ['c5', 'todo', 'feature', 'normal'],
    ['c6', 'doing', 'feature', 'high'],
    ['c7', 'verify', 'feature', 'normal', { testSteps: t('sample.c7.steps') }],
    ['c8', 'todo', 'feature', 'normal', { needsYou: true, ask: true }],
    ['c9', 'done', 'feature', 'normal'], ['c10', 'done', 'bug', 'normal'],
    // AIG-1327: 🔥 a practice incident the owner walks through with no AI (Major, fix and close, review, runbook line); see public/js/practice.js.
    ['inc', 'doing', 'incident', 'high', { practice: 'incident' }],
  ];
  for (const [k, status, type, priority, extra = {}] of rows) {
    const { ask, ...more } = extra;
    const c = {
      id: key + '-' + p.nextId++, title: t('sample.' + k + '.t'), description: t('sample.' + k + '.d'), testSteps: '', type, priority, status,
      assignee: '', sprint: '', blocked: false, needsYou: false, ...more, createdBy: WHO, created: now(), updated: now(), comments: [],
    };
    if (k === 'c6') c.comments.push({ author: WHO, text: t('sample.c6.say'), at: now() });
    if (k === 'inc') c.comments.push({ author: WHO, text: t('sample.inc.say'), at: now() });
    if (k === 'c7') c.comments.push({ author: WHO, text: t('sample.c7.say'), at: now() });
    if (ask) c.comments.push({ author: WHO, text: t('sample.c8.ask'), at: now(), mark: 'ask', options: [t('sample.c8.o1'), t('sample.c8.o2')] });
    p.cards.push(c);
  }
  save(p);
  return { slug: SLUG };
}

// Removes the sample project only when it is marked as one.
function remove() {
  const p = load(SLUG);
  if (!p || !p.sample) throw bad('no sample project here', 404);
  fs.unlinkSync(path.join(DATA, SLUG + '.json'));
  try { fs.rmSync(path.join(DATA, 'attachments', SLUG), { recursive: true, force: true }); } catch {}
  return { removed: SLUG };
}

module.exports = { create, remove, exists, SLUG };
