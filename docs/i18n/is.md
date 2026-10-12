# Icelandic (is) - first pass

Source of rules: LocoRadio docs/i18n.md and is.json (casual "þú", never "þér"; dates use is-IS; plurals one / other as Intl.PluralRules gives for is: "one" covers 1, 21, 31 ... but not 11). Tone: warm, plain, short. Written by a model; a native check is needed.

## Register
- Casual "þú". Quotes use „ “.
- Never gendered: no "tilbúinn/tilbúin", "kominn/komin" or "sjálf/ur" forms. Neuter, passive or a noun is used instead ("Komið aftur", "Gaman að sjá þig!", "Lokið").
- Developer words stay as loanwords where Icelandic teams say them (backlog, sprint, commit, push, branch, merge, repo, token in the glossary text, prod). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Icelandic forms (`{{dev:prófa}}`, `{{dev:prófir}}`, `{{dev:prófunar}}`, `{{dev:bögg}}`, `{{dev:sprintar}}`). The glossary `*.also` lists match these forms.
- Short forms: "fyrir 5 mín.", "fyrir 2 klst.", "fyrir 3 d." (bare: mín. / klst. / d.).
- Plurals: one / other.

## Glossary
| English | Icelandic |
|---|---|
| card | spjald |
| board | borð |
| project | verkefni |
| team | teymi |
| lead | teymisstjóri |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Fyrir þig |
| For the team | Fyrir teymið |
| To do | Á dagskrá |
| In progress / Doing | Í vinnslu |
| Team checking | Teymið yfirfer |
| Done | Lokið |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stöðufundur |
| inbox | pósthólf |
| Setup | Uppsetning |
| Usage | Notkun |
| test (verb / noun) | prófa / prófun |
| test steps | prófunarskref |
| bug | bögg |
| Accept | Samþykkja |
| Send back | Senda til baka |
| Wait and see | Bíða og sjá |
| poke | ýta við (noun: ýtt) |
| wake (a team) | vekja |
| assumption | forsenda |
| night watch | næturvakt (the watchman: næturvörður) |
| going quiet | verða ekki við |
| No Token Mode | No Token Mode (feature name kept) |
| token | tákn |
| Verbose | Ítarlegt |
| Look (project colour/emoji) | Útlit |
| Permissions | Heimildir |
| Views | Sýnir |
| Docs | Skjöl |
| Agent | umboðsmaður |
| Pop out | Sérgluggi |
| Space (🪐) | Rými |
| Life board | Lífsborð |
| pretend friend | þykjustuvinur |
| GO (answer button) | Áfram (the literal word GO stays in sentences that quote the reply) |

## For the reviewer
- "Á dagskrá" for To do and "Teymið yfirfer" for Team checking: check they read naturally as column names.
- "teymisstjóri" for lead, "umboðsmaður" for agent, "tákn" for token, "bögg" for bug: some teams say "bug", "agent" or "token" as-is.
- "Verða ekki við" / "Ekki við" for going quiet is a guess; "Næturvakt" and "næturvörður" for night watch.
- Plurals of "{count} spjald / spjöld" and "dagur" forms (e.g. "eftir 3 daga") are written for one / other only; case endings after a number may need tuning.
- "dms.nomsgs.watch", "sm.night.what" and other lines about the Lead Scrum Master use passive voice to avoid gendering it.
- Mixed loanwords inside compounds ("sprint-dálkar", "README-skrár") should be checked.
