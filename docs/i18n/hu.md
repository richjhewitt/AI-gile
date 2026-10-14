# Magyar (hu): first pass

First pass by a model (AIG-489), for a native-speaker check. File: `public/lang/hu.json`, 1767 keys, same keys and order as `en.json`.

## Register
- Casual **te** (tegezés), as in LocoRadio's Hungarian: "úgyhogy használd", "Nézd meg". Imperatives are the definite/indefinite form that fits the object ("Nyisd meg", "Írj").
- Dates and times: "{n} perce / órája / napja" for "ago". Bare units: `{n} p`, `{n} ó`, `{n} n`.
- No plural forms are needed after a number in Hungarian ("{n} kártya"), so `.one` and `.many` keys carry the same wording where English had a count.
- Quotes: „…” for Hungarian quote marks.
- Keys named in the interface stay in English (Enter, Shift, Esc, Escape).
- Suffixes on filled-in names: where a name from `{name}` would need a case ending I tried to rephrase to avoid it ("Elküldve neki: {name}", "Hozzáadva: {name}"). A few spots still use a hyphen suffix ("{name}-tól", "{name}-nak") that is only right for names ending in certain sounds. Please check.
- "MI" (mesterséges intelligencia) is used for AI throughout ("MI-ügynök", "MI-tesztelő").

## Glossary
| English | Magyar | Note |
|---|---|---|
| card | kártya | |
| board | tábla | |
| project | projekt | |
| lead | vezető | team lead; "Lead Scrum Master" kept in English |
| team | csapat | |
| helpers | segédek | |
| agent | ügynök | |
| For you | Neked | column `col.verify.short` |
| To do | Teendő | |
| In progress | Folyamatban | |
| Team checking | A csapat ellenőrzi | |
| For you to test | Neked kell tesztelni | |
| For the team | A csapatnak | |
| Done | Kész | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | |
| Stand-up | Stand-up | |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Postaláda | |
| Setup | Beállítások | |
| Usage | Használat | |
| Home | Kezdőlap | |
| Test steps | Tesztlépések | |
| Test | teszt / tesztel | |
| Accept / Send back | Elfogadás / Visszaküldés | |
| Wait and see | Várok még | |
| Poke | megbökés / megbök | "meg kell bökni" for "needs a poke"; "noszogat" for the Scrum Master's pushing |
| Wake the team | Csapat felébresztése | |
| Night watch / watchman | Éjszakai figyelés / éjjeliőr | |
| Going quiet | Csendes mód | "bekapcsolod a csendes módot"; the verb "elcsendesedsz" only in the confirm question |
| No Token Mode | Token nélküli mód | |
| Token | token | |
| Assumptions | Feltevések | |
| Bug | bug | |
| Commit / Push / Branch / Merge / Repo | commit / push / branch / merge / repo | kept as developers say |
| Pull request | pull request | |
| Hook | hook | |
| Verbose | Részletes | "a részletes mód" |
| Look | Megjelenés | |
| Pro-friendly | Pro-barát | |
| Friend / mate | barát / haver | |
| Reporter (role) | Hibabejelentő | |
| Pop out | Külön ablak | not "Kiemelés" |
| Life board | Élet-tábla | not "Életrajzi" (that means biography) |
| Plug (an assumption) | javítás kell / javítva | not "foltozd be" |
| from {name} (lane, card) | Feladó: {name} | avoids a suffix on the name |

## Dev-word markers
`{{dev:word}}` markers are kept wherever English has them, wrapping the Hungarian word in its inflected form ("{{dev:teszteld}}", "{{dev:tesztelnivaló}}"). A "show English in brackets" feature would show the stem poorly for these; the reviewer or a later card may want to unwrap them.

## For the reviewer
- Agglutination in the gloss: `gloss.*.also` lists common inflected forms (sprintek, sprintet, commitok...). Please add the ones that actually occur in the UI.
- Compound words such as "tesztlépések" are written as one word; check hyphenation.
- "Kupac" for "pile" in the Tidy feature (`tidy.*`) may be too colloquial; "halom" is the alternative.
- "Zárt alfa" for "Closed alpha", "Éjszakai pillantás" for "Night glance" (a small calm window).
- Strings identical to English on purpose: Backlog, Sprint, Stand-up, Kanban, Token, Hook, Bug, Commit, Push, Merge, Repo, Pull request, Deploy, Branch, role words (Frontend, Backend, Full-stack), paths and addresses.
- GO stays GO in `dms.go.title` ("GO-val") and "Mehet" as the button.

## Answers to the first-pass questions
- Suffixes on filled-in names: every hyphen suffix on a placeholder (`{name}-tól`, `{name}-nak`, `{n}-ből`, `{name}-t`) and every "a(z)" before a placeholder is gone. Names now sit after a colon, in brackets, before "nevű", or as the subject ("{name} utoljára 5 perce jelentkezett").
- `gloss.*.also`: the listed forms cover what the UI writes. No change.
- Compounds: one word is right (tesztlépések, sprintoszlopok, táblasablon, ügynökprogram); fixed the ones that were split.
- "Kupac" is fine for the casual tone of Tidy my pile; kept.
- "Zárt alfa" and "Éjszakai pillantás" are fine.
- GO stays GO, "Mehet" as the button: fine.

## Review (native check, AIG-489)
182 values changed. What changed:
- `{when}` from `ago()` is already "5 perce", so "{when} óta" / "ekkor óta: {when}" read "5 perce óta". Now "{when} indult", "{when} jelentkezett", "utoljára {when} futott", "Éjszakai mód {when} bekapcsolva".
- English trailing spaces restored (`inbox.sum.*`, `act.*.say`): these strings are joined together.
- Errors: "tábláját megnyitása" (now "táblájának megnyitása", twice), "az egyik projektekkel", "Életrajzi tábla", "Mégis {what}" with a noun in it (`leave.confirm` rephrased).
- Wrong meaning: `lead.smRole.help` (wakes teams that have To do cards), `inbox.aiall.title` (tests the AI tester passed), `standup.*.title` ("Kérdezd meg", ask a question, not "Kérd meg").
- Literal or stiff: "meglök" → "megbök", "Csendesedés" → "Csendes mód", "Bőbeszédű" → "Részletes", "Kiemelés" → "Külön ablak", "foltozd be" → "javítás kell", "Megbukott" → "Nem ment át", "Be/Ki" columns → "Bemenet/Kimenet", "nem kerül elküldésre" → "nem küldjük el".
- Double colons removed ("Elküldve neki: {name}: …", "elfogy ekkor: {when}").
- Shorter buttons: `card.looksright`, `share.test.btn`, `inbox.g.accept`.

Still worth a human look:
- "Postaláda" for Inbox; "Beérkezett" is the email-style alternative.
- `sm.push.1` "🍽️ Alapjárat" (idle speed) is a free rendering of "Keep the plates spinning".
- `{{dev:…}}` markers wrap inflected words ("{{dev:teszteld}}", "{{dev:tesztelés}}"); a show-the-English feature would show the stem poorly.
- "{name} kitalált barátot" in `pretend.started.manual` keeps all three {name} placeholders; it reads a little formal.
