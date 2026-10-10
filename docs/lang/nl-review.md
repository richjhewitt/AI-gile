# Dutch (nl) review (AIG-127)

Second-pair-of-eyes review of `public/lang/nl.json` by a native Netherlands-Dutch developer and UX writer. Every key was compared with `en.json`, and the real screens were checked in Dutch (home, board, card tabs, bug dialog, columns, inbox, setup, usage, stand-ups, DM list, DM chat with folds) at 1280 and 800 px wide.

**Overall:** the first translation was good. Tone (informal "je"), the glossary and the `{{dev:...}}` loanwords mostly hold up. I changed 41 keys: 9 were still in English, and 32 were fixes for meaning, stiffness, consistency or length.

## Most important changes

| Key | Old | New | Why |
|---|---|---|---|
| `poke.one` / `poke.many` | 🔔 1 team heeft een duwtje nodig | 🔔 Duwtje nodig: 1 team | The top-bar pill wrapped to two lines at 1280 px and became a 5-line tower at 800 px. It now fits. |
| `poke.stuck` | loopt vast | zit vast | "Loopt vast" means crashing or jamming. A team waiting for help "zit vast". This also matches the glossary. |
| `verdict.h` / `card.tab.yourcall` | 🧪 Aan jou / aan jou | 🧪 Jij beslist / jij beslist | "Aan jou" on its own reads as "to you". "Jij beslist" says that it is your decision. |
| `leave.confirm` | Je hebt een antwoord dat nog niet is verstuurd. {what} en het kwijtraken? | Je antwoord is nog niet verstuurd. {what} en het kwijtraken? | Shorter and plainer. |
| `inbox.q.isblocked.html` | **{who}** zit vast, {when} | **{who}** zit vast (gemeld {when}) | "zit vast, 5 min geleden" was ungrammatical. |
| `inbox.t.waiting` | wacht: {when} | wacht al {when} | `{when}` is a bare duration ("5u"), so this now reads "wacht al 5u". |
| `dms.waiting` | wachten op jou: {n} | {n} voor jou | Fixes the clumsy word order. It now matches the home badge "{n} voor jou". |
| `cols.hide.confirm` | Daarin staat {what}… | Daar vind je {what}… | "staat" broke with the plural value "je reacties aan het team". |
| `standup.all` (+ `standup.empty.html`) | Stand-up met iedereen | Stand-up met alle teams | It asks teams, not every person. |
| `home.find`, `dlg.find.h` | Vind mijn projecten | Zoek mijn projecten | "Vind" as a button is a calque of "Find". |
| `attach.btn` | 📎 Bijlage | 📎 Bijvoegen | A button should be a verb. |
| `inbox.alerts.blocked` | 🔕 Meldingen uit | 🔕 Meldingen geblokkeerd | "Uit" was the same as switched off. Blocked by the browser is a different state, with a different fix. |
| `card.reply.ph`, `inbox.q.ph` | three different wordings | Enter verstuurt, Shift+Enter voor een nieuwe regel | One wording in every typing box. |
| `look.intro` | Herkenbaar maken van {name} in… | Maakt {name} herkenbaar in… | Too nominal and stiff. |
| `dlg.bug.desclabel` | …hoe krijg je het weer zo | …hoe zie je het opnieuw | The old wording was unclear. |
| `usage.line.h` | % van je limiet gebruikt, door de tijd | Verloop: % van je limiet gebruikt | "door de tijd" is not idiomatic. |
| `inbox.toast.sent` | Verstuurd naar het team, op {id}. | Naar het team gestuurd ({id}). | Natural word order. |

Smaller changes: `home.quiet.title`, `home.showarchived` (Archief tonen), `pres.session.title`, `board.ask.title`, `board.views.title`, `role.frontend`, `dlg.find.none`, `cols.limit.title`, `usage.headline.none` (gemeten, as on the rest of the page), `card.seen`.

## Newly translated (were still English)

`dms.kind.question` ❓ Vraag · `dms.kind.test` 🧪 Test · `dms.kind.idea` 💬 Idee · `dms.kind.other` 📌 Kaart · `dms.count.one/many` {n} bericht / berichten · `dms.opencard` Kaart openen · `dms.replyto` Antwoord op: · `inbox.later.title` Verberg hem een uur uit je inbox. `inbox.later` stays "⏳ Later", which is the same word in Dutch.

The English `inbox.later.title` contains a stray card reference, "(AIG-167)". I left it out of the Dutch because a user should not see it. The English string should lose it too.

## Glossary

I updated `nl-glossary.md` for: your call → jij beslist; stuck → zit vast; attach → bijvoegen; find → zoeken; stand-up all → met alle teams; the header poke pill; one wording for "Enter sends".

## Not fixable in nl.json (for the team)

- On the Setup page, the field labels and help texts ("Your name", "Agent program", …) are still English. They come from the server, not from the language file.
- The home "Heeft een duwtje nodig:" line shows a reason from the server in English ("asleep with 4 cards to do").
- The usage reset line shows English day names ("reset Mon 01:27 (over 1d 0h)") from the date formatting code.
- At 800 px the top bar overflows in English too, so this is a layout issue, not a wording one.

Signed off
