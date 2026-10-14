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
| going quiet | holde pause (button: 🌙 Hold pause; heading: 🌙 Pause) |
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
| Space (🪐 button) | Placering; projects inside: "herinde" |
| Life board | Livsboard |
| alerts (browser) | notifikationer |
| pretend friend | fiktiv ven |
| a friend (3rd person) | vennen, vennens (never a capitalised "De / Deres", which reads as the formal "you") |
| Lead Scrum Master, a lead (pronoun) | den |
| Watchman ticks every project | Natvagt på alle projekter |
| AI passed / failed | AI-bestået / ikke bestået |
| holds up {n} | blokerer {n} |

## For the reviewer
- "Wake / poke" metaphors (vække, puf, knald med pisken) are fairly literal; check they feel natural.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` keeps the English source's "he/him" for the pretend friend ("hans", "ham").
- Danish units: percent written with a space ("50 %").
- "No Token Mode" is untranslated because the English UI treats it as a name; consider "Ingen tokens-tilstand".

## Answers to the translator's questions
- Wake / poke: "vække" and "puf" are natural. "Knald med pisken" is not an idiom; the idiom is "smælde med pisken" (now used). "Skub til teamet" became "Giv teamet et puf", so poke has one word.
- `prof.*`, `gloss.*.also` and `*.word`: English where Danish developers say it in English. Fine as is.
- `pretend.*`: "hans / ham" kept (the pretend friend is Davy). "lest-som-om" is not Danish (the verb is "lade som om"); now "fiktiv ven" / "fiktivt team".
- "50 %" with a space is right for Danish.
- No Token Mode: keep it as a feature name. "Ingen tokens-tilstand" reads clumsily.

## Review (native-speaker pass, AIG-489)
- Going quiet: "går stille" means walking quietly. Now "holde pause" everywhere (home, quiet dialog, night watch, wizard).
- Formal-you trap: a capitalised "De / Deres" (they / their at the start of a sentence) reads as the formal "you". Rewritten with "vennen / vennens / ejerens" in the share, friend, role and test texts.
- "bygning" (a building) for "build": now "før der bygges / før noget bliver bygget".
- Alerts: "alarmer" sounded like alarms; now "notifikationer".
- "hver 30. min" became "hvert 30. minut" (et minut). "Vagten tikker på" (a calque of "ticks") became "Natvagt på alle projekter", and the Lead Scrum Master tooltip that quotes it now matches.
- Grammar: "så du ser kun", "nå det" (boardet), "Svarer på", "Svar {name}", "AI's", "Udviklerord er fint", "Alle beståede", "hvor der er brug for dig", "dets mappe".
- Confirm questions now start with "Vil du …?" instead of a bare infinitive.
- More natural or shorter labels: Søg / Søger (not Led / Leder), akut, Applogo, Fuld knald på, Langsomt, men sikkert, Stille og roligt, Lidt hjælp, Al hjælp, Placering (🪐 Space), Beslutning.
- Still for a human native speaker: "Udførlig" for Verbose; "chip" in the tour; "Teamet tjekker" as a column name; "Badgemager"; whether "Til dig at teste" reads well as a column title; "board" vs "tavle" overall.
