# AI-gile in Maltese (mt)

First pass by Babel for AIG-494. Not yet checked by a native speaker.

## Register
- Casual, friendly second person singular, as in LocoRadio's Maltese. Imperatives are the bare "inti" forms ("Ikklikkja", "Agħżel", "Ikteb").
- Maltese verbs do not mark the gender of "you" in the present or imperative, so the reader is never gendered. Singular "friend" (ħabib/ħabiba) is avoided: "kuntatt", "persuna", "xi ħadd" or the plural "ħbieb" are used. Role names avoid person nouns where possible (Qari biss, Rapport tal-bugs, Żvilupp).
- Standard Maltese spelling (għ, ħ, ġ, ċ, ż). Apostrophes are plain `'`, as in en.json.
- Plurals use Intl's categories for mt: one, two, few, many, other. Nouns after numbers follow the Maltese rule: 1 "karta", 2 "karti" (dual), 3-10 "karti", 11 and up "karta" (singular after the numeral).
- `{{dev:...}}` markers wrap the Maltese word for the same developer term (test, sprint, bug, commit), including the verb forms ("tittestja", "jiġi ttestjat").
- Loanwords kept as software teams in Malta say them: Backlog, Sprint, Stand-up, Bug, Commit, Branch, Merge, Repo, Deploy, Hook, Token, Kanban, Setup, Inbox, Lead, Scrum Master, Look, Space, Log, Server, Terminal.
- Dates and durations: min, sieg (siegħa), j (jum). Dates follow the Maltese locale.

## Glossary
| English | Maltese | Note |
|---|---|---|
| card | karta (pl. karti) | |
| board | bord | |
| project | proġett | |
| team | tim (pl. timijiet) | |
| lead | lead | kept |
| Lead Scrum Master | Lead Scrum Master | kept |
| For you | Għalik | column and tour wording |
| To do | Biex isir | |
| In progress / Doing | Għaddej | |
| Team checking | It-tim qed jivverifika | |
| For the team | Għat-tim | |
| Verify column ("For you to test") | Għalik biex tittestja | |
| Done | Lest | |
| Backlog | Backlog | kept |
| sprint | Sprint | kept |
| stand-up | Stand-up | kept |
| inbox | Inbox | kept |
| Setup | Setup | kept; "issettja" for the verb |
| Usage | Użu | |
| plan (Claude plan) | pjan | |
| test | test / tittestja | |
| test steps | passi tat-test | |
| AI tester passed / failed | għadda / falla | |
| Send back | Ibgħat lura | |
| Accept | Aċċetta | |
| Wake (team) | Qajjem | |
| Poke | Qanqal (noun: tqanqila) | |
| night watch | Għassa tal-lejl | the watchman: l-għassies |
| Going quiet | Nidħol fil-kwiet | |
| idle | mistrieħ | |
| assumption | suppożizzjoni | "Plug this" = "Għalaq dan" |
| Come back… (timed) | Erġa' ġej… | |
| No Token Mode | Modalità No Token | |
| token | token (pl. tokens) | |
| agent | aġent (pl. aġenti) | |
| helper | għajnuna (pl. għajnuniet) | |
| Permissions | Permessi | |
| Views | Veduti | |
| DM | DM | kept |
| Pop out | Ifrex | |
| Life board | Bord tal-ħajja | |
| Checklist | Checklist | kept |
| Friend / contact | kuntatt, pl. ħbieb | |

## For the reviewer
- Check that the tone is natural and not too bookish (for example "Idħol fil-kwiet", "Għalaq dan", "Ifrex" for pop out).
- "Għalik biex tittestja" (the Verify column) is long next to the other column titles. A shorter label may be better.
- Maltese number agreement after 11+ is handled in plural objects only. Strings with a bare `{n}` use a safe word order, but "{n} karti x'jsiru" and "{n} mistoqsijiet" are worth a look.
- Role names (`share.role.*`, `prof.role.*`) are noun phrases chosen to avoid gender. Confirm they read well.
- `pt.*` strings (the pretend friend's replies) are casual; check the jokes still work.
- LocoRadio's Maltese uses "Qed jitgħabba..." for loading. Followed here ("Qed jitgħabba…").
