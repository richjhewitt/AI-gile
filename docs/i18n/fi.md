# Finnish (fi) first pass

Card AIG-489. File: `public/lang/fi.json` (1846 keys after review). Needs a native check.

## Register
- Casual "sinä" (as in LocoRadio), imperatives without "ole hyvä". Friendly, short, no officialese.
- Written Finnish with standard orthography. Dates and times use `fi-FI`.
- Where a filled-in `{name}` sits in a sentence it is placed so no case ending is needed ("Henkilön {name} taulu" is the exception where genitive is attached to the word before, not the name). The reviewer should check phrasing like "Avaa henkilön {name} taulu", "Kysy henkilön {name} Claudelta": names are not inflected.
- Plurals: neutral forms ("{n} korttia", "{n} min"); Finnish uses the partitive after numbers, which is what is written. "1 / many" pairs exist as separate keys.

## Glossary
| English | Finnish | Note |
|---|---|---|
| card | kortti | |
| board | taulu | |
| project | projekti | |
| team | tiimi | |
| lead | vetäjä | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Sinulle | column `col.verify.short` |
| To do | Tehtävänä | |
| In progress / Doing | Työn alla | |
| Team checking | Tiimi tarkistaa | |
| For the team | Tiimille | |
| Verify | Sinun testattavasi | wrapped in `{{dev:...}}` |
| Done | Valmis | |
| backlog | Backlog | loanword, as used in Finnish teams |
| sprint | sprintti | |
| stand-up | stand-up | plural "stand-upit" |
| inbox | Postilaatikko | |
| Setup | Asetukset | |
| test steps | testausvaiheet | |
| test (verb/noun) | testata / testi | dev-marker keeps the Finnish word |
| bug | bugi | |
| commit | commit | |
| branch / merge / push / repo | branch / merge / push / repo | kept, glossary lists Finnish alternatives (haara, repositorio) |
| assumption | oletus | |
| night watch | yövahti | "Night watchman" = yövartija (review: "vahtimestari" means caretaker) |
| No Token Mode | Ei tokeneita -tila | |
| token | token | |
| Usage | Käyttö | |
| poke | tönäise / tönäisy | "needs a poke" = kaipaa tönäisyä (review: was töytäisy) |
| going quiet | hiljaiseloon | |
| DM | yksityisviesti | |
| friend | ystävä | |
| permissions | oikeudet | |
| view | näkymä | |
| column | sarake | |
| group | ryhmä | |
| attachment | liite | |
| archive | arkistoi | |
| tour | kierros | |
| wizard | ohjattu asennus | |
| focus | keskittyminen | |
| checklist | tarkistuslista | |
| alerts | ilmoitukset | review: "hälytykset" sounds like alarms |
| build (a feature) | toteutus | review: "rakennus" means a building |
| space (projects inside projects) | työtila | "tila" alone clashes with Status = Tila |
| pretend friend | kuviteltu ystävä | review: "teeskentelevä" meant "pretending" |
| Life board | Arkitaulu | real life = arkielämä |
| tour stop | pysähdys | review: "pysäkki" is a bus stop |
| friend's (their) | ystävän / hänen | review: singular, not "heidän" |
| raise a bug | ilmoittaa bugi | |

## For the reviewer
- `{{dev:...}}` markers now wrap the Finnish word (testattavasi, sprintit, bugi, testausvaiheet...). Check that a later "English in brackets" feature will not double up words that are already English (backlog, commit).
- `gloss.*.also` lists match words in text; I gave Finnish inflected forms plus the English forms. Check them.
- `col.verify` "Sinun testattavasi" and `verdict.waiting` ("että testaat sen") are the longest-risk strings for button/column width.
- "töytäisy" for Poke is playful; consider "muistuta" if it sounds odd.
- The Finnish rendering of "Lead" as "vetäjä" (team leader) vs. keeping "lead": the reviewer may prefer "tiiminvetäjä".
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).

## Answers to the questions above
- `{{dev:...}}` on Finnish words: fine. An "English in brackets" feature should skip a value whose dev word already is the English word (Backlog, commit); worth a code check, not a translation change.
- `gloss.*.also`: the lists are sensible; added "haaran" for branch.
- Width: `col.verify` stays "Sinun testattavasi"; `verdict.waiting` is now the shorter "Valmis ja odottaa testaustasi".
- Poke: "tönäisy / tönäise" is the everyday word; "töytäisy" sounded odd, "muistuta" loses the playfulness.
- Lead: "vetäjä" is good and short; "tiiminvetäjä" would crowd buttons. Kept.

## Review
Native-speaker pass over all 1846 values (AIG-489). 248 values changed, 79 added.
- Added the 79 keys that were missing (demo projects, pretend team, server-written notes `srv.*`), so the file now matches `en.json` key for key.
- Terms: töytäisy → tönäisy; yövahtimestari / vahtimestari → yövartija / vartija; hälytykset → ilmoitukset; teeskentelevä ystävä → kuviteltu ystävä; rakennus → toteutus; pysäkki → pysähdys; Elämätaulu → Arkitaulu; Tila (space) → Työtila.
- Friend texts used plural "heidän / he" for a single friend; now "ystävän" or "hän".
- Rewrote stiff "-aksesi" constructions ("klikkaa sammuttaaksesi", "osoittaaksesi") into natural forms ("... klikkaamalla", "..., niin näet").
- "per" replaced by Finnish forms ("Rivit henkilöittäin", "yksi sääntö riviä kohti").
- Fixed meaning: "AI passed" is now "tekoäly hyväksyi" (the tester approved, it did not "pass" the test); `lead.smRole.help` "wakes teams with To do" = teams that have To do cards; `share.via` word order; "1 vetäjää" plural.
- Fixed typos ("poluilta" → "polulta"), double "liitä" in `attach.title`, "on pois tästä projektista" → "pois päältä tässä projektissa".
- Timestamps: "takaisin klo {time}", "Herätä minut klo".

Still worth a human look:
- `live.ok` "livenä" is colloquial; "yhteys päällä" is an option if it reads oddly.
- "koukku / koukut" for hooks: some Finnish developers say "hookit".
- `space.btn` "Työtila": check it fits next to the other board buttons.
- Count strings with `{n}` before a noun use the partitive ("{n} korttia"), which reads wrong only for n = 1; the code picks separate one/many keys in most places.
