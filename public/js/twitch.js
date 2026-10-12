// 💬 Twitch chat (AIG-666): opens a channel's Twitch pop-out chat in its own small window. In the desktop app that window
// stays on top (desktop/main.js, window name aigile-twitch), so clicking or typing in AI-gile never hides the chat.
// The channel is asked once and kept in this browser; Shift+click asks again.
const Twitch = (() => {
  const KEY = 'aigile.twitch.channel';
  function open(e) {
    let ch = localStorage.getItem(KEY) || '';
    if (!ch || (e && e.shiftKey)) {
      const v = prompt(t('twitch.ask'), ch);
      if (v == null) return;
      ch = v.trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/^@/, '').split(/[/?#\s]/)[0].toLowerCase();
      if (!/^\w{2,25}$/.test(ch)) { alert(t('twitch.bad')); return; }
      localStorage.setItem(KEY, ch);
    }
    window.open(`https://www.twitch.tv/popout/${ch}/chat?popout=`, 'aigile-twitch', 'width=380,height=720');
  }
  return { open };
})();
