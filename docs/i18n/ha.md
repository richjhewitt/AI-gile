# Hausa (ha): first pass

First pass by a model (AIG-496), for a native-speaker check. File: `public/lang/ha.json`, 1939 keys, same keys and order as `en.json`. Latin script (boko), with the hooked letters (ɓ ɗ ƙ) and the glottal stop written as in LocoRadio's Hausa. Tone and vowel length are not marked, as in everyday Hausa writing. Dates use `ha-NG`.

## Register
- Friendly and short, close to LocoRadio's Hausa. Buttons are impersonal imperatives with the `a-` form ("Ajiye", "Soke", "A kwafa"), and statuses use the continuous "Ana ..." ("Ana lodawa...").
- **Hausa marks the gender of "you"** (ka / ki, -ka / -ki, kai / ke). To follow the no-gendering rule, the reader is never addressed with a gendered form: the impersonal ("a ...") is used where possible, and the gender-neutral plural/respectful "ku" / "-ku" ("sunanku", "za ku iya") where a direct "you" is needed. LocoRadio's file uses the masculine ("na'urarka"); this one does not. Check that "ku" reads naturally to a single reader, not too formal.
- Agents, friends and teams are addressed by name or role, never by "he/she": `{name}` is used where a pronoun would be gendered. Hausa third person is also gendered (ya / ta), so some lines use "su" or a noun instead.
- Plurals: `ha` has only `one` / `other` in Intl.PluralRules. Plural objects give "kati {count}" / "katuna {count}" where the noun changes, and the same text where it does not.
- Names, keys, `aigile` commands, emoji, `{placeholders}`, `**bold**`, `<tags>` and `{{dev:...}}` markers are untouched.

## Glossary
| English | Hausa | Note |
|---|---|---|
| card | kati (katuna) | |
| board | allo | |
| project | aiki (ayyuka) | |
| lead | jagora (jagorori) | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | ƙungiya (ƙungiyoyi) | |
| helpers | mataimaka | |
| agent | wakili (wakilai) | |
| For you | Gare ku | `col.verify.short` |
| To do | A yi | |
| In progress | Ana yi | |
| Team checking | Ƙungiya na dubawa | |
| For you to test | Don a gwada | |
| For the team | Don ƙungiya | |
| Done | An gama | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | loanword |
| Stand-up | Stand-up | loanword |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Akwatin saƙo | |
| Messages / DMs | Saƙonni / Saƙonni na sirri | |
| Setup | Saiti | |
| Usage | Amfani | |
| Home | Gida | |
| test | gwaji (gwada, gwadawa) | verb forms are listed in `gloss.test.also` |
| test steps | matakan gwaji | |
| bug | bug | loanword |
| commit / push / branch / merge / repo | commit, Push, Branch, Merge, Repo | loanwords |
| assumption | zato (zace-zace) | "Zato" for one, "Zace-zace" in the nav label |
| night watch | tsaron dare | "mai tsaron dare" for the watchman |
| No Token Mode | Yanayin Babu Token | |
| token | token | loanword |
| poke | tunatar / tuni | "👉 Tunatar"; "needs a poke" is "yana buƙatar tuni" |
| Accept / Send back | Karɓa / Mayar | |
| Go (answer) | Tafi | `dms.go`, `act.go` |
| Views | Gani | |
| Permissions | Izini | |
| Going quiet | Yin shiru | |
| Friend(s) | aboki (abokai) | |
| Tour | Rangadi | |
| Theme / Language | Jigo / Harshe | |
| folder / file | babban fayil / fayil | |

## For the reviewer
- Check the "ku" choice for "you" (see Register), and whether an impersonal form would be more natural in places such as the confirmation questions.
- `{{dev:...}}` markers: "gwada", "gwadawa", "gwaji", "gwaje-gwaje", "sprints", "bug", "commit(s)", "Backlog" match `gloss.*.word` / `.also`. The marker for test is a verb in some lines ("Don a {{dev:gwada}}") and a noun in others ("Matakan {{dev:gwaji}}"); both are listed so the tooltip finds them.
- Word choices a native may want to replace: "allo" for board, "tunatar" for poke, "zato" for assumption, "Tafi" for the Go button, "tsaron dare" for night watch, "Gani" for Views.
- Level words and role names (`prof.level.*`, Frontend, Backend, Full-stack, Mobile, PM / Scrum) stay English, as Hausa-speaking software teams say them.
- Shared-card and DM sections (`share.*`, `sb.*`) were long and technical; read them in the UI for flow.
- The pretend friend's name Davy is kept; the friend is not given a pronoun.
