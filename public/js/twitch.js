// 💬 Twitch chat (AIG-666): the top bar button. Once a channel is set (Setup > Twitch, AIG-628) it opens the board's own Twitch
// chat in a pop-out window (in the desktop app it stays on top). With no channel yet it opens that Setup box in a window.
// No prompt(): the desktop app doesn't support it, so the button did nothing there (AIG-783). Works in and out of streamer mode.
const Twitch = (() => {
  async function open() {
    await TwitchTab.poll();
    if (TwitchTab.linked()) { TwitchTab.popOut(); return; }
    openDialog(`<h2>🟣 Twitch</h2><div class="f" id="twitchBox">${TwitchTab.setupHtml()}</div>
      <div class="actions"><button type="button" class="primary" onclick="closeDialog(); Twitch.open()">${esc(t('twitch.btn'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
  }
  return { open };
})();
