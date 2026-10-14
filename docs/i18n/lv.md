# Latviešu (lv): first pass

First pass by a model (AIG-494), then a native-speaker review pass (see Review below). File: `public/lang/lv.json`, 1939 keys, same keys and order as `en.json`.

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
| No Token Mode | Režīms bez tokeniem | "bez" + dative plural |
| token | tokens | |
| poke | pamudināt | button "👉 Pamudināt" |
| Going quiet | Uz brīdi prom | "kad esi prom" (when you are away); not "noklust/nokluset" |
| Wait and see | Pagaidīt un redzēt | |
| Accept / Send back | Pieņemt / Nosūtīt atpakaļ | |
| Pop out | Atvērt logā | |
| Friends (DMs) | draugi; ziņas = tiešās ziņas | single friend = "kontakts" (no gender) |
| pretend friend / team / AI | izdomāts draugs / izlikta komanda / izlikts MI | |
| AI | MI | mākslīgais intelekts |
| ways of working | darba noteikumi | not "darba kārtība" (= agenda) |
| to test (chip, badge) | jātestē | debitive, no gender |
| AI passed | MI apstiprināti | the AI tester approved them; "izturēja" only for the card itself |
| waits for (dependency) | gaida + accusative | not "gaida uz" |
| pack (for another AI) | pakete | |
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

## Review (native-speaker pass, AIG-494)
Every value was read next to the English. 168 values changed, 7 missing keys added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).

Answers to the questions above:
- **Gender**: the remaining masculine forms toward the reader or a friend are gone: "būsi nesasniedzams", "kur esi vajadzīgs", "tu paliec atbildīgs", "ja neesi pārliecināts", "tavi paša vārdi", "Tavs paša maisījums", "{name} ir gatavs", "{name} pievienots", "{name} ir bloķēts", "{name} nav kopīgojis", "{name} netiek uzskatīts par tevi", "Tu esi {name} (izdomāts)". Masculine stays only where it agrees with a masculine noun (vadītājs, kontakts, tests, projekts, MI).
- **"Kartīte"**: kept. It is what Latvian Trello and Jira users say; "karte" reads as a map.
- **`zero` plurals**: fine as genitive plural. Where a number sat in front of a noun with a form that is wrong for some counts ("{n} kartītes, {n} komentāri", "{n} tokeni", "{n} soļi"), it now uses "Label: {n}".
- **"Dēlis", "Backlogs", "Sprints", "vadītājs"**: natural for software teams; kept.
- **Names in the nominative**: acceptable in a UI. Rewritten where it broke the sentence ("Saistīts ar projektu “{project}” ({name})", "Piešķirts ({name})", "Nav nosūtīts ({name})").
- **`gloss.*.also`**: added "jātestē" to `gloss.test.also`.
- **Playful lines**: kept "Lai šķīvji griežas", "Vicināt pātagu", "Saldu miegu", "Iejaukties".
- **`dms.person` "Kontakts"**: kept. "Draugs/draugi" as a plain noun stays elsewhere (the normal word for friend); only adjectives and participles about a friend were made neutral.

What changed:
- "Going quiet" was "Nokluset / Nokluse / nokluseni", which are not Latvian words: now "Uz brīdi prom" and "kad esi prom" everywhere.
- "Režīms bez tokenu" → "Režīms bez tokeniem" (bez + dative plural), likewise "bez tokeniem" elsewhere.
- "darba kārtība" (means agenda) → "darba noteikumi" for ways of working.
- "Gaida uz" (calque) → "Gaida" + accusative for card dependencies.
- "AI passed" was "MI izturēja" (the AI passed): now "MI apstiprināti"; the 🤖 chip on a card keeps "Izturēja".
- "Testējami" (masculine participle) → debitive "Jātestē" for the to-test chips and badges.
- Cards agree in the feminine plural ("nodotas", "izdarītas", "iestrēgušas"); case and word order fixes ("1 komanda jāpamudina", "uz taviem komentāriem", "programmā Notepad", "Atgriezties plkst.", "Esc, lai izietu").
- Wrong meanings: "Send to" fields now "Kam nosūtīt"; "tiešraidē" (broadcast live) → "aktuāls / reāllaikā" for live data; "Vajag roku" → "Vajag palīdzību"; "Review" column → "Pārskatīšana".
- `srv.assume.refill` no longer puts a priority adjective before "backlog kartīti": "(prioritāte: {priority})".

Still for a human native speaker:
- "Uz brīdi prom" / "Iet prom" for the Going quiet button and heading: short and neutral, check it feels right next to 🌙.
- `pretend.tag` "pa jokam" and `pretend.banner` "(pa jokam)": chosen to avoid "izdomāts/izdomāta" toward the reader.
- `ask.btn` "Pajautāt Claude pie {name}": still stiff while names are not declined.
- `usage.kind.pack` "Paketes palīgs" and the share role activity nouns (Skatīšanās, Ziņošana, Dalība, Izstrāde).
