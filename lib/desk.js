// 🛎️ Service desk sorting (AIG-1104, docs/SERVICE-MGMT-PLAN.md phase 2, card 6): a card that comes in from the public feedback form or
// from a friend (the friend lane, an approved request) on a project where the service is on gets a desk kind, c.desk = { kind, auto }:
// incident (something is broken), request (please add / could you) or idea (anything else), by plain word rules, no AI. An incident
// also becomes an incident card (c.desk.was remembers the type it had). The owner can change the kind on the card (setKind).
const S = require('./store');

const KINDS = ['request', 'incident', 'idea'];
const INCIDENT = /\b(broken|breaks?|down|outage|errors?|crash(?:es|ed|ing)?|fails?|failed|failing|failure|not working|doesn[’']?t work|does not work|won[’']?t (?:load|open|work|start)|can[’']?t|cannot|unable to|offline|unreachable|stuck|kapot|werkt niet|storing|fout|foutmelding)\b|\b50[0-4]\b/i;
const REQUEST = /\b(please (?:add|make|allow|support|build|create|change)|could you|can you|would you|would it be possible|feature|i[’']?d like|i would like|i want|add support|wish|graag|kunnen jullie|zou je)\b/i;

// The kind for a piece of text: a broken thing wins over a wish.
function classify(text) {
  const t = String(text == null ? '' : text);
  return INCIDENT.test(t) ? 'incident' : REQUEST.test(t) ? 'request' : 'idea';
}
// A new desk card: sorted only where the service is on. Mutates the card (before it is saved); returns the kind or null.
function sort(p, c, text) {
  if (!require('./service').of(p)) return null;
  const kind = classify(text);
  c.desk = { kind, auto: true };
  if (kind === 'incident' && c.type !== 'incident') { c.desk.was = c.type; c.type = 'incident'; if (c.priority === 'normal') c.priority = 'high'; }
  return kind;
}
// The owner changes the kind: an incident becomes an incident card, leaving incident gives the old type back.
function setKind(p, c, kind) {
  kind = String(kind || '');
  if (!KINDS.includes(kind)) throw S.bad('the desk kind must be request, incident or idea');
  const d = c.desk = { ...(c.desk || {}), kind, auto: false };
  if (kind === 'incident' && c.type !== 'incident') { d.was = c.type; c.type = 'incident'; }
  else if (kind !== 'incident' && c.type === 'incident' && d.was) { c.type = d.was; delete d.was; }
  c.updated = S.now();
  return d;
}
module.exports = { KINDS, classify, sort, setKind };
