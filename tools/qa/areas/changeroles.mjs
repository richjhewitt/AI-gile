// QA area changeroles (AIG-856): Project manager / Test lead / Dev lead on a friend, per project. GET|POST /api/projects/:slug/change-roles
// (owner only), CLI change-roles, what the share role says (can.change, raise, verdict), the friend is told, old projects unchanged.
import { freePort, check, startServer, mkProject, def } from '../lib.mjs';
import { startRelay, pair, until } from './share.mjs';
import { BASE } from '../lib.mjs';

def('changeroles', 'change roles: a friend made Project manager / Test lead / Dev lead per project, owner only, API + CLI, shown in the share role, the friend is told (AIG-856)', async (s) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const a = s;
  try {
    const { cb } = await pair(a, b, relay);
    await mkProject(a, 'Roles', 'ROL'); await mkProject(b, 'Other', 'OTH'); await mkProject(a, 'Plain', 'PLN');
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${(await b.ok('GET', '/api/dms/contacts'))[0].id}`, { checked: true });
    const all = { send: true, take: true, comments: true, status: true, files: false, teamRead: false };
    const off = await a.ok('POST', '/api/shares', { slug: 'roles', contact: cb.id, allow: all });
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === off.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${off.id}/accept`, { slug: 'other', allow: all });
    const live = () => a.ok('GET', '/api/shares?slug=roles').then(l => l.find(x => x.state === 'live'));
    await until(live);
    const url = '/api/projects/roles/change-roles';

    const none = await a.ok('GET', url);
    check('a project with no change roles: nobody', none.pm.length === 0 && !none.testLead && !none.devLead && none.friends.some(f => f.id === '@' + cb.id), none);
    check('an unknown project is a 404', (await a.api('GET', '/api/projects/nope/change-roles')).status === 404 && (await a.api('POST', '/api/projects/nope/change-roles', {})).status === 404);
    check('the friend has no change role to start with', (await live()).changeRoles.length === 0 && !(await live()).can.change);

    // owner only: a team (CLI --as) and a background run are refused, the owner and the page may
    const asWho = (where, as, method, body) => fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body && JSON.stringify(body) }).then(r => r.status);
    check('owner only: a team agent and a background run are refused (GET and POST)', await asWho('terminal', 'Bastion', 'GET') === 403 && await asWho('terminal', 'Bastion', 'POST', { pm: ['@' + cb.id] }) === 403 && await asWho('background', 'Owner', 'POST', { devLead: '@' + cb.id }) === 403);
    check('owner only: nothing changed by the refused calls', (await a.ok('GET', url)).pm.length === 0);

    // validation
    check('a PM must be a friend', (await a.api('POST', url, { pm: ['@nobody'] })).status === 404 && (await a.api('POST', url, { pm: { add: 'Nobody Atall' } })).status === 404);
    check('a lead must be on the roster or a friend', (await a.api('POST', url, { testLead: 'Ghost' })).status === 404);
    check('pm must be a list or add/remove', (await a.api('POST', url, { pm: 'x' })).status === 400);

    // set
    const r1 = await a.ok('POST', url, { pm: { add: '@' + cb.id } });
    check('add a PM by @id', r1.pm.join() === '@' + cb.id, r1);
    check('adding twice keeps one', (await a.ok('POST', url, { pm: { add: '@' + cb.id } })).pm.length === 1);
    check('the share role shows it: can.change, and nothing else is lost', await until(async () => { const l = await live(); return l.changeRoles.join() === 'pm' && l.can.change.join() === 'pm' && l.can.comment === 'shared'; }));
    check('the friend is told (a label)', !!(await until(async () => (await b.ok('GET', '/api/shares?slug=other'))[0].theirChange.join() === 'pm')));
    check('only this project: another project has none', (await a.ok('GET', '/api/projects/plain/change-roles')).pm.length === 0);
    const r2 = await a.ok('POST', url, { testLead: '@' + cb.id, devLead: '@' + cb.id });
    check('one friend can hold all three; verdict is on for the Test lead', r2.testLead === '@' + cb.id && r2.devLead === '@' + cb.id && (await live()).changeRoles.join() === 'pm,testLead,devLead' && (await live()).can.verdict === true, r2);
    check('the project file keeps it as p.changeRoles', (await a.ok('GET', '/api/projects/roles')).changeRoles.pm[0] === '@' + cb.id);
    await a.ok('PATCH', `/api/shares/${off.id}`, { role: 'viewer' });
    check('a viewer who is PM keeps the share role and gains the change role', (await live()).role === 'viewer' && (await live()).can.change.includes('pm'));

    // CLI
    const ls = a.cli(['change-roles', 'roles', '--as', 'Owner'], { AIGILE_BACKGROUND: '' });
    check('CLI lists the roles', ls.code === 0 && /Project manager: /.test(ls.out) && /Test lead: /.test(ls.out), ls);
    const rm = a.cli(['change-roles', 'roles', 'Beatrix', '--pm', 'remove', '--test-lead', '--dev-lead', '--as', 'Owner'], { AIGILE_BACKGROUND: '' });
    check('CLI removes the PM and clears both leads', rm.code === 0 && /Project manager: -/.test(rm.out) && /Test lead: -/.test(rm.out) && /Dev lead: -/.test(rm.out), rm);
    const ad = a.cli(['change-roles', 'roles', 'Beatrix', '--pm', 'add', '--as', 'Owner'], { AIGILE_BACKGROUND: '' });
    check('CLI adds a PM by the friend\'s name', ad.code === 0 && /Project manager: Beatrix/.test(ad.out), ad);
    check('CLI as a team agent is refused', a.cli(['change-roles', 'roles', 'Beatrix', '--pm', 'remove', '--as', 'Bastion'], { AIGILE_AS: 'Bastion', AIGILE_WHERE: 'background' }).code !== 0);
    await a.ok('POST', url, { pm: [] });
    check('an empty list clears it and the field leaves the file', (await a.ok('GET', '/api/projects/roles')).changeRoles === undefined && !!(await until(async () => (await live()).changeRoles.length === 0)));
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
