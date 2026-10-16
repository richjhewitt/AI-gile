// QA area: srverrors (AIG-1326): the server's refusals a friend meets (Messages, invites, sharing, cards, uploads) come from srv.* keys,
// so with the owner's language on nl or nl-BE they read in that language, placeholders filled; back on en they are the old English lines.
import { check, def } from '../lib.mjs';

def('srverrors', 'server refusals in the owner\'s language: DMs off, a missing project, an empty project name, a placeholder, in nl, nl-BE and en (AIG-1326)', async (s) => {
  const err = async (m, u, b) => { const r = await s.api(m, u, b); return { status: r.status, error: String((r.body || {}).error || '') }; };
  const tries = async () => ({
    invite: await err('POST', '/api/dms/invites', { name: 'Ana' }),
    name: await err('POST', '/api/projects', { name: '  ' }),
    card: await err('POST', '/api/projects/no-such-board-1326/cards', { title: 'x' }),
  });
  try {
    await s.ok('POST', '/api/setup', { prefs: { lang: 'nl' } });
    let r = await tries();
    check('nl: inviting while DMs are off says so in Dutch', r.invite.status === 409 && r.invite.error === "zet eerst DM's aan", JSON.stringify(r.invite));
    check('nl: an empty project name is refused in Dutch', r.name.status === 400 && r.name.error === 'een naam is verplicht', JSON.stringify(r.name));
    check('nl: a missing project reads in Dutch', r.card.status === 404 && /niet gevonden|bestaat niet/.test(r.card.error), JSON.stringify(r.card));
    check('nl: no English left in these', ![r.invite, r.name, r.card].some(x => /\b(first|required|not found|no such)\b/.test(x.error)), JSON.stringify(r));
    const { t } = await import('../../../lib/i18n.js').then(m => m.default || m);
    check('placeholders are filled', t('srv.dm.maxtext', { n: 4000 }, 'nl') === 'berichten mogen hoogstens 4000 tekens lang zijn' && t('srv.sh.checkcode', { name: 'Ana' }, 'nl-BE').includes('met Ana:'));

    await s.ok('POST', '/api/setup', { prefs: { lang: 'nl-BE' } });
    r = await tries();
    check('nl-BE: its own words for DMs', r.invite.error === 'zet eerst berichten aan', JSON.stringify(r.invite));

    await s.ok('POST', '/api/setup', { prefs: { lang: 'en' } });
    r = await tries();
    check('en: the English lines are unchanged', r.invite.error === 'turn DMs on first' && r.name.error === 'name is required', JSON.stringify(r));
  } finally { await s.api('POST', '/api/setup', { prefs: { lang: 'en' } }); }
});
