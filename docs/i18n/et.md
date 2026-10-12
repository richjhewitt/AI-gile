# Eesti (et): first pass

First pass by a model (AIG-494), awaiting native-speaker review. File: `public/lang/et.json`, 1932 keys, same keys and order as `en.json`.

## Register
- Casual **sina**, as in LocoRadio's Estonian ("kasuta", "lülita sisse"). Buttons use the 2nd-person imperative or noun ("Salvesta", "Tühista", "Ava"); no formal "te" imperatives toward the reader. "te" appears only for two people ("lugege need teineteisele ette").
- Quotes: „…“ (Estonian low-high).
- Plurals: `one` / `other` as `Intl.PluralRules('et')` gives. Estonian uses the partitive after a number ("2 kaarti"), so `other` is the partitive form and `one` the nominative ("1 kaart").
- Gender: Estonian has no grammatical gender, so no workaround is needed; "tema" is avoided where "nad"/the noun reads better.
- Foreign words and names take an apostrophe plus ending ("AI-gile'i", "VS Code'is", "git'i", "Claude'ilt"). The names AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows stay as written.
- Keyboard keys, aigile CLI commands, URLs and the keyword **GO** are untouched.

## Glossary
| English | Eesti | Note |
|---|---|---|
| card | kaart | |
| board | tahvel | as in Trello's Estonian |
| project | projekt | |
| lead | juht | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | tiim | |
| helpers | abilised | |
| agent | agent | |
| For you | Sulle | column `col.verify.short` |
| To do | Tegemata | |
| In progress | Töös | |
| Team checking | Tiim kontrollib | |
| For you to test | Sinu testida | |
| For the team | Tiimile | |
| Done | Valmis | |
| Backlog | Backlog | loanword (backlogi) |
| Sprint | Sprint | (sprindi, sprinte) |
| Stand-up | Stand-up | (stand-up'i) |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Postkast | |
| Home | Avaleht | |
| Setup | Seaded | |
| Usage | Kasutus | |
| Look (settings) | Välimus | |
| Permissions | Load | |
| Views | Vaated | |
| test steps | testisammud | |
| bug | viga | |
| commit | commit | loanword (commit'i) |
| assumption | oletus | |
| night watch | öövalve | watchman = öövalvur |
| Night mode | Öörežiim | |
| No Token Mode | Tokenivaba režiim | |
| token | token | |
| poke | müksata | button "👉 Müksa" |
| Going quiet | Jää vait | |
| Wait and see | Oota ja vaata | |
| Accept / Send back | Võta vastu / Saada tagasi | |
| Pop out | Ava aknas | |
| Friends (DMs) | sõbrad; sõnumid = otsesõnumid / privaatsõnumid | |
| pretend friend / team / AI | teeskleja sõber / teeskleja tiim | |
| AI | tehisaru | |
| relay | relee | |

## For the reviewer
- **Case after names**: a friend's `{name}` stays in the nominative ("Jaga kasutajaga {name}", "{name} tehisaru", "Küsi Claude'ilt: {name}"). Estonian would normally decline the name (genitive); these are the places most likely to need a better wording.
- **Number plus label forms**: strings of the form "Label: {n}" or "{n} kaarti" were kept in the partitive; check `inbox.sum.*`, `poke.many`, `dms.count.many`.
- **"Tahvel"** for board and **"Tegemata"** for To do (literally "not done"): confirm they feel natural in a kanban.
- **Role nouns** (Vaataja, Teataja, Arendaja, Testija) are used for share roles; check they match common usage.
- **`gloss.*.also`**: inflected forms listed by hand; extend if the hover glossary misses a form. `gloss.backlog.also`, `gloss.refactor.also` and `gloss.deploy.also` were left out (not in `en.json`).
- Playful lines: `sm.push.1` "Hoia taldrikud pöörlemas", `sm.push.5` "Vihuta piitsa", `quiet.done.h` "Magusat und", `assume.plug` "Sekku".
- Some mixed-in loan terms are kept for software teams: Backlog, Sprint, Stand-up, commit, token, Frontend/Backend.
