# Kiswahili (sw): first pass

First pass by a model (AIG-493), for a native-speaker check. File: `public/lang/sw.json`, 1932 keys, same keys and order as `en.json`. Dates use `sw-KE`.

## Register
- Friendly, direct and casual, as in LocoRadio's Swahili: short imperatives for buttons ("Hifadhi", "Ghairi", "Tuma") and the infinitive ("Kuiomba timu...") for confirmation questions. No honorific plural ("ninyi") for the reader.
- Swahili pronouns are gender-neutral (yeye), so the reader, agents and friends need no workaround. Person-class verb prefixes (a-/wa-) are used for people, ki-/i-/zi- agreement for cards (kadi is class 9/10: "kadi zimekamilika", "zinaendelea").
- Plurals: `one` / `other` (Intl.PluralRules gives only these). Swahili usually puts the number after the noun with no change ("kadi {count}"), so both forms are the same where the noun does not change.
- Keyboard keys, `aigile` commands, product and model names left untouched.

## Glossary
| English | Kiswahili | Note |
|---|---|---|
| card | kadi | |
| board | ubao | |
| project | mradi (miradi) | |
| lead | kiongozi | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | timu | |
| helpers | wasaidizi | |
| agent | wakala (mawakala) | |
| For you | Kwako | `col.verify.short` |
| To do | Za kufanya | |
| In progress | Zinaendelea | |
| Team checking | Timu inakagua | |
| For you to test | Zako za kujaribu | column; the marker is on "kujaribu" |
| For the team | Kwa timu | |
| Done | Zimekamilika | plural, since the column holds cards |
| Backlog | Backlog | loanword |
| Sprint | Sprint | loanword |
| Stand-up | Stand-up | loanword |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Kikasha | |
| Setup | Mipangilio | |
| Usage | Matumizi | |
| Home | Mwanzo | |
| test steps | hatua za kujaribu | glossary word is "Jaribio" with "test" accepted |
| bug | bug | loanword, plural "bugs" |
| commit | commit | |
| assumption | dhana | |
| night watch | mlinzi wa usiku | |
| No Token Mode | Hali ya Bila Tokeni | |
| token | tokeni | |
| poke | kusukuma / msukumo | "nudge"; button "👉 Sukuma" |
| Accept / Send back | Kubali / Rudisha | |
| Views | Miwonekano | |
| Stand-up report | Ripoti ya stand-up | |
| Look (settings) | Mwonekano | |
| Permissions | Ruhusa | |
| Going quiet | Kunyamaza | |
| Friends (DMs) | marafiki | |
| Tour | Ziara | |
| Go (answer) | Endelea | `dms.go`, `act.go` |
| team member | mwanatimu (wanatimu) | not "mwanachama", which is kept for a shared-board Member role |
| rows (lanes) | mistari | "safu wima" stays for columns, so rows never read as "safu" |
| switch (on/off setting) | swichi | "kitufe" is only a button |
| wizard | mwongozo | "mchawi" means sorcerer |
| AI tester | AI ya majaribio | the share role Tester is "Mjaribishaji" ("mjaribu" also means tempter) |
| plug (an assumption) | rekebisha | |
| Done (button) | Maliza | the column stays "Zimekamilika" |

## For the reviewer
- Developer words kept as English loanwords (backlog, sprint, stand-up, bug, commit, push, branch, merge, repo, deploy, hook, pull request); the glossary `.also` lists include plural forms ("bugs", "sprints").
- `{{dev:...}}` markers inside values carry the displayed word and must match `gloss.*.word` or `.also`: markers use "test"/"kujaribu", "bug"/"Bugs", "Sprint", "Stand-up". Check they highlight as intended.
- "Poke" is rendered as "msukumo" / "kusukuma" (push); "kuamsha" (wake) is used for waking a team. Native speakers may prefer another word.
- "Night watch" is "mlinzi wa usiku" (night guard); the Lead Scrum Master "Lead Scrum Master" stays English.
- Agent first-person lines in `srv.*` use plain "ni-" forms ("niliacha kuianzisha upya"); check the tone fits a friendly bot.
- Level words `prof.level.*` and several role names (Frontend, Backend, Full-stack, PM / Scrum, Data) are kept in English, as teams say them.
- The pretend friend's name Davy is kept; the friend is addressed by name only, never by pronoun.

## Review (AIG-493)
Second pass by a model reviewing as a native speaker: every value read next to the English. 161 values changed.

Answers to the questions above:
- Markers: every `{{dev:...}}` now carries a word from `gloss.test.word`/`.also` (Jaribio, kujaribu, majaribio; "uijaribu" added to `.also` for `verdict.waiting`). The test markers that showed "(test)" in brackets after the Swahili are gone: "Zako za {{dev:kujaribu}}", "Jinsi ya {{dev:kujaribu}}".
- "Poke" as "kusukuma / msukumo": kept; it reads as a nudge.
- Night watch "mlinzi wa usiku": kept. Being a person, his on/off reads "kazini / hayupo kazini" instead of "umewashwa".
- `srv.*` first-person lines: fine as plain "ni-" forms.
- `prof.level.*` and Frontend, Backend, Full-stack, PM / Scrum, Data: kept in English, as teams in East Africa say them.

What changed:
- Agreement fixes: person class for the watchman and for {name} (poke.auto "mwenyewe", share.role.never "haamshi"), project class for spaces ("{name} sasa iko"), comments ("kuyashughulikia"), "kukirudia".
- Wrong words: "kizuizi" (obstacle) for a code block is now "sehemu"; "Peana jina" is "Upe ... jina"; "vipimo" (measurements) for specs is "maelezo ya kiufundi"; "Mpangaji" (tenant) is "Mpangilio wa Bustani"; "kikongwe" (elderly) for old sessions is "cha zamani"; "hazitiii" (do not obey) in the tour; "Hodari" for Keen is "Kwa bidii".
- Terms made consistent: team member, rows, switch, wizard, AI tester, plug, test, as in the glossary.
- Buttons and imperatives: "Iambie", "Uliza kila timu", "Mwongeze", "Mwombe", "Umkabidhi nani?", "Anza ziara" (not "Chukua ziara"), "Maliza" for Done buttons, "Haya, anza!" instead of "Nenda zako" (which sounds like "go away").
- Clearer usage wording: the table headers "Matumizi ya kipindi / ya wiki", "ukifika 100% umemaliza", "Hadi miwonekano 20", "isizidi MB 6".
- pretend.keep.q / pretend.running now hold {name} once, as in English.

For a human native speaker to check:
- `timed.p.tom` / `timed.p.mon` say "9:00 asubuhi" so the clock reads as Western time, not Swahili time (where "saa 9" is 3 pm).
- "Kumbukumbu" means both a log and the archive ("hifadhi kwenye kumbukumbu"); context separates them, but a better archive word may exist.
- "Duka la Chapati" localises pancakes as chapati; check it feels right.
- Whether English loanwords (backlog, sprint, bug, commit, Lead Scrum Master, junior/senior) or Swahili words suit the readers better.
