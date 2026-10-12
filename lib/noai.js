// 🚫 No AI, ever (AIG-581): a choice, not a pause. Stored as "noAi": true in aigile.local.json. While it is on the page hides every
// AI part (public/js/noai.js, body class `noai`) and the server refuses to start any AI run: notokens.guard() (which every AI
// starter already calls) and presence.spawnAgent both call guard() here. There is no glow and no one-click way back in the page.
// The one way to turn it off again (AIG-618 "OK, I give in"): require('./noai').set(false).
// The No-AI edition (AIG-617, tools/build-noai.mjs) has a file called NOAI in the root: then it is on for good, set(false) refuses,
// and the AI-only modules are not in the download at all.
const fs = require('fs');
const path = require('path');
const { localSettings, bad, ROOT } = require('./store');

const marker = () => fs.existsSync(path.join(ROOT, 'NOAI'));
const isOn = () => marker() || localSettings().noAi === true;
function guard() { if (isOn()) throw bad(require('./i18n').t('srv.noai.guard'), 409); }
// On or off, saved in the settings file; turning it on stops anything that is running.
function set(on) {
  if (!on && marker()) throw bad(require('./i18n').t('srv.noai.build'), 403);
  require('./setup').applyPrefs({ noAi: !!on });
  if (on) try { require('./notokens').killAll(); } catch {}
  return isOn();
}

module.exports = { isOn, guard, set, marker };
