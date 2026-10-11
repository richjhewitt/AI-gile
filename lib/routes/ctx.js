// Shared by the route files in lib/routes/: the requires and helpers they use (split from lib/routes.js, AIG-297).
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const { usage } = require('../usage');
const S = require('../store');
const { STATUSES, TYPES, PRIORITIES, ROOT, now, slugify, load, save, localSettings, listSlugs, SNOOZE_MS, waitingOnRich, cleanCard, isRich, toTeam, docList, bad, need, findCard } = S;
const { heard, gone, presenceOf, heardFromFolder, startTeam, nudge, ownerNews, restartTeam, logTail, recentRuns, WHERE } = require('../presence');
const { recordLimits, limitsHistory } = require('../limits');
const { checkUsage, usageCheckStatus, setUsageAuto } = require('../usagecheck');
const { startTrial, stopTrial } = require('../trial');
const { connectFolder, getPermissions, setPermissions } = require('../onboard');
const { saveAttachment, attachmentsFor, fileOf } = require('../attachments');
const { saveLogo, removeLogo, logoFile, urlFor } = require('../logos');
const { avatarFile, urlOf, libraryStatus, pickAvatar } = require('../avatars');
const { quietSince, setQuiet, takeMorning } = require('../quiet');
const { status: watchStatus, round: watchRound, quickWake: watchQuick, messages: watchMessages, lastNight: watchLastNight, readAt: watchReadAt, markRead: watchMarkRead, relay: watchRelay, say: watchSay, watchBusy } = require('../watchman');
const { callStandup, reportStandup, standupReport } = require('../standup');
const { setupStatus, saveSetup, setupNeeded } = require('../setup');
const { discover } = require('../discover');
const { openInEditor } = require('../openfile');
const { proofOf } = require('../proof');
const { updateStatus, checkUpdate, applyUpdate, restartBoard } = require('../update');
const dm = require('../dm');

const summary = p => S.summary(p, presenceOf);

/* ---------- .md files in project folders ---------- */
// Any .md file inside a folder: relative, folder-name-prefixed or absolute. Relative paths also try
// dropping leading folders, since card text like "My Project\audit\X.md" only links "Project\audit\X.md"
// (folder names with spaces), so the match is found from the end (AIG-85).
function findMd(dir, raw) {
  let root; try { root = fs.realpathSync(dir); } catch { return null; }
  const parts = raw.split('/').filter(Boolean);
  const abs = path.isAbsolute(raw) || /^[a-z]:\//i.test(raw);
  const inside = process.platform === 'win32' ? s => s.toLowerCase() : s => s;
  for (const t of abs ? [raw] : parts.map((_, i) => parts.slice(i).join('/'))) {
    let real; try { real = fs.realpathSync(path.resolve(root, t)); } catch { continue; }
    if (!inside(real).startsWith(inside(root) + path.sep) || !/\.md$/i.test(real) || !fs.statSync(real).isFile()) continue;
    return { name: path.relative(root, real).replace(/\\/g, '/'), text: fs.readFileSync(real, 'utf8') };
  }
  // A bare name like chatgpt.md (AIG-240): the one file with that name anywhere in the folder, if there's only one.
  if (!abs && parts.length === 1) {
    const hits = [], walk = (d, depth) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) { if (hits.length > 1) return; const f = path.join(d, e.name);
        if (e.isDirectory() && depth < 5 && !/^(\.|node_modules$|data$)/.test(e.name)) walk(f, depth + 1);
        else if (e.isFile() && e.name.toLowerCase() === parts[0].toLowerCase()) hits.push(f); } };
    walk(root, 0);
    if (hits.length === 1) return { name: path.relative(root, hits[0]).replace(/\\/g, '/'), text: fs.readFileSync(hits[0], 'utf8') };
  }
  return null;
}

/* ---------- lead chats (AIG-137/138) ---------- */
// The cards that make up a project's chat: the owner's quick questions, and anything the team asked the owner.
const chatCards = p => p.cards.filter(c => c.quick || c.asked || c.needsYou);
// The 🌙 night watchman's chat (AIG-211): read-only, one message per critical problem tonight.
const watchChat = wm => ({ slug: '_watchman', name: 'Night watch', lead: '🌙 Watchman', emoji: '🌙', color: '#7a4a3a', watchman: true, unread: wm.filter(m => !m.mine && m.at > watchReadAt()).length, last: (wm.at(-1) || {}).at || null });
// A project's lead: the roster member named or titled "lead", else the first member.
const leadOf = p => { const t = (p.team || []).filter(m => !/retired/i.test(m.status || '')); const l = t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0]; return l ? l.name : 'Lead'; };
// A member's picture URL (AIG-150), or ''.
const picOf = (p, name) => urlOf(((p.team || []).find(m => m.name.toLowerCase() === String(name).toLowerCase()) || {}).avatar);

module.exports = { fs, spawn, path, usage, S, STATUSES, TYPES, PRIORITIES, ROOT, now, slugify, load, save, localSettings, listSlugs, SNOOZE_MS, waitingOnRich, cleanCard, isRich, toTeam, docList, bad, need, findCard, heard, gone, presenceOf, heardFromFolder, startTeam, nudge, ownerNews, restartTeam, logTail, recentRuns, WHERE, recordLimits, limitsHistory, checkUsage, usageCheckStatus, setUsageAuto, startTrial, stopTrial, connectFolder, getPermissions, setPermissions, saveAttachment, attachmentsFor, fileOf, saveLogo, removeLogo, logoFile, urlFor, avatarFile, urlOf, libraryStatus, pickAvatar, quietSince, setQuiet, takeMorning, watchStatus, watchRound, watchQuick, watchMessages, watchLastNight, watchReadAt, watchMarkRead, watchRelay, watchSay, watchBusy, callStandup, reportStandup, standupReport, setupStatus, saveSetup, setupNeeded, discover, openInEditor, proofOf, updateStatus, checkUpdate, applyUpdate, restartBoard, dm, summary, findMd, chatCards, watchChat, leadOf, picOf };
