// Real-life tasks (AIG-394): cards for life outside code (housework, appointments, shopping...). A life card is a plain task
// (type 'task') with a lifeType, assigned to the owner: he adds and ticks them himself and no team is woken, unless he
// explicitly assigns a team member. An appointment (apptAt) sets the ⏰ timer (AIG-385) so it pops up remindMins before.
const S = () => require('./store');

const LIFE_TYPES = ['housework', 'appointment', 'shopping', 'call', 'bills', 'errand', 'health', 'family', 'pets'];
const LIFE_ICONS = { housework: '🧹', appointment: '📅', shopping: '🛒', call: '📞', bills: '💷', errand: '🚗', health: '🩺', family: '🎁', pets: '🐾' };
const LIFE_COLORS = { housework: '#0d9488', appointment: '#3b82f6', shopping: '#ea580c', call: '#7c3aed', bills: '#16a34a', errand: '#ca8a04', health: '#dc2626', family: '#db2777', pets: '#92400e' };
const REMIND_DEFAULT = 60;   // minutes before an appointment

// Called after cleanCard's field copy, on create and on change. Checks the life fields.
function clean(out) {
  if ('lifeType' in out) {
    if (out.lifeType && !LIFE_TYPES.includes(out.lifeType)) throw S().bad('lifeType must be one of ' + LIFE_TYPES.join(', '));
    out.lifeType = out.lifeType || undefined;
  }
  if ('apptAt' in out) {
    if (out.apptAt) { const d = new Date(out.apptAt); if (isNaN(d)) throw S().bad('apptAt must be a date and time'); out.apptAt = d.toISOString(); }
    else out.apptAt = undefined;
  }
  if ('remindMins' in out) {
    const m = Number(out.remindMins), none = out.remindMins === '' || out.remindMins === null;
    if (!none && !(m >= 0 && m <= 10080)) throw S().bad('remindMins must be minutes, 0 to 10080');
    out.remindMins = none ? undefined : m;
  }
  if ('focus' in out) out.focus = !!out.focus;   // AIG-395: focus mode will use it
}
// The life defaults for a new card, and the timer for an appointment.
function create(c) {
  if (!c.lifeType) return;
  c.type = 'task';
  if (!c.assignee) c.assignee = S().owner();
  if (c.status === 'team' || c.status === 'backlog') c.status = 'todo';   // never in the team's column unless he assigned a team member
  if (c.focus === undefined) c.focus = false;
  timer(c);
}
function timer(c) {
  if (c.lifeType !== 'appointment' || !c.apptAt) return;
  const at = new Date(c.apptAt).getTime() - (c.remindMins ?? REMIND_DEFAULT) * 60e3;
  if (at > Date.now()) c.timedUntil = new Date(at).toISOString(); else delete c.timedUntil;
}
// The owner ticks it: done, quietly. Nobody is told.
function done(c) {
  c.status = 'done'; c.needsYou = false; delete c.timedUntil; delete c.bumpedAt; delete c.bumps; c.updated = S().now();
  return c;
}
module.exports = { LIFE_TYPES, LIFE_ICONS, LIFE_COLORS, REMIND_DEFAULT, clean, create, timer, done };
