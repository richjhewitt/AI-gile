// One owner message to every active project (AIG-794).
const { S, listSlugs, load, share, bad } = require('./ctx');
const { t } = require('../i18n');
module.exports = function routes() {
  const create = require('./projects-cards')().find(([method, re]) => method === 'POST' && re.test('/api/projects/example/cards'))[2];
  return [['POST', /^\/api\/allhands$/, (_, b, q, req) => {
    share.ownerOnly(req);
    const text = String((b || {}).text || '');
    if (!text.trim()) throw bad(t('dms.empty'));
    const title = t('allhands.title', { text: text.trim().split(/\r?\n/)[0].slice(0, 70) }, 'en');
    return listSlugs().map(load).filter(p => p && !p.archived).map(p => {
      const c = create([p.slug], { title, description: text, type: 'task', status: 'team', createdBy: S.owner(), quick: true, allhands: true });
      return { slug: p.slug, id: c.id };
    });
  }]];
};
