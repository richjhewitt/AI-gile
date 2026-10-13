// Expert presets (AIG-844, AIG-845): profiles/experts.json is a fixed table of presets grouped build, design, business, legal,
// money, people, marketing, support (emoji, name, keywords, role profile, model). A typed description is matched by keywords
// in plain code (no tokens). No match: the generalist preset, and the request tells the lead it may pick a better expert
// (the lead's own AIG-833 best-agent routing); never a call from here, so No AI mode works the same.
// Texts the owner reads come from the language files: expert.<id> (label), expert.can.<id> (what it can help with),
// expert.group.<id>, expert.intro, expert.request.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'profiles', 'experts.json');
const MODELS = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' };

const data = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const all = () => data().groups.flatMap(g => g.presets.map(p => ({ ...p, group: g.id })));
const find = id => (id === 'generalist' ? { ...data().generalist, group: 'business' } : all().find(p => p.id === id)) || null;
// A keyword starts a word; a short one (4 letters or fewer) is a whole word, so "ui" does not hit "uitleg".
const kw = k => { const w = String(k).trim().toLowerCase(); return new RegExp('(^|[^\\p{L}\\p{N}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + (w.length <= 4 ? '($|[^\\p{L}\\p{N}])' : ''), 'u'); };

// { preset, via: 'keywords' | 'generalist', hits }: most keywords hit wins, then the longest keyword, then table order.
function match(text) {
  const s = String(text || '').toLowerCase();
  let best = null;
  for (const p of all()) {
    const hits = p.keywords.filter(k => kw(k).test(s));
    if (!hits.length) continue;
    const score = [hits.length, Math.max(...hits.map(h => h.length))];
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) best = { preset: p, hits, score };
  }
  if (best) return { preset: best.preset, via: 'keywords', hits: best.hits };
  return { preset: find('generalist'), via: 'generalist', hits: [] };
}

const list = () => { const d = data(); return { groups: d.groups.map(g => ({ id: g.id, emoji: g.emoji, presets: g.presets.map(p => ({ id: p.id, emoji: p.emoji, name: p.name, role: p.role, model: p.model })) })), generalist: d.generalist }; };

// The roster entry for a preset on project p: "Lexi (Legal, Sonnet)", a number after the name when taken. Same preset already on: that one.
function addToRoster(p, preset, label) {
  p.team = p.team || [];
  const have = p.team.find(m => m.expert === preset.id);
  if (have) return { member: have, existed: true };
  const model = MODELS[preset.model] || 'Sonnet';
  let name = `${preset.name} (${label}, ${model})`, n = 2;
  while (p.team.some(m => m.name.toLowerCase() === name.toLowerCase())) name = `${preset.name} ${n++} (${label}, ${model})`;
  const PR = require('./profiles'), tpl = PR.template(preset.role);
  const m = { name, role: tpl ? tpl.name : '', model: preset.model, expert: preset.id, updated: require('./store').now() };
  p.team.push(m);
  if (tpl) { const ids = PR.roleIds(p.roles); if (!ids.includes(preset.role)) p.roles = PR.storeRoles([...ids, preset.role]); }
  return { member: m, existed: false };
}
module.exports = { match, list, find, all, addToRoster, MODELS };
