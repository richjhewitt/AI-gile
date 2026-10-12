# Čeština (cs): first pass

First pass by a model (AIG-491), for a native-speaker check. File: `public/lang/cs.json`, 1929 keys, same keys and order as `en.json`.

## Register
- Casual **ty** (tykání), as in LocoRadio's Czech ("tak použij", "Zapnout zvuk"). Imperatives for buttons use the infinitive ("Uložit", "Zrušit") and the second-person imperative in sentences ("Napiš", "Vyber").
- Quotes: „…“ (Czech low-high).
- Plurals: `one` / `few` / `many` / `other` as `Intl.PluralRules('cs')` gives. 2 to 4 take `few`; `other` is 5 or more and 0; `many` is only for fractions.
- Keyboard keys and aigile CLI commands untouched (Enter, Shift+Enter, Esc, `aigile avatar`).

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
| Done | Hotovo | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | declines: sprinty, sprintu |
| Stand-up | Stand-up | declines: stand-upy |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Doručené | like "Doručená pošta" |
| Setup | Nastavení | |
| Usage | Využití | |
| Home | Domů | |
| test steps | kroky testu | |
| test / to test | test / testovat | inside `{{dev:...}}` the form follows the sentence |
| bug | bug | |
| commit | commit | |
| assumption | předpoklad | |
| night watch | noční hlídka | the watchman is "noční hlídač" |
| No Token Mode | Režim bez tokenů | |
| poke | šťouchnout / popostrčit | |
| Accept / Send back | Přijmout / Poslat zpět | |
| Views | Pohledy | |
| Stand-up report | Zpráva ze stand-upu | |
| Look (settings) | Vzhled | |
| Permissions | Oprávnění | |
| Going quiet | Utišit se / odmlčet se | |
| Friends (DMs) | kamarádi | |
| Tour | Prohlídka | |

## For the reviewer
- **Gendered past tense**: the user is addressed with slashed forms like "viděl(a)", "zablokován(a)", "sám/sama" where Czech needs a gender. Decide whether to keep these or rephrase neutrally.
- `gloss.*.also` lists the inflected forms used in `{{dev:...}}` markers (sprinty, sprintu, testování...). Check they match the words the board highlights.
- "Poke" is rendered as "popostrčit" (button "👉 Popostrčit"); "šťouchnout" appears in a few chatty lines. Pick one.
- "Stav" is used for both status and state.
- Plural-agreement spots that English handles with a bare number ("{n} teams") use a "Label: {n}" order where the noun would need `few`/`many` (e.g. "Týmy k popostrčení: {n}").
- Names of the pretend friend (Davy) and the demo projects were translated in the demo texts only.
