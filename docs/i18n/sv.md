# Swedish (sv) - first pass

Source of rules: LocoRadio docs/i18n.md (Swedish uses the casual "du"; dates use sv-SE). Tone follows LocoRadio's sv.json: warm, plain, short.

## Register
- Casual "du".
- "tavla" for board (as in "kanban-tavla"); "board" is not used.
- Developer words are Swedish loanwords inside the `{{dev:...}}` markers exactly where English has them: `{{dev:bugg}}`, `{{dev:sprintar}}`, `{{dev:testa}}`/`{{dev:testar}}`/`{{dev:testas}}`, `{{dev:commits}}`.
- Short forms: "{n} min sedan", "{n} h sedan", "{n} d sedan" (bare: m / h / d).

## Glossary
| English | Swedish |
|---|---|
| card | kort |
| board | tavla (tavlan) |
| project | projekt |
| team | team (pl. team) |
| lead | lead / ledare |
| Lead Scrum Master | Lead Scrum Master |
| For you | Till dig |
| For the team | Till teamet |
| To do | To do |
| In progress / Doing | Pågår |
| Team checking | Teamet kollar |
| Done | Klart |
| Backlog | Backlog |
| sprint | sprint (pl. sprintar) |
| stand-up | stand-up |
| inbox | inkorg |
| Setup | Inställningar |
| Usage | Användning |
| test (verb / noun) | testa / test |
| test steps | teststeg |
| bug | bugg |
| Accept | Godkänn |
| Send back | Skicka tillbaka |
| Wait and see | Vänta och se |
| poke | knuff (verb: knuffa) |
| wake (a team) | väcka |
| assumption | antagande |
| night watch | nattvakt |
| going quiet | går tyst |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | token |
| Verbose | Utförligt läge |
| Look (project colour/emoji) | Utseende |
| Permissions | Behörigheter |
| Views | Vyer |
| Docs | Dokument |
| Agent | agent |
| helper | hjälpare |
| Pop out | Öppna i fönster |
| Stand-up report | Stand-up-rapport |
| Space | Rymd |
| Life board | Livstavla |

## For the reviewer
- "Wake / poke" metaphors (väcka, knuff, smäll med piskan) are fairly literal; check they feel natural.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` keeps the English source's "he/him" for the pretend friend ("hans", "honom").
- Percent written with a space ("50 %"), as Swedish style asks.
- "Plan" (subscription plan) is rendered "plan"; "abonnemang" could read more naturally in places.
- "No Token Mode" is untranslated because the English UI treats it as a name.
