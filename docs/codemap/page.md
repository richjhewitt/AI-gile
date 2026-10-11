# Code map: page (public/)

`index.html` is the shell only. The scripts are classic scripts sharing one global scope, loaded in this order (`app.js` last):
| File | What |
|---|---|
| `styles.css` | All styles: tokens, Portfolio, Board, Card detail panel, buttons and forms, phones |
| `js/usage-page.js` | The `#/usage` page (charts are hand-written SVG) |
| `js/inbox-style.js` | `INBOX_CSS`: the inbox styles, injected by inbox.js (loaded just before it) |
| `js/inbox-queue.js` | `paintQueue(shown, kindFilter)`: the inbox kind chips and the Next up line (AIG-159..162); called by inbox.js |
| `public/js/inbox-ai.js` | `aiFlickHtml`: the inbox's 🤖 AI passed view, one test at a time with the tester's evidence (AIG-192); inbox.js owns the list, clicks and keys |
| `public/js/glossary.js` | Dev words explained (AIG-102): the 📖 glossary page (#/glossary, searchable) and, with Setup's "Explain developer words" on, hover tooltips on those words anywhere (MutationObserver); words in the language files as gloss.<id>.word/.text/.also |
| `public/js/tour.js` | 🎓 Guided tour (AIG-95): three levels (new / refresh / anyway), a spotlight and bubble per stop (TOUR list of selectors), texts in the language files (tour.*) |
| `public/js/night.js` | 🌙 Night glance (AIG-209): `#/pop-night`, a calm red-tinted pop-out with the watchman per project; a slow amber glow only for stuck cards or real stand-up blockers |
| `js/inbox.js` | Top-bar inbox button, the `#/inbox` page, alerts; uses the two files above |
| `js/i18n.js` | Languages (AIG-124): `t(key, vars)`, `loadLang` (runs before the first render), `setLang`, `langPickHtml`; see "Languages" below |
| `js/core.js` | `state`, `api`, `esc`, `ago`, the router (`parseRoute`), `busy`/`refresh`/`render` (the 1s poll never wipes typing), `slug`/`curCard`/`setErr` |
| `js/format.js` | Card text: `withCode`, `spaceBullets`, `linkify`, `.md` links (`mdLinks`, opened by `showDocPath` in dialogs.js); `md` (Docs renderer) |
| `js/attach.js` | `Attach`: 📎 button, paste-a-screenshot and pending chips for any reply box (card, inbox and chats), `upload` on send (`read` gives the files as base64 for a private DM), `shown` thumbnails under comments |
| `js/filters.js` | Search and filter bar; saved views (`viewsDialog`, `applyView`; stored on the project, last one used in localStorage) |
| `js/home.js` | Home page: `renderHome`, project bars, usage strip |
| `js/standup.js` | Stand-ups: `callStandup` (📣 buttons on the board and home), `standupButtons`, the `#/standups` report page (`renderStandups`, blockers first), the once-a-day `morningPrompt` pill (`suPick` to choose projects; day saved in localStorage `aigile.standupAsked`) |
| `js/board.js` | In flight and presence, `renderBoard`, swimlanes (`lanesOf`, `columnsHtml`), `cardHtml`, `poke`, drag and drop, the For you header buttons `tidyPile` and `testForMe` (🤖, AIG-300; AI-passed tests sort first in `forYouQueue`) |
| `js/card.js` | `cardFields`, assignee select, `renderCard` (Reply/Details/Test tabs), edit/delete/reply/verdict |
| `js/dialogs.js` | `openDialog`, New card, New project, Connect folder, Docs |
| `js/leadquiz.js` | What kind of lead? (AIG-235..237): `QUIZ` (question -> settings), `leadQuiz`/`saveQuiz` dialog (offered once when the name is first saved), `leadPrefsHtml` the "Your lead" switches on the Setup page, `setLeadPref` |
| `js/app.js` | Start-up: hashchange, the 1s poll, the new-build prompt; going quiet (`goQuiet`, `setNight` night theme); `pokeBadge` (top bar) |
