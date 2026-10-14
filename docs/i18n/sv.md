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
| going quiet | ta paus (button: 🌙 Ta paus; heading: 🌙 Paus) |
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
| Space (🪐 button) | Placering; projects inside: "här inuti" |
| Life board | Livstavla |
| plan (subscription) | abonnemang |
| alerts (browser) | aviseringar |
| appointment (life card) | bokad tid |
| Lead Scrum Master, a lead (pronoun) | den |
| Watchman ticks every project | Nattvakt för alla projekt |
| AI passed | AI-godkända |
| holds up {n} | blockerar {n} |

## For the reviewer
- "Wake / poke" metaphors (väcka, knuff, smäll med piskan) are fairly literal; check they feel natural.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` keeps the English source's "he/him" for the pretend friend ("hans", "honom").
- Percent written with a space ("50 %"), as Swedish style asks.
- "Plan" (subscription plan) is rendered "plan"; "abonnemang" could read more naturally in places.
- "No Token Mode" is untranslated because the English UI treats it as a name.

## Answers to the translator's questions
- Wake / poke: "väcka" and "knuff" are natural. "Smäll med piskan" is not idiomatic; now "Fram med piskan". "Puffa teamet" became "Ge teamet en knuff", so poke has one word.
- `prof.*`, `gloss.*.also` and `*.word`: English where Swedish developers say it in English. Fine as is.
- `pretend.*`: "hans / honom" kept (the pretend friend is Davy). "Låtsasvän" is natural.
- "50 %" with a space is right for Swedish.
- Plan: "Din plan" reads oddly for a subscription. Now "abonnemang" in every usage, budget, No Token Mode and wizard string.
- No Token Mode: keep it as a feature name.

## Review (native-speaker pass, AIG-489)
- Going quiet: "går tyst" is not idiomatic. Now "ta paus" everywhere (home, quiet dialog, night watch, wizard).
- Plan became abonnemang (usage page, gauges, token gloss, budget, No Token Mode, wizard).
- Wrong words: "topplisten" (the charts) became "fältet längst upp"; "larm" became "aviseringar"; "Möte" (a meeting) for appointment became "Bokad tid"; "Rymd" (outer space) became "Placering".
- Grammar: "det kommer ihåg" became "valet sparas"; "Tavelmall" became "Mall för tavlan"; "Väckte" became "Väckta"; "påmind" became "påmint"; "håller upp" (calque) became "blockerar"; "vad det ska kalla dig" (teamet); a lead is "den", not "de"; "data … är sparade".
- AI context is "kontext", not "sammanhang", in the token table.
- Confirm questions now start with "Vill du …?" instead of a bare infinitive.
- More natural labels: Sök / Söker, Stadigt, Fullt ös, Sakta men säkert, Granskas, populära GIF:ar, Appens logga, Var teamen körs.
- Still for a human native speaker: "idag" vs "i dag" (left as written, both are accepted); "brief" in the lead settings; "Utförligt läge"; "chip" in the tour; "Teamet kollar" as a column name.
