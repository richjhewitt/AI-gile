# Vlaams (nl-BE) review

Second pair of eyes on `public/lang/nl-BE.json` (card AIG-127). I checked every key against `en.json` and against `docs/lang/nl-BE-glossary.md`. I also looked at the real screens in Vlaams: home, board, a card (reply, details, test, edit), inbox, setup, usage, stand-ups, the DM rail and a DM chat with folds, and the board dialogs (columns, cards, look, permissions, views, connect folder).

The first translation was good: friendly "je", Flemish where it counts (bewaren, nota, verwittigen, vooraleer, enkel, binnen 2u), no dialect. **43 keys changed**: 10 were still in English, the rest fix meaning, grammar, stiffness or fit on screen.

## The important changes

| Key | Was | Now | Why |
|---|---|---|---|
| `look.intro` | Herkent {name} in je inbox, de tabbladen en de startpagina. | Zo herken je {name} in je inbox, op de tabbladen en op de startpagina. | Wrong meaning: it said the project recognises itself. |
| `leave.confirm` | … Toch {what} en het kwijtraken? | Je antwoord is nog niet verstuurd. {what} en het kwijtraken? | {what} is a button word with a capital ("Herladen"), so it read "Toch Herladen" mid-sentence. Now it starts the sentence. |
| `quiet.confirm` | Elk team dat werk heeft laten weten dat je een paar uur weg bent? | Aan elk team met werk laten weten dat je een paar uur weg bent? | The old sentence parsed as "every team that has let know…". |
| `home.quiet.title` | … dat je een paar uur afhaakt | … dat je er een paar uur niet bent | "Afhaken" means dropping out / giving up. |
| `poke.one` / `poke.many` | 🔔 {n} teams hebben een duwtje nodig | 🔔 Duwtje nodig: {n} teams | On the board the header pill broke into six lines and squeezed Inbox and the wake button. |
| `pres.wake` | ▶ Team wakker maken | ▶ Team wekken | Same header: the button wrapped to three lines. |
| `ago.m`, `ago.bare.m` | {n} min. geleden / {n} min. | {n}m geleden / {n}m | The card footer ("Forge 1 min. gelede…") was cut off; now it fits, and matches "5u", "3d" and the "1h 58m" the usage page shows. |
| `common.reset` | Herstellen | Terugzetten | "Herstellen" reads as "repair"; the button puts the standard columns / card look back. |
| `usage.limit`, `usage.line.explain` | op 100% is het op | bij 100% is alles op | "op … op" stumbles. |
| `usage.line.aria` | welk percent van je limiet | hoeveel procent van je limiet | "Welk percent" is not Dutch. |
| `standup.all` (+ `standup.empty.html`) | Stand-up voor allen | Stand-up voor iedereen | "Allen" is stiff, church-like. |
| `inbox.badge.t` | 🧪 {n} voor {{dev:test}} | 🧪 {n} te {{dev:testen}} | "3 voor test" is not a sentence; matches "1 te doen" next to it. |
| `dlg.conn.intro` | (…; git push vraagt nog altijd) die git niet ziet, en er wordt … | Er komen twee lokale bestanden bij die git niet ziet (…; voor git push vraagt het team nog altijd toestemming). Is er nog geen git-repo, dan wordt er een gestart. … | "git push vraagt nog altijd" said nothing (asks what?), and "die git niet ziet" hung after the bracket. Split into shorter sentences. |
| `pres.session.title` | typ ernaar in haar eigen venster | typ in haar eigen venster | "Ernaar typen" is not idiomatic. |
| `card.reply.ph` | zet de kaart naar Voor het team | verplaatst de kaart naar Voor het team | "Zetten naar" is a calque. |
| `verdict.open.confirm` | Als de pagina nog niet draait, start dit commando ze: | Draait de pagina nog niet? Dan start dit commando ze: | Inverted word order read awkwardly; the question form is lighter. |
| `usage.where.html` | komt alleen uit | komt enkel uit | Glossary: "enkel" for only. |
| `views.max` | Maximaal 20 weergaven | Maximum 20 weergaven | The Belgian form. |
| `dlg.err.title` | Geef het een titel | Geef de kaart een titel | "Het" pointed at nothing. |
| `dlg.bug.desclabel` | hoe je het opnieuw krijgt | hoe je het opnieuw doet gebeuren | "Opnieuw krijgen" sounds like catching a cold again. |

Smaller ones: `live.paused` (no comma before "blijft"), `card.seen` ("door het team"), `setup.intro` (said "deze pc" twice), `dlg.find.inside` ("in" over "binnen"), `dlg.find.none`, `dlg.np.folder`, `inbox.sum.none`, `inbox.k.ph`, `inbox.empty.text` ("verschijnt het hier"), `inbox.toast.sent` ("op {id}" read as "on top of").

## Translated (were still English)
`dms.kind.question` ❓ Vraag · `dms.kind.test` 🧪 Te testen · `dms.kind.idea` 💬 Idee · `dms.kind.other` 📌 Kaart · `dms.count.one/many` {n} bericht / berichten · `dms.opencard` Kaart openen · `dms.replyto` Antwoord op: · `inbox.later` ⏳ Later · `inbox.later.title` Een uur uit je inbox halen.

The English `inbox.later.title` ends in "(AIG-167)", a card number left in the screen text. I left it out of the Vlaams; the English (and nl) should drop it too.

## Kept on purpose
- **Gedaan** for the Done column: "'t is gedaan" is how Flemings say finished; "Klaar" stays for the dialog button.
- **Ouderdom** (card age), **Babbelzieke teamleider**, **Zeg eens dag**: Flemish without being dialect.
- **Nota** for a note you write; **notities / notitiebestand** for the agent's notes file (glossary now says so).

## Glossary updates
Stand-up voor iedereen; header pill "Duwtje nodig: {n} teams"; buttons say "wekken"; Reset = Terugzetten; minutes = "m"; Maximum; nota vs notities; the dev marker goes round the whole Dutch word ("te {{dev:testen}}").

## Not in the language file (for a code card)
These still show in English on Vlaams screens; they come from the server or the code, not from `nl-BE.json`:
- Setup page field labels and help ("Your name", "Agent program", …).
- Permission presets in 🔐 Rechten ("Run commands", "Edit files", "Web access", "git push asks first", "Read the AI-gile ways of working").
- Home page poke reason ("asleep with 9 cards to do").
- Usage page: day name and duration in "begint opnieuw Wed 02:27 (binnen 3d 1h)", and the chart month labels ("Sept", "Oct").

None of these is wrong Flemish; they are simply not translated yet.

## Checks
- Every `{placeholder}`, emoji, HTML tag and `**bold**` matches the English, key by key (checked by script).
- No key is missing; the only keys equal to English are words Flemings use as is (Inbox, Team, Status, Details, Emoji, Compact, feature, live, Later, Stand-up).

Signed off
