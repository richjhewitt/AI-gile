# AI-gile in Luxembourgish (lb)

First pass by Babel for AIG-494. Not yet checked by a native speaker.

## Register
- Casual **du** throughout (never the polite Dir), as in LocoRadio's Luxembourgish. Imperatives in du form ("Klick", "Wiel", "Schreif"). In question inflections the Luxembourgish clitic is written as in "s du" / "gëss", "méchs" (verb + s + du).
- Standard Luxembourgish spelling (LU 1999 reform): ë, é, ä, ei, ou, "w.e.g." avoided in favour of short forms.
- The reader, agents and contacts are never gendered. Singular "friend" is avoided: "Kontakt", "Persoun", "een" or the plural "Frënn". Role names use nouns of activity (Mellung, Entwécklung, Test).
- Plurals: Intl gives `one` and `other` for lb, so plural objects have both.
- `{{dev:...}}` markers wrap the Luxembourgish developer word (Test, Sprint, Bug, Commit), including verb forms ("testen", "tests").
- Loanwords kept as software teams in Luxembourg say them: Backlog, Sprint, Stand-up, Bug, Commit, Branch, Merge, Repo, Deploy, Hook, Token, Kanban, Setup, Inbox, Lead, Scrum Master, Look, Space, Log, Server, Terminal, Checklëscht.
- Durations: Min., Std., D. Dates follow the lb-LU locale.

## Glossary
| English | Luxembourgish | Note |
|---|---|---|
| card | Kaart (pl. Kaarten) | |
| board | Board | loanword |
| project | Projet | |
| team | Team | neuter; "d'Team" |
| lead | Lead | kept |
| Lead Scrum Master | Lead Scrum Master | kept |
| For you | Fir dech | |
| To do | Ze maachen | |
| In progress / Doing | Amgaang | |
| Team checking | Team kontrolléiert | |
| For the team | Fir d'Team | |
| Verify column ("For you to test") | Fir dech zum Testen | |
| Done | Fäerdeg | |
| Backlog | Backlog | kept |
| sprint | Sprint | kept |
| stand-up | Stand-up | kept |
| inbox | Inbox | kept |
| Setup | Setup | kept |
| Usage | Notzung | |
| plan (Claude plan) | Plang | |
| test | Test / testen | |
| test steps | Testschrëtt | |
| AI tester passed / failed | bestanen / duerchgefall | |
| Send back | Zréckschécken | |
| Accept | Akzeptéieren | |
| Wake (team) | Erwächen | |
| Poke | Aschubs / aschubsen | |
| night watch | Nuetswuecht | the watchman: Nuetswiechter |
| Going quiet | Roueg ginn | |
| idle | rouhend | |
| assumption | Annahm | "Plug this" = "Lück zoumaachen" |
| Come back… (timed) | Kommt zeréck… | |
| No Token Mode | No-Token-Modus | |
| token | Token (pl. Tokens) | |
| agent | Agent (pl. Agenten) | |
| helper | Helfer | |
| Permissions | Rechter | |
| Views | Usiichten | |
| DM | DM | kept |
| Pop out | Ausléieren | |
| Life board | Liewensboard | |
| Checklist | Checklëscht | |
| Friend / contact | Kontakt, pl. Frënn | |

## For the reviewer
- "KI" is used for AI (Lux. also "AI"); check which one native speakers prefer.
- Verb forms like "Dréck", "Zéi", "Wiel" (imperatives) and the du-clitics ("s du wëlls", "méchs") should be checked against standard spelling.
- Words borrowed from German that may sound too German: "Sécherheet", "Notzung", "Annahm", "Feinschliff", "Zesummefaassung". Replace with more Luxembourgish words if natives prefer.
- "Fir dech zum Testen" (Verify column) is long next to the other column titles.
- Dative/nominative n-rule (Eifeler Regel) was applied by feel in a few places; worth a check.
- `pt.*` strings (the pretend friend's replies) are casual; check the tone.
