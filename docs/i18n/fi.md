# Finnish (fi) first pass

Card AIG-489. File: `public/lang/fi.json` (1767 keys). Needs a native check.

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
| night watch | yövahti | "Night watchman" = yövahtimestari |
| No Token Mode | Ei tokeneita -tila | |
| token | token | |
| Usage | Käyttö | |
| poke | töytäise / töytäisy | "needs a poke" = kaipaa töytäisyä |
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

## For the reviewer
- `{{dev:...}}` markers now wrap the Finnish word (testattavasi, sprintit, bugi, testausvaiheet...). Check that a later "English in brackets" feature will not double up words that are already English (backlog, commit).
- `gloss.*.also` lists match words in text; I gave Finnish inflected forms plus the English forms. Check them.
- `col.verify` "Sinun testattavasi" and `verdict.waiting` ("että testaat sen") are the longest-risk strings for button/column width.
- "töytäisy" for Poke is playful; consider "muistuta" if it sounds odd.
- The Finnish rendering of "Lead" as "vetäjä" (team leader) vs. keeping "lead": the reviewer may prefer "tiiminvetäjä".
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).
