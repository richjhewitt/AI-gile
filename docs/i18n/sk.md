# Slovenčina (sk): first pass

First pass by a model (AIG-493), native-speaker check still to do. File: `public/lang/sk.json`, 1932 keys, same keys and order as `en.json`.

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

## For the reviewer
- Gendered forms were avoided everywhere; a native ear should still scan the `share.*`, `sb.*` and `srv.*` strings (role names such as Tester, Vývojár, Správca stay masculine nouns).
- "board", "bug", "commit", "log", "relay" stay as loanwords; maybe less natural on the 🏡 Life board.
- Plural-ish counts rephrased as "Label: {n}" read a bit like a table; check they are acceptable in the playful toasts.
- `gloss.*.also` lists every inflected form used inside `{{dev:...}}` markers (checked by script).
- Playful lines: `sm.push.1` "Nech sa taniere točia", `sm.push.5` "Prásknuť bičom", `quiet.done.h` "Dobrú noc".
