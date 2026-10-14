// 👥 Group chats (AIG-1027, lib/groupchat.js): next to the other /api/chats routes (before docs-inbox's /api/chats/:slug).
// Creating a group and writing in it are the owner's (a team call gets 403); `say` is for the members (aigile group say).
const { share } = require('./ctx');
module.exports = function routes() {
  const G = () => require('../groupchat');
  return [
    ['GET', /^\/api\/chats\/_groups$/, () => G().list()],
    ['GET', /^\/api\/chats\/_groups\/candidates$/, (_, b, q, req) => { share.ownerOnly(req); return G().candidates(); }],
    ['POST', /^\/api\/chats\/_groups$/, (_, b, q, req) => { share.ownerOnly(req); return G().create(b || {}); }],
    ['GET', /^\/api\/chats\/_groups\/([a-z0-9-]+)$/, ([id]) => G().thread(id)],
    ['GET', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/show$/, ([id], b, q) => G().show(id, q.get('n'))],
    ['POST', /^\/api\/chats\/_groups\/([a-z0-9-]+)$/, ([id], b, q, req) => { share.ownerOnly(req); return G().post(id, (b || {}).text); }],
    ['POST', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/say$/, ([id], b) => G().say(id, b || {})],
  ];
};
