# Română (ro): first pass

First pass by a model (AIG-491), native-speaker review done (see Review below). File: `public/lang/ro.json`, 1932 keys, same keys and order as `en.json`.

## Register
- Casual **tu** (informal second person), as in LocoRadio's Romanian ("folosește volumul dispozitivului tău"). Imperatives in the second person ("Salvează", "Anulează").
- Diacritics with comma-below (ș, ț), not cedilla.
- Quotes: „…” (Romanian low-high).
- Plurals: `one` / `few` / `other` as `Intl.PluralRules('ro')` gives. Numbers 0 and 2 to 19 take `few`; `other` uses "de" ("20 de carduri").
- Counts in plain (non-plural) strings would need "de" from 20 up, so they use "Label: {n}" ("Întrebări: {n}", "Mesaje: {n}") or put the number in brackets.
- Gender (settled in review): **no slashed forms ("lui/ei", "el/ea") and no masculine participles or adjectives for the reader or a friend** ("sigur", "singur", "plecat", "nou", "mut"). Use a verb instead ("Nu te-ai hotărât încă", "cât lipsești", "Prima dată aici", "Mă descurc"), "automat" instead of "singur", the possessive "său/sa" or a noun ("persoanei", "contactul {name}"). Masculine stays where it agrees with a masculine or neuter noun (lider, agent, AI, card, rol, Raportor) and for Davy, the pretend friend.
- Keyboard keys and aigile CLI commands untouched (Enter, Shift+Enter, Esc, `aigile avatar`). The keyword the lead waits for stays **GO**.

## Glossary
| English | Română | Note |
|---|---|---|
| card | card | |
| board | board | loanword, as dev teams say it |
| project | proiect | |
| lead | lider | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | echipă | |
| helpers | ajutoare | neuter: "câte ajutoare", "atâtea ajutoare" |
| agent | agent | |
| For you | Pentru tine | column `col.verify.short` |
| To do | De făcut | |
| In progress | În lucru | |
| Team checking | Echipa verifică | |
| For you to test | Așteaptă testul tău | |
| For the team | Pentru echipă | |
| Done | Gata | column; "trec în Gata" |
| needs you | te așteaptă | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | declines: sprinturi, sprintul |
| Stand-up | Stand-up | plural stand-up-uri |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Inbox | loanword |
| Setup | Configurare | |
| Usage | Utilizare | |
| Home | Acasă | "pagina Acasă" |
| test steps | pași de test | |
| test / to test | test / a testa | inside `{{dev:...}}` the form follows the sentence |
| AI passed / failed | aprobat / respins (de AI) | |
| bug | bug | plural bug-uri; "raportează bug-uri" (not "ridică") |
| raise (a card) | creează / raportează | |
| commit | commit | plural commit-uri |
| assumption | presupunere | |
| night watch | veghea de noapte | the watchman is "paznicul de noapte" |
| No Token Mode | Modul fără tokeni | |
| poke | imbold | "are nevoie de un imbold", "dă-i un imbold"; button "👉 Imbold" |
| Go (button) | Dă-i drumul | the keyword itself stays GO |
| Wait and see | Mai aștept | |
| Waits for (another card) | Depinde de | |
| Accept / Send back | Acceptă / Trimite înapoi | |
| Views | Vizualizări | |
| Stand-up report | Raport de stand-up | |
| Look (settings) | Aspect | |
| Permissions | Permisiuni | |
| Going quiet | Pauză / iau o pauză | |
| Friends (DMs) | prieteni | |
| pretend friend / AI | prieten imaginar / AI-ul imaginar | |
| brief (agent prompt) | instrucțiuni | |
| build (a feature) | modificare / lucru | "construire" avoided |
| Tour | Tur | |

## For the reviewer (answered in review)
- **"Pretend friend"**: now "prieten imaginar" everywhere (`pretend.*`, `pt.ask`, `srv.err.notrunning`).
- **Gender**: neutralised (see Register). "singur" is left only where it agrees with a masculine noun (agent, AI, lider) or means "a single".
- `gloss.*.also`: checked by script; every `{{dev:...}}` word is in its word's `also` list.
- **Going quiet**: "Mă fac mut" replaced by "Iau o pauză" (button) and "Pauză" (heading).
- **Loanwords** (board, card, inbox, backlog, bug, commit, tester): real usage in Romanian dev teams, kept. "brief" replaced by "instrucțiuni".
- **Scrum Master push**: "Presiunea" → "Insistența Scrum Master-ului".

## Review
Native-speaker pass over all 1932 values (AIG-491). 228 values changed, 3 added (`boot.retry`, `boot.broke`, `boot.reload`, new in `en.json`).
- Gender: about 35 strings with "lui/ei", "el/ea", "sigur", "singur", "plecat", "nou", "mut" rephrased (inbox, friends and share dialogs, tour, wizard, night watch, assumptions).
- Terms settled: poke → imbold (was also "a împinge", a literal push); Go → Dă-i drumul; Going quiet → Pauză; AI passed/failed → aprobat/respins; "ridică bug-uri/carduri" → "raportează/creează"; "Așteaptă după" → "Depinde de"; brief → instrucțiuni; construire → modificare.
- Wrong meaning fixed: `dispatch.help` (comments go to the lead *unless* you name someone or the card is a test), `srv.notokens.guard` ("until you turn it back on" meant No Token Mode, not AI), `setup.f.updates.url.help` ("pe care ți-a fost dată").
- Counts that broke from 20 up ("{n} întrebări", "{n} mesaje", "{n} răspunsuri", "{n} carduri", "{n} pași", "de {n} ori", "toate cele {n}") rephrased.
- Agreement fixed: "câți ajutoare" → "câte ajutoare", "Primul proiect și fiecare proiect nou începe" → "încep", "Adăugat/Înlocuit/Păstrat" for role lists → plural.
- Smaller fixes: "Nic" → "Nimic", "Ține farfuriile în mișcare" → "Doar să nu stea treaba", "Trimiterea înapoi cere un motiv" → "Ca să trimiți înapoi, e nevoie de un motiv", "fotografie salvată" (commit) → "instantaneu salvat", status lines "Pornește…" → "Se pornește…".

Still worth a human look:
- "ajutoare" for helper agents: it is the plural of "ajutor" as a thing; "ajutori" or "asistenți" (the wizard is already "asistentul") may sound better to a native ear.
- "lui {name}" before female names ending in -a ("lui Maria") is colloquial; the standard genitive would be "Mariei". Fine for a UI, but check.
- `trust.is.sure` / `trust.is.likely` ("sigur" / "probabil") are short labels; they may need "sigură / probabilă" if shown next to "reușită".
- Playful lines: `sm.push.5` "Pocnește din bici", `quiet.done.h` "Somn ușor", `sm.push.1` "Doar să nu stea treaba".
