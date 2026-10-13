// QA area: gonogo (AIG-858): the go / no-go chain on a change card. submit / vote / go-anyway (API + CLI), default approvers, one No go sends it back,
// all Go = approved, the done check wants "approved" (emergency and old cards excepted), the owner's tab entry, a friend's vote over the share link, the vote panel.
import { freePort, check, startServer, mkProject, mkCard, getCard, def, openPage, noErrors } from '../lib.mjs';
import { startRelay, pair, until } from './share.mjs';

const E = { AIGILE_BACKGROUND: '' };

def('gonogo', '🚦 go / no-go chain: submit, vote, go-anyway, default approvers, No go back to To do, done needs approved, friend vote over the link, vote panel (AIG-858)', async (s, ctx) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const a = s;
  try {
    const { cb } = await pair(a, b, relay);
    await mkProject(a, 'Go', 'GO'); await mkProject(b, 'Other', 'OTH'); await mkProject(a, 'Solo', 'SOL');
    await a.ok('POST', '/api/projects/go/team', { name: 'Bastion', role: 'Dev', model: 'sonnet' });
    await a.ok('POST', '/api/projects/go/team', { name: 'Tess', role: 'Test', model: 'sonnet' });
    await a.ok('POST', '/api/projects/go/change-roles', { devLead: 'Bastion', testLead: 'Tess' });
    const mk = (title, extra = {}) => a.ok('POST', '/api/projects/go/changes', { title, undo: 'put it back', createdBy: 'Pia', ...extra });
    const base = id => `/api/projects/go/changes/${id}`;
    const cardOf = id => getCard(a, 'go', id);

    // submit
    const noUndo = await a.ok('POST', '/api/projects/go/changes', { title: 'No undo yet' });
    check('submit needs the how-to-undo', (await a.api('POST', base(noUndo.id) + '/submit', {})).status === 400);
    check('submit on a plain card is refused, unknown card is 404', (await a.api('POST', `/api/projects/go/changes/${(await mkCard(a, 'go', 'T', { type: 'task' })).id}/submit`, {})).status === 400 && (await a.api('POST', '/api/projects/go/changes/GO-99/submit', {})).status === 404);
    const c1 = await mk('Move the database');
    const sub = await a.ok('POST', base(c1.id) + '/submit', {});
    check('submit: default approvers dev lead, test lead, owner; round 1; approval waiting', sub.approvers.length === 3 && sub.approvers[0] === 'Bastion' && sub.approvers[1] === 'Tess' && sub.round === 1 && (await cardOf(c1.id)).approval === 'waiting', sub);
    check('submitting twice is refused', (await a.api('POST', base(c1.id) + '/submit', {})).status === 409);
    const tab = await a.ok('GET', '/api/shares-approvals');
    check('the owner has it in the Approvals tab (not the approvers who are not the owner)', tab.cards.some(x => x.change && x.share === c1.id && x.link === 'chg~go'), tab);
    check('going live is refused while it waits', (await a.api('PATCH', `/api/projects/go/cards/${c1.id}`, { status: 'done' })).status === 400);

    // votes
    check('a non-approver cannot vote (CLI)', a.cli(['change', 'go', c1.id, 'go', 'fine', '--as', 'Mallory'], E).code !== 0);
    check('a No go needs a note', a.cli(['change', 'go', c1.id, 'nogo', '--as', 'Bastion'], E).code !== 0 && (await a.api('POST', base(c1.id) + '/vote', { go: false })).status === 400);
    check('a vote needs go to be set', (await a.api('POST', base(c1.id) + '/vote', {})).status === 400);
    const v1 = a.cli(['change', 'go', c1.id, 'go', 'looks fine', '--as', 'Bastion'], E);
    check('CLI go as the dev lead', v1.code === 0 && /Bastion go/.test(v1.out) && /Tess waiting/.test(v1.out), v1);
    await a.ok('POST', base(c1.id) + '/vote', { go: true, note: 'owner ok' });
    check('the owner has voted: gone from the Approvals tab', !(await a.ok('GET', '/api/shares-approvals')).cards.some(x => x.share === c1.id));
    check('still waiting for the test lead', (await cardOf(c1.id)).approval === 'waiting' && !(await cardOf(c1.id)).change.approved);
    check('a vote can be changed before the round ends', a.cli(['change', 'go', c1.id, 'go', 'tested', '--as', 'Tess'], E).code === 0);
    const done1 = await cardOf(c1.id);
    check('all Go: approved, approval cleared like an owner Approve', !!done1.change.approved && done1.approval === undefined && done1.change.rounds.length === 1 && done1.change.rounds[0].result === 'go', done1.change);
    check('an approved change may go live', (await a.ok('PATCH', `/api/projects/go/cards/${c1.id}`, { status: 'done' })).status === 'done');

    // No go
    const c2 = await mk('Risky thing');
    await a.ok('POST', base(c2.id) + '/submit', {});
    await a.ok('PATCH', `/api/projects/go/cards/${c2.id}`, { status: 'doing' });
    const ng = a.cli(['change', 'go', c2.id, 'nogo', 'no rollback tested', '--as', 'Tess'], E);
    const c2n = await cardOf(c2.id);
    check('one No go: card back to To do, declined, round closed, note as a comment', ng.code === 0 && c2n.status === 'todo' && c2n.approval === 'declined' && !c2n.change.approved && c2n.change.rounds[0].result === 'nogo' && c2n.comments.some(m => m.author === 'Tess' && /no rollback tested/.test(m.text)), c2n);
    check('after a No go nobody else can vote', (await a.api('POST', base(c2.id) + '/vote', { go: true })).status === 409);
    check('done is refused until approved', (await a.api('PATCH', `/api/projects/go/cards/${c2.id}`, { status: 'done' })).status === 400);
    const re = a.cli(['change', 'go', c2.id, 'submit', '--as', 'Pia'], E);
    const c2r = await cardOf(c2.id);
    check('re-submit starts round 2 with empty votes, rounds keeps round 1', re.code === 0 && c2r.change.round === 2 && Object.keys(c2r.change.votes).length === 0 && c2r.change.rounds.length === 1 && c2r.approval === 'waiting', c2r.change);
    check('the author does not vote on their own change (Pia is not an approver)', a.cli(['change', 'go', c2.id, 'go', 'x', '--as', 'Pia'], E).code !== 0);

    // Go anyway
    check('go-anyway is owner only', a.cli(['change', 'go', c2.id, 'go-anyway', 'now', '--as', 'Bastion'], E).code !== 0 && !(await cardOf(c2.id)).change.approved);
    const ga = await a.ok('POST', base(c2.id) + '/go-anyway', { note: 'customer is waiting' });
    const c2g = await cardOf(c2.id);
    check('go-anyway: approved, logged as a decision comment and in rounds', !!ga.approved && c2g.change.anyway.note === 'customer is waiting' && c2g.approval === undefined && c2g.change.rounds.slice(-1)[0].result === 'anyway' && c2g.comments.some(m => /customer is waiting/.test(m.text)), c2g.change);
    check('go-anyway twice is refused', (await a.api('POST', base(c2.id) + '/go-anyway', {})).status === 409);

    // approvers can be named, and the author is swapped for the owner
    const c3 = await mk('Named', { createdBy: 'Bastion' });
    const sub3 = await a.ok('POST', base(c3.id) + '/submit', {});
    check('the author is never an approver: the owner votes instead', !sub3.approvers.includes('Bastion') && sub3.approvers.includes('Tess'), sub3);
    const c4 = await mk('Named by hand');
    check('approvers can be given on submit', (await a.ok('POST', base(c4.id) + '/submit', { approvers: ['Tess'] })).approvers.join() === 'Tess');
    check('bad approvers are refused', (await a.api('POST', base((await mk('x')).id) + '/submit', { approvers: [] })).status === 400);

    // emergency and old data
    const inc = await mkCard(a, 'go', 'Site down', { type: 'incident', status: 'todo' });
    const em = await mk('Hotfix', { from: inc.id });
    check('an emergency change defaults to owner-only approval', (await a.ok('POST', base(em.id) + '/submit', {})).approvers.length === 1);
    const em2 = await mk('Hotfix 2', { from: inc.id });
    check('an emergency change may go live without the chain', (await a.ok('PATCH', `/api/projects/go/cards/${em2.id}`, { status: 'done' })).status === 'done');
    const plain = await mk('Never submitted');
    check('an unsubmitted change is refused at done', (await a.api('PATCH', `/api/projects/go/cards/${plain.id}`, { status: 'done' })).status === 400);
    const old = await mkCard(a, 'go', 'Old change card', { type: 'change', status: 'todo' });
    check('old data: a change card with no change fields still moves to done', (await a.ok('PATCH', `/api/projects/go/cards/${old.id}`, { status: 'done' })).status === 'done');
    const sw = await a.ok('GET', '/api/projects/go');
    check('a waiting change card is not given to the team (approval: waiting)', sw.cards.filter(c => c.type === 'change' && c.approval === 'waiting').length >= 2);

    // a friend's vote over the share link
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${(await b.ok('GET', '/api/dms/contacts'))[0].id}`, { checked: true });
    const all = { send: true, take: true, comments: true, status: true, files: false, teamRead: false };
    const off = await a.ok('POST', '/api/shares', { slug: 'solo', contact: cb.id, allow: all });
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === off.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${off.id}/accept`, { slug: 'other', allow: all });
    await until(async () => (await a.ok('GET', '/api/shares?slug=solo')).find(x => x.state === 'live'));
    const sp = (m, u, body) => a.ok(m, '/api/projects/solo' + u, body);
    const f1 = await sp('POST', '/changes', { title: 'Friend votes', undo: 'revert' });
    await sp('POST', '/changes/' + f1.id + '/submit', { approvers: ['@' + cb.id, 'Owner'] });
    const vb = id => b.api('POST', `/api/shares/${off.id}/vote`, id);
    check('the friend side checks its input', (await vb({ change: 'nope', go: true })).status === 400 && (await vb({ change: f1.id, go: false })).status === 400 && (await vb({ change: f1.id })).status === 400);
    await vb({ change: f1.id, go: true });
    await new Promise(r => setTimeout(r, 1500));
    check('no change role on the link: the vote is refused', !(((await getCard(a, 'solo', f1.id)).change.votes || {})['@' + cb.id]));
    await a.ok('POST', '/api/projects/solo/change-roles', { testLead: '@' + cb.id });
    await until(async () => (await a.ok('GET', '/api/shares?slug=solo')).find(x => x.state === 'live').changeRoles.length === 1);
    await vb({ change: f1.id, go: true, note: 'friend ok' });
    check('a friend with a change role who is an approver: the vote counts', !!(await until(async () => ((await getCard(a, 'solo', f1.id)).change.votes || {})['@' + cb.id])), (await getCard(a, 'solo', f1.id)).change);
    const f2 = await sp('POST', '/changes', { title: 'Friend not named', undo: 'revert' });
    await sp('POST', '/changes/' + f2.id + '/submit', { approvers: ['Owner'] });
    await vb({ change: f2.id, go: false, note: 'nope' });
    await new Promise(r => setTimeout(r, 1500));
    check('a friend who is not an approver changes nothing', Object.keys((await getCard(a, 'solo', f2.id)).change.votes).length === 0 && (await getCard(a, 'solo', f2.id)).approval === 'waiting');
    const f3 = await sp('POST', '/changes', { title: 'Friend says no', undo: 'revert' });
    await sp('POST', '/changes/' + f3.id + '/submit', { approvers: ['@' + cb.id] });
    await vb({ change: f3.id, go: false, note: 'too risky' });
    check('a friend No go with a note sends it back', !!(await until(async () => (await getCard(a, 'solo', f3.id)).approval === 'declined')) && (await getCard(a, 'solo', f3.id)).comments.some(m => /too risky/.test(m.text)));

    // the vote panel on the open card (owner, no leads: a plain project)
    await a.ok('POST', '/api/projects/solo/change-roles', { testLead: '' });
    const pc = await sp('POST', '/changes', { title: 'Panel change', undo: 'revert' });
    const page = await openPage(ctx, `#/p/solo/${pc.id}`);
    await page.waitForSelector('.gonogo');
    check('the panel offers Submit for go before it is submitted', (await page.locator('.gonogo button', { hasText: 'Submit for go' }).count()) === 1);
    await page.click('.gonogo button.primary');
    await page.waitForSelector('.gonogo textarea');
    check('after submit the panel shows the owner as approver and Go / No go / Go anyway', /Waiting for the approvers/.test(await page.innerText('.gonogo')) && (await page.locator('.gonogo .actions button').count()) === 3);
    await page.click('.gonogo .actions button.good');
    await page.waitForFunction(() => /Approved/.test((document.querySelector('.gonogo') || {}).innerText || ''));
    check('Go from the panel approves it', !!(await getCard(a, 'solo', pc.id)).change.approved);
    await noErrors(page);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
