// 🚫 No AI, ever (AIG-581): a choice, not a pause. Stored as "noAi": true in aigile.local.json. While it is on the page hides every
// AI part (public/js/noai.js, body class `noai`) and the server refuses to start any AI run: notokens.guard() (which every AI
// starter already calls) and presence.spawnAgent both call guard() here. There is no glow and no one-click way back in the page.
// The one way to turn it off again, for later (AIG-618 "OK, I give in"): require('./noai').set(false).
const { localSettings, bad } = require('./store');

const isOn = () => localSettings().noAi === true;
function guard() { if (isOn()) throw bad(require('./i18n').t('srv.noai.guard'), 409); }
// On or off, saved in the settings file; turning it on stops anything that is running.
function set(on) {
  require('./setup').applyPrefs({ noAi: !!on });
  if (on) try { require('./notokens').killAll(); } catch {}
  return isOn();
}

module.exports = { isOn, guard, set };
