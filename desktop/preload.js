// AIG-1163: the screen share picker's link between the app (main.js) and the page (public/js/sharepick.js).
// The page registers one handler; with none, or if it throws, the answer is "no share", so getDisplayMedia never hangs.
const { contextBridge, ipcRenderer } = require('electron');
let handler = null;
ipcRenderer.on('aigile:share-pick', (_e, req) => {
  let done = false;
  const answer = source => { if (done) return; done = true; ipcRenderer.send('aigile:share-picked', { id: req.id, source: typeof source === 'string' ? source : null }); };
  if (!handler) { answer(null); return; }
  try { handler(req.sources, answer); } catch { answer(null); }
});
// AIG-1250: Setup's "Start with Windows" tick reads and sets the login item through main.js.
contextBridge.exposeInMainWorld('aigileDesktop', {
  onSharePick: fn => { handler = typeof fn === 'function' ? fn : null; },
  getAutoStart: () => ipcRenderer.invoke('aigile:autostart-get'),
  setAutoStart: on => ipcRenderer.invoke('aigile:autostart-set', on === true),
});
