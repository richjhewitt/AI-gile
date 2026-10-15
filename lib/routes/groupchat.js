// 👥 Group chats (AIG-1027, lib/groupchat.js): next to the other /api/chats routes (before docs-inbox's /api/chats/:slug).
// Creating a group and writing in it are the owner's (a team call gets 403); `say` is for the members (aigile group say).
const { share } = require('./ctx');
module.exports = function routes() {
  const G = () => require('../groupchat');
  return [
    ['GET', /^\/api\/chats\/_groups$/, () => G().list()],
    ['GET', /^\/api\/chats\/_meetings$/, () => G().meetings()],   // AIG-1168: a project's Meeting Room, the same chat as a group
    ['GET', /^\/api\/chats\/_groups\/candidates$/, (_, b, q, req) => { share.ownerOnly(req); return G().candidates(); }],
    ['POST', /^\/api\/chats\/_groups$/, (_, b, q, req) => { share.ownerOnly(req); return G().create(b || {}); }],
    ['GET', /^\/api\/chats\/_groups\/([a-z0-9-]+)$/, ([id]) => G().thread(id)],
    ['GET', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/export$/, ([id], b, q, req) => { share.ownerOnly(req); return G().exportChat(id); }],   // AIG-1166: plain JSON for the owner
    ['GET', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/show$/, ([id], b, q) => G().show(id, q.get('n'))],
    ['POST', /^\/api\/chats\/_groups\/([a-z0-9-]+)$/, ([id], b, q, req) => { share.ownerOnly(req); return G().post(id, (b || {}).text, (b || {}).reply); }],
    // AIG-1164: the owner edits or deletes his own message; anyone in the group reacts (an agent names itself with as).
    ['PATCH', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/msgs\/([a-f0-9]{12})$/, ([id, mid], b, q, req) => { share.ownerOnly(req); return G().edit(id, mid, (b || {}).text); }],
    ['DELETE', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/msgs\/([a-f0-9]{12})$/, ([id, mid], b, q, req) => { share.ownerOnly(req); return G().remove(id, mid); }],
    ['POST', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/msgs\/([a-f0-9]{12})\/react$/, ([id, mid], b, q, req) => { const as = String((b || {}).as || '').trim(); if (!as || require('../store').isRich(as)) share.ownerOnly(req); return G().react(id, mid, b || {}); }],   // { emoji, as? }
    ['POST', /^\/api\/chats\/_groups\/([a-z0-9-]+)\/say$/, ([id], b) => G().say(id, b || {})],
  ];
};
