# Čeština (cs): first pass

First pass by a model (AIG-491), native-speaker review done (see Review below). File: `public/lang/cs.json`, 1932 keys, same keys and order as `en.json`.

## Register
- Casual **ty** (tykání), as in LocoRadio's Czech ("tak použij", "Zapnout zvuk"). Imperatives for buttons use the infinitive ("Uložit", "Zrušit") and the second-person imperative in sentences ("Napiš", "Vyber").
- Quotes: „…“ (Czech low-high).
- Plurals: `one` / `few` / `many` / `other` as `Intl.PluralRules('cs')` gives. 2 to 4 take `few`; `other` is 5 or more and 0; `many` is only for fractions.
- Counts in plain (non-plural) strings that would break for 2 to 4 use "Label: {n}" ("Odpovědi: {n}", "Karet: {n}") or put the number in brackets.
- Gender (settled in review): **no slashed forms like "viděl(a)", "sám/sama", "jeho/její"** for the reader, a friend or an agent speaking in first person. Use present tense ("Co vidíš?", "{name} sdílí tuto kartu"), passive or impersonal ("Spouští se…", "takže se už nerestartuje"), a noun ("tvoje odpověď: teď ne", "během tvé nepřítomnosti", "Jméno kamaráda") or a label with the name in brackets ("Posláno zpět ({name})"). Grammatical masculine stays only where it agrees with a masculine noun (tým, vedoucí, agent, tester, běh, Lead Scrum Master, the share roles Člen/Vývojář...) and for Davy, the pretend friend, who is "he" in English.
- A friend's `{name}` stays in the nominative: as the subject, after a colon or in brackets. Where a case is unavoidable it follows a noun ("uživatele {name}", "projektu {name}") or a preposition label ("Od {name}", "s {name}"), as Czech UIs commonly do. Check these.
- Keyboard keys and aigile CLI commands untouched (Enter, Shift+Enter, Esc, `aigile avatar`). The keyword the lead waits for stays **GO**.

## Glossary
| English | Čeština | Note |
|---|---|---|
| card | karta | |
| board | board | loanword, as teams say it; "tabule/nástěnka" avoided |
| project | projekt | |
| lead | vedoucí | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | tým | |
| helpers | pomocníci | |
| agent | agent | |
| For you | Pro tebe | column `col.verify.short` |
| To do | K udělání | |
| In progress | Rozpracováno | |
| Team checking | Tým kontroluje | |
| For you to test | Čeká na tvůj test | |
| For the team | Pro tým | |
| Done | Hotovo | column; "do Hotovo" in sentences |
| Backlog | Backlog | loanword |
| Sprint | Sprint | declines: sprinty, sprintu |
| Stand-up | Stand-up | declines: stand-upy |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Doručené | like "Doručená pošta" |
| Setup | Nastavení | |
| Usage | Využití | |
| Home | Domů | "na stránce Domů" |
| test steps | kroky testu | |
| test / to test | test / testovat | inside `{{dev:...}}` the form follows the sentence |
| bug | bug | |
| commit | commit | |
| assumption | předpoklad | |
| night watch | noční hlídka | the watchman is "noční hlídač" |
| No Token Mode | Režim bez tokenů | |
| poke | popostrčit | button "👉 Popostrčit"; "šťouchnutí" only for the chatty lead's friendly nudges |
| needs you | čeká na tebe | |
| Go (button) | Do toho | the keyword itself stays GO |
| Pop out | Do okna | "Otevřít ve vlastním okně" in tooltips |
| Accept / Send back | Přijmout / Poslat zpět | |
| Wait and see | Ještě počkat | |
| Views | Pohledy | |
| Stand-up report | Zpráva ze stand-upu | |
| Look (settings) | Vzhled | "v nabídce 🎨 Vzhled" in sentences |
| Permissions | Oprávnění | |
| Going quiet | Odmlčet se / odmlčení | |
| Friends (DMs) | kamarádi | |
| pretend friend / team / AI | vymyšlený kamarád / hraný tým / hraná AI | |
| relay | přenosový server | |
| Reporter (share role) | Hlásič chyb | |
| build (a feature) | úprava / vývoj | "stavba" avoided |
| chatty | povídavý | |
| Tour | Prohlídka | |

## For the reviewer (answered in review)
- **Gendered past tense**: rephrased neutrally everywhere (see Register). No "(a)" forms are left.
- `gloss.*.also`: checked by script; every word inside a `{{dev:...}}` marker is in its word's `also` list. Fixed a duplicate in `gloss.token.also`.
- **Poke**: "popostrčit" everywhere; "šťouchnutí" stays only for the chatty lead's nudges and jokes (a different sense).
- **Stav** for both status and state: fine in Czech, kept.
- "Label: {n}" order for counts: kept, and extended to the strings that still broke for 2 to 4.
- Demo names (Palačinkárna, Davyho zahrada) kept.

## Review
Native-speaker pass over all 1932 values (AIG-491). 290 values changed, 3 added (`boot.retry`, `boot.broke`, `boot.reload`, new in `en.json`).
- Gender: about 70 strings with "(a)", "sám/sama", "jeho/její", "ním/ní" rephrased (verdict box, share and friends dialogs, test hand-overs, tour, wizard, the Scrum Master's server notes in `srv.*`, which now use passive or impersonal forms).
- Terms settled: poke → popostrčit; Going quiet → Odmlčet se; Go button → Do toho (was "Jdi na to"); Pop out → Do okna (was "Vyjmout", which means "cut"); pretend friend → vymyšlený kamarád; Reporter → Hlásič chyb (was "Hlasitel"); relay → přenosový server; "Potřebuje tebe" → "Čeká na tebe"; "Cizí AI" → "Externí AI".
- Status lines in first person ("Spouštím…", "Restartuji…", "Instaluji…", "Odesílám…") → impersonal ("Spouští se…").
- Wrong meaning fixed: `dispatch.help` (comments go to the lead *unless* you name someone or it is a test card), `trial.help` and `pretend.help` ("se nikdy nedotkne" said the board would not touch anything; now "nesáhne se na"), `card.notseen`, `common.reset` (was "Obnovit", same as Refresh), `share.lane.note`.
- Calques and awkward forms smoothed: "Udrž talíře v pohybu", "Švihni bičem" → "Práskni bičem", "Počkat a uvidět", "Poslání zpět chce důvod", "Dychtivě", "Zabijáci práce", "Ranou a nedodělanou verzi", "Nátlak Scrum Mastera" → "Důraznost Scrum Mastera", "stavba/stavění" for building a feature → "úprava/vývoj".
- Counts that broke for 2 to 4 ("{n} karet", "{n} nových otázek", "{n} zpráv", "{n} odpovědí", "až {total} agentů", "{n} dalších kroků") rephrased; `quiet.done.told` and `tidy.toast` plurals redone.
- Typos: "nekliknes" → "neklikneš"; "na Domovské stránce" → "na stránce Domů".
- `pt.plan` ends with "GO?" again, as the keyword the board reacts to.

Still worth a human look:
- Names after prepositions or in brackets ("Od {name}", "Sdílet s {name}", "Poslat ({name})"): grammatical with the name undeclined, but a native ear may prefer other placements.
- `share.role.help.*` keep the generic masculine (it agrees with the role nouns Člen, Vývojář, Tester).
- Playful lines: `sm.push.1` "Ať se talíře točí", `sm.push.5` "Práskni bičem", `quiet.done.h` "Vyspi se hezky", `usage.line.explain` "máš utrum".
- "board", "bug", "commit", "log" stay as loanwords; fine for dev users, maybe less so on the 🏡 Life board.
