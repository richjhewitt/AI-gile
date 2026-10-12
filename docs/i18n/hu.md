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
| For you to test | Neked tesztelni | |
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
| Poke | meglökés | "meg kell lökni" for "needs a poke" |
| Wake the team | Csapat felébresztése | |
| Night watch / watchman | Éjszakai figyelés / éjjeliőr | |
| Going quiet | Csendesedés | |
| No Token Mode | Token nélküli mód | |
| Token | token | |
| Assumptions | Feltevések | |
| Bug | bug | |
| Commit / Push / Branch / Merge / Repo | commit / push / branch / merge / repo | kept as developers say |
| Pull request | pull request | |
| Hook | hook | |
| Verbose | Bőbeszédű | |
| Look | Megjelenés | |
| Pro-friendly | Pro-barát | |
| Friend / mate | barát / haver | |
| Reporter (role) | Hibabejelentő | |

## Dev-word markers
`{{dev:word}}` markers are kept wherever English has them, wrapping the Hungarian word in its inflected form ("{{dev:teszteld}}", "{{dev:tesztelnivaló}}"). A "show English in brackets" feature would show the stem poorly for these; the reviewer or a later card may want to unwrap them.

## For the reviewer
- Agglutination in the gloss: `gloss.*.also` lists common inflected forms (sprintek, sprintet, commitok...). Please add the ones that actually occur in the UI.
- Compound words such as "tesztlépések" are written as one word; check hyphenation.
- "Kupac" for "pile" in the Tidy feature (`tidy.*`) may be too colloquial; "halom" is the alternative.
- "Zárt alfa" for "Closed alpha", "Éjszakai pillantás" for "Night glance" (a small calm window).
- Strings identical to English on purpose: Backlog, Sprint, Stand-up, Kanban, Token, Hook, Bug, Commit, Push, Merge, Repo, Pull request, Deploy, Branch, role words (Frontend, Backend, Full-stack), paths and addresses.
- GO stays GO in `dms.go.title` ("GO-val") and "Mehet" as the button.
