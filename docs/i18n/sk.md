# Slovenčina (sk): first pass

First pass by a model (AIG-493), then a native-speaker review by a model (see Review below). File: `public/lang/sk.json`, 1939 keys, same keys and order as `en.json`.

## Register
- Casual **ty** (tykanie), as in LocoRadio's Slovak ("použi", "Zapnúť zvuk"). Buttons use the infinitive ("Uložiť", "Zrušiť"), sentences the imperative ("Napíš", "Vyber").
- Quotes: „…“ (Slovak low-high).
- Plurals: `one` / `few` / `many` / `other`, as `Intl.PluralRules('sk')` gives. 2 to 4 take `few`; `other` is 5 or more and 0; `many` is only for fractions. Counts in plain (non-plural) strings that would break for 2 to 4 use "Label: {n}" ("Karty: {n}", "Správy: {n}").
- Gender: no slashed forms ("viděl(a)"). Present tense, passive, impersonal or a noun instead ("Čo vidíš?", "Spúšťa sa…", "zablokované", "Prepojenie ukončené zo strany: {name}"). Masculine stays only where it agrees with a masculine noun (tím, vedúci, tester, vývojár, správca) and for Davy, the pretend friend.
- A friend's `{name}` stays in the nominative: after a colon or in brackets ("Od: {name}", "Pozývací kód: {name}").
- Keys, `aigile` commands, URLs and the names (AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows) untouched. The keyword the lead waits for stays **GO**.

## Glossary
| English | Slovenčina | Note |
|---|---|---|
| card | karta | |
| board | board | loanword, as teams say it |
| project | projekt | |
| lead | vedúci | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | tím | |
| helpers | pomocníci | |
| agent | agent | |
| For you | Pre teba | |
| To do | Na urobenie | |
| In progress | Rozrobené | |
| Team checking | Tím kontroluje | |
| For you to test | Čaká na tvoj test | |
| For the team | Pre tím | |
| Done | Hotovo | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | declines: sprinty, sprintov |
| Stand-up | Stand-up | declines: stand-upy |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Doručené | like "Doručená pošta" |
| Setup | Nastavenia | |
| Usage | Využitie | |
| Home | Domov | |
| test steps | kroky testu | |
| bug / commit | bug / commit | loanwords |
| assumption | predpoklad | |
| night watch | nočná hliadka | the watchman is "nočný strážca" |
| No Token Mode | Režim bez tokenov | |
| poke | postrčiť | button "👉 Postrčiť"; "šťuchnutie" only for the chatty lead's nudges |
| needs you | čaká na teba | |
| Go (button) | Do toho | the keyword stays GO |
| Pop out | Do okna | |
| Accept / Send back | Prijať / Poslať späť | |
| Wait and see | Ešte počkať | |
| Views | Pohľady | |
| Look (settings) | Vzhľad | |
| Permissions | Oprávnenia | |
| Going quiet | Stíchnuť | |
| pretend friend | vymyslený kamarát | |
| relay | relay | kept as a technical word |
| Reporter (share role) | Hlásič chýb | |
| Assignee | Riešiteľ | |
| Outside help | Pomoc zvonku | |
| AI passed | Schválené AI | chip stays "🤖 Prešlo" |
| Watchman ticks every project | Strážca kontroluje každý projekt | same words in `sm.night.title` |

## For the reviewer
- Gendered forms were avoided everywhere; a native ear should still scan the `share.*`, `sb.*` and `srv.*` strings (role names such as Tester, Vývojár, Správca stay masculine nouns).
- "board", "bug", "commit", "log", "relay" stay as loanwords; maybe less natural on the 🏡 Life board.
- Plural-ish counts rephrased as "Label: {n}" read a bit like a table; check they are acceptable in the playful toasts.
- `gloss.*.also` lists every inflected form used inside `{{dev:...}}` markers (checked by script).
- Playful lines: `sm.push.1` "Nech sa taniere točia", `sm.push.5` "Prásknuť bičom", `quiet.done.h` "Dobrú noc".

### Answers (review)
- Gender: the `share.*`, `sb.*` and `srv.*` lines read fine; a few passives that sounded stiff ("založené tebou", "povolené obomi") became "od teba", "svoje karty", "obaja ste ich povolili". "sám" (user) was removed from `pretend.auto`.
- Loanwords: "board", "bug", "commit", "log", "relay" are what Slovak teams say; fine on the Life board too. Columns are named by their Slovak labels in running text ("v stĺpci Na urobenie"), not "To do".
- "Label: {n}": acceptable in plain strings. Where the key has plural forms (`inbox.g.count`, `quiet.done.told`, `quiet.done.woke`, `tidy.toast`) it now uses real forms ("2 karty", "5 kariet", "Zobudené 3 spiace tímy").
- A friend's `{name}` with a colon works, but a double colon ("Na boarde: {name}: {col}") does not; those now use brackets ("Board ({name}): {col}") or "projekt {name}" when `{name}` is a project.
- Playful lines: all three are natural. Kept.

## Review
Native-speaker pass (AIG-493): 153 values, 146 changed and 7 new keys added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- Real plural forms in plural keys instead of "Label: {count}"; `one` of `queue.bump.title` is "Pripomenuté raz".
- Wrong reflexives fixed: "board sa nikdy nedotkne" → "boardu sa to nikdy nedotkne", same in `pretend.help`.
- Calques and stiff wording rewritten: "Cudzia pomoc" → "Pomoc zvonku", "Hovorný" → "Zhovorčivý", "opýta novú otázku" → "položí novú otázku", "pred každým vývojom" → "pred každou zmenou", "konzervovaná odpoveď" → "vopred pripravená", "Zastavovače" → "Kritické prekážky", "na GitHub" → "na GitHube", "Poslať komu" → "Komu poslať".
- GO stays GO in `tour.chat.why` and `scale.go.2`; option names in `dispatch.help` and `wz.1.pick` now in „…“.
- Still for a human: `card.f.assignee` "Riešiteľ" (Jira says "Priradená osoba"); `fx.sum.h` "Medzitým sa stalo" for "While you were busy"; `share.role.theirs` "Tvoja rola ({name}): {role}"; `usage.kind.pack` "Pomocník pre inú AI" is a guess at the pack helper's name.
