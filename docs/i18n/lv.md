# Latviešu (lv): first pass

First pass by a model (AIG-494), awaiting native-speaker review. File: `public/lang/lv.json`, 1932 keys, same keys and order as `en.json`.

## Register
- Casual **tu**, as in LocoRadio's Latvian ("izmanto", "ieslēdz"). Buttons use the infinitive ("Saglabāt", "Atcelt"); sentences use the second-person imperative ("Raksti", "Izvēlies").
- Quotes: “…” (Latvian high quotes).
- Plurals: `Intl.PluralRules('lv')` gives `zero` / `one` / `other`. `zero` covers 0, 10 to 19, 20, 30 and so on (genitive plural: "0 kartīšu"), `one` covers 1, 21, 31 ("1 kartīte"), `other` the rest ("2 kartītes"). Every plural entry has all three. Where a sentence would break for some numbers, it uses "Label: {n}" ("Jautājumi: {n}", "Komandas: {n}").
- Gender: Latvian participles and adjectives ("esmu pabeidzis/pabeigusi", "iestrēdzis") are gendered. Avoided for the reader, friends and agents: present tense, imperatives, nouns and 3rd person past ("izturēja") only. Role names for share roles are activity nouns (Skatīšanās, Ziņošana, Izstrāde) so no person noun is needed. Masculine stays only where it agrees with a masculine noun (vadītājs, dēlis, tests) or "viņu" (neutral genitive).
- Keyboard keys, aigile CLI commands, URLs and the keyword **GO** are untouched.

## Glossary
| English | Latviešu | Note |
|---|---|---|
| card | kartīte | diminutive, as in Trello |
| board | dēlis | |
| project | projekts | |
| lead | vadītājs | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | komanda | |
| helpers | palīgi | |
| agent | aģents | |
| For you | Tev | column `col.verify.short` |
| To do | Darāmais | |
| In progress | Procesā | |
| Team checking | Komanda pārbauda | |
| For you to test | Gaida tavu testu | |
| For the team | Komandai | |
| Done | Izdarīts | |
| Backlog | Backlogs | loanword, declines (backloga) |
| Sprint | Sprints | |
| Stand-up | Stand-up | |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Iesūtne | |
| Home | Sākums | |
| Setup | Iestatījumi | |
| Usage | Lietojums | |
| Look (settings) | Izskats | |
| Permissions | Atļaujas | |
| Views | Skati | |
| test steps | testa soļi | |
| bug | kļūda | |
| commit | commit | loanword |
| assumption | pieņēmums | |
| night watch | nakts sardze | watchman = nakts sargs |
| Night mode | Nakts režīms | |
| No Token Mode | Režīms bez tokenu | |
| token | tokens | |
| poke | pamudināt | button "👉 Pamudināt" |
| Going quiet | Nokluset | |
| Wait and see | Pagaidīt un redzēt | |
| Accept / Send back | Pieņemt / Nosūtīt atpakaļ | |
| Pop out | Atvērt logā | |
| Friends (DMs) | draugi; ziņas = tiešās ziņas | single friend = "kontakts" (no gender) |
| pretend friend / team / AI | izdomāts draugs / izlikta komanda / izlikts MI | |
| AI | MI | mākslīgais intelekts |
| relay | relejs | |

## For the reviewer
- **Gender**: look for any remaining masculine-only participles about the reader or an agent.
- **"Kartīte" (card) vs "karte"**: chosen for the friendly tone; check it against what Latvian teams really say.
- **Plural `zero` category**: texts use the genitive plural ("Atgādināts 0 reižu", "Palūgts 10 vadītājiem"). `quiet.done.*` use the same "label: {count}" form in all three categories.
- **"Dēlis" for board**, "Backlogs", "Sprints" as loanwords; "vadītājs" for lead (masculine noun for a role).
- **Names**: a friend's `{name}` stays in the nominative ("Pajautāt Claude pie {name}", "{name} MI", "Kopīgot ar {name}"). Some spots may want a case ending.
- **`gloss.*.also`**: inflected forms listed by hand; extend if the hover glossary misses a form. `gloss.refactor.also` and `gloss.deploy.also` were left out (not in `en.json`).
- Playful lines: `sm.push.1` "Lai šķīvji griežas", `sm.push.5` "Vicināt pātagu", `quiet.done.h` "Saldu miegu", `assume.plug` "Iejaukties".
- `dms.person` is "Kontakts" to avoid "draugs/draudzene".
