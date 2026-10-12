# Danish (da) - first pass

Source of rules: LocoRadio docs/i18n.md (Danish uses the casual "du"; dates use da-DK). Tone follows LocoRadio's da.json: warm, plain, short.

## Register
- Casual "du", never "De".
- "board" is used as in Danish software teams ("boardet"); "tavle" is not used.
- Developer words stay as loanwords, wrapped in `{{dev:...}}` exactly where English has them. Inside the marker the word is Danish where it takes a Danish ending (`{{dev:teste}}`, `{{dev:testet}}`), otherwise the loanword (`{{dev:sprint}}`, `{{dev:bug}}`, `{{dev:commits}}`).
- Short forms: "{n} min siden", "{n} t siden", "{n} d siden" (bare: m / t / d).

## Glossary
| English | Danish |
|---|---|
| card | kort |
| board | board (boardet) |
| project | projekt |
| team | team (pl. teams, def. teamet / teamene) |
| lead | lead / leder |
| Lead Scrum Master | Lead Scrum Master |
| For you | Til dig |
| For the team | Til teamet |
| To do | To do |
| In progress / Doing | I gang |
| Team checking | Teamet tjekker |
| Done | Færdig |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | indbakke |
| Setup | Opsætning |
| Usage | Forbrug |
| test (verb / noun) | teste / test |
| test steps | trin til test |
| bug | bug |
| Accept | Godkend |
| Send back | Send tilbage |
| Wait and see | Vent og se |
| poke | puf (verb: puffe) |
| wake (a team) | vække |
| assumption | antagelse |
| night watch | natvagt |
| going quiet | går stille |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | token |
| Verbose | Udførlig |
| Look (project colour/emoji) | Udseende |
| Permissions | Tilladelser |
| Views | Visninger |
| Docs | Dokumenter |
| Agent | agent |
| helper | hjælper |
| Pop out | Åbn i vindue |
| Stand-up report | Stand-up-rapport |
| Space | Rum |
| Life board | Livsboard |

## For the reviewer
- "Wake / poke" metaphors (vække, puf, knald med pisken) are fairly literal; check they feel natural.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` keeps the English source's "he/him" for the pretend friend ("hans", "ham").
- Danish units: percent written with a space ("50 %").
- "No Token Mode" is untranslated because the English UI treats it as a name; consider "Ingen tokens-tilstand".
