// Stages the board's cards are grouped into, by title: used by the teaser timeline and the release notes (AIG-778, AIG-977).

// Done stages: first matching rule wins. `line` is the one-line summary shown on the page.
export const DONE = [
  { id: 'first-board', name: 'First board', line: 'A board that tracks its own build: cards, columns, drag and drop, projects.', test: c => /^M[0-3]$/.test(c.sprint) },
  { id: 'night-watch', name: 'Night watch', line: 'A watchman and Scrum Master keep the teams on task while you sleep.', re: /night|watchman|scrum master|tidy the for you/i },
  { id: 'ai-tester', name: 'AI tester', line: 'A tester checks every hand-over first and shows what it saw.', re: /\btesters?\b|ai test/i },
  { id: 'usage-saver', name: 'Usage saver', line: 'Measure what runs cost, keep the code lean, save your limit.', re: /token|usage|saver|🪶/i },
  { id: 'languages', name: 'Languages', line: 'Every screen text in a language file, with Dutch and Flemish first.', re: /🌍|language|dutch|flemish|glossary/i },
  { id: 'friends', name: 'Friends and sharing', line: 'Private DMs, a scrambled relay, invites, roles and shared projects.', re: /friend|shar(e|ing)|\bdms?\b|relay|invite|roles?\b|people|mate|encrypt/i },
  { id: 'team-roles', name: 'Team and roles', line: 'Agent profiles, team templates, spaces and who does what.', re: /profile|template|team|spaces?\b|🪐|lead|stand-?ups?|topics/i },
  { id: 'install', name: 'Install and releases', line: 'A zip a friend can install, self-updates, channels and roll back.', re: /install|zip|release|F1\b|update|restart|setup|wizard/i },
  { id: 'streaming', name: 'Chat and streaming', line: 'Discord, Twitch, OBS, streamer mode, GIFs and emojis.', re: /discord|twitch|obs\b|stream|gif|emoji|chat/i },
  { id: 'no-ai', name: 'No AI edition', line: 'A board for people who code without AI, and public boards.', re: /no[ -]ai|licen[cs]e|public/i },
  { id: 'website', name: 'The website', line: 'aigile.lol, the teaser and this timeline.', re: /aigile\.lol|teaser|\bsite\b|dns|domain|timeline|stats/i },
  // Cards that match no stage (small fixes, chat notes) are left out of the stages.
  { id: 'other', name: '', line: '', re: /./ },
];

// Planned stages: no dates promised.
export const PLANNED = [
  { id: 'p-android', name: 'Phone and Android', line: 'Reach your board from a phone, then a native Android app.', re: /android|phone|pwa|linux/i },
  { id: 'p-engines', name: 'More AI engines', line: 'Pick Claude, Codex or Gemini per agent.', re: /codex|gemini|copilot|cursor|engine/i },
  { id: 'p-languages', name: 'More languages', line: 'More than a hundred languages, and an immersion mode for learners.', re: /🌍|language|immersion/i },
  { id: 'p-pro', name: 'Pro practice', line: 'Risk labels, merge gates, incident cards and guard rails.', re: /pro practice|incident|guard rail/i },
  { id: 'p-livestream', name: 'Streaming extras', line: 'Twitch chat, custom emojis and a public live view.', re: /twitch|emoji|public live|obs/i },
  { id: 'p-self', name: 'Looking after you', line: 'Tired mode, self-care reminders and 4:20.', re: /tired|self-care|4:20/i },
  { id: 'p-servers', name: 'Servers and scale', line: 'Global server settings, roles and planning for growth.', re: /server|scaling|ssh|sudo|role:/i },
  { id: 'p-release', name: 'Alpha and beyond', line: 'Closed alpha, the live site, then beta.', re: /alpha|beta|release|aigile\.lol|teaser|roadmap|licence|feedback/i },
  { id: 'p-more', name: 'Everything else', line: 'Smaller ideas still waiting their turn.', re: /./ },
];
