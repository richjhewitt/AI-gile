// QA area: service (AIG-1046): per-project Service details. Off by default; fields save; a bad URL is refused; the home card shows
// one line; onCall falls back to the lead; only the owner may PATCH.
import { check, tmp, mkProject, def, openPage, noErrors } from '../lib.mjs';

def('service', '🛎️ Service details: off by default, fields save, bad URL refused, home line, on-call falls back to lead, owner-only PATCH (AIG-1046)', async (s, ctx) => {
  await s.ok('POST', '/api/setup', { owner: 'Rich', 'agent.command': 'echo', 'agent.notesFile': 'CLAUDE.md', 'agent.settingsFile': '.claude/settings.json' });
  await mkProject(s, 'Svc', 'SVC', { path: tmp('service') });
  await s.ok('POST', '/api/projects/svc/team', { name: 'Svc Lead', role: 'Lead', model: 'sonnet' });
  const S = (await import('../../../lib/service.js')).default;
  const p0 = await s.ok('GET', '/api/projects/svc');
  check('off by default: no service stored, none in the list', !p0.service && !(await s.ok('GET', '/api/projects')).find(x => x.slug === 'svc').service);
  check('of() is null when not set', S.of(p0) === null);
  const bad = async url => (await s.api('PATCH', '/api/projects/svc', { service: { on: true, url } })).status;
  check('javascript: and plain words are refused', (await bad('javascript:alert(1)')) === 400 && (await bad('radio')) === 400);
  check('nothing saved by the refused ones', !(await s.ok('GET', '/api/projects/svc')).service);
  const team = (await s.ok('GET', '/api/projects/svc')).team || [];
  const set = await s.ok('PATCH', '/api/projects/svc', { service: { on: true, offers: 'Radio streaming', users: 'Listeners', url: 'https://svc.example.com/live', public: true } });
  const sv = set.service;
  check('fields save', sv && sv.on && sv.offers === 'Radio streaming' && sv.users === 'Listeners' && sv.url === 'https://svc.example.com/live' && sv.public === true, sv);
  check('an unknown on-call is refused', (await s.api('PATCH', '/api/projects/svc', { service: { onCall: 'Nobody Here' } })).status === 400);
  const p1 = await s.ok('GET', '/api/projects/svc');
  const lead = S.leadName(p1);
  check('onCall falls back to the lead when none is chosen', S.onCall(p1) === lead && S.of(p1).onCall === lead, lead);
  check('services() lists it', S.services([p1]).length === 1 && S.services([p1])[0].slug === 'svc');
  const home = await openPage(ctx, '#/');
  await home.waitForSelector('a.proj .svc-line');
  const txt = await home.locator('a.proj:has-text("Svc") .svc-line').innerText();
  check('the home card shows the line with offers, on-call and URL', /Radio streaming/.test(txt) && /on-call/i.test(txt) && /svc\.example\.com/.test(txt), txt);
  const off = await s.ok('PATCH', '/api/projects/svc', { service: { on: false } });
  check('switching off hides it but keeps the fields', !(await s.ok('GET', '/api/projects')).find(x => x.slug === 'svc').service && (await s.ok('GET', '/api/projects/svc')).service.offers === 'Radio streaming');
  const r = await fetch(s.base + '/api/projects/svc', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'cli', 'X-Aigile-As': encodeURIComponent('Svc Lead') }, body: JSON.stringify({ service: { on: true } }) });
  check('a team member (not the owner) gets 403', r.status === 403 && !(await s.ok('GET', '/api/projects/svc')).service.on, r.status);
  await noErrors(home);
}, true);
