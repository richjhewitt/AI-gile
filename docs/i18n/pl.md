# Polish (pl) - first pass

Written by Babel for AIG-491, to be checked by a native-speaker reviewer. LocoRadio's docs/i18n.md has no Polish-specific rules; its pl.json sets the tone (warm, plain, short). Dates use pl-PL.

## Register
- Casual second person singular ("ty": "Twoje", "Ci", "Ciebie" capitalised, as in LocoRadio's pl.json and common Polish app style). Imperatives for buttons ("Zapisz", "Odeślij").
- Gender: the owner is addressed in the masculine past where a past form is unavoidable ("Wybrałeś", "Zaakceptowałeś", "Co zobaczyłeś?"). The reviewer should decide whether to keep that or reword neutrally.
- Third-person friend/sharer texts use "(a)" forms ("zakończył(a)") because the friend's gender is unknown. The pretend friend (Davy) stays "he".
- Developer words stay English loanwords in Polish declension where the English has `{{dev:...}}` (`{{dev:sprinty}}`, `{{dev:bug}}`, `{{dev:buga}}`, `{{dev:testu}}`, `{{dev:commity}}`). `gloss.*.word` keeps the English term; `gloss.*.also` lists English and Polish search aliases.
- Plurals: one / few / many / other (Intl.PluralRules `pl`). `other` is the fractional form (genitive singular).

## Glossary
| English | Polish |
|---|---|
| card | karta |
| board | tablica |
| project | projekt |
| team | zespół |
| lead | lider |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Dla Ciebie |
| For the team | Dla zespołu |
| To do | Do zrobienia |
| In progress / Doing | W toku |
| Team checking | Zespół sprawdza |
| Done | Gotowe |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up (pl. stand-upy) |
| inbox | skrzynka |
| Home | Start |
| Setup | Ustawienia |
| Usage | Zużycie |
| test (verb / noun) | testować / test |
| test steps | kroki testu |
| bug | bug |
| Accept | Zaakceptuj |
| Send back | Odeślij |
| Wait and see | Poczekajmy |
| poke | szturchnięcie (verb: szturchnąć) |
| wake (a team) | obudzić |
| assumption | założenie |
| night watch / watchman | nocna straż / nocny strażnik |
| going quiet | cichnąć (button: 🌙 Cichnij) |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | token |
| Verbose | tryb szczegółowy |
| Look (project colour/emoji) | Wygląd |
| Permissions | Uprawnienia |
| Views | Widoki |
| Docs | Dokumenty |
| Agent | agent |
| helper | pomocnik |
| Pop out | Osobne okno |
| Stand-up report | Raport ze stand-upu |
| Life board | Tablica życia |
| pretend friend | udawany znajomy |
| a friend (3rd person) | znajomy / znajomy(a), "(a)" forms |
| reply / Messages | odpowiedź / Wiadomości |

## For the reviewer
- "Wake / poke" metaphors (obudzić, szturchnąć) are fairly literal; check they feel natural. "Cichnąć" for going quiet may want a better verb.
- Masculine-addressed past forms (see Register).
- "Lead" is translated "lider"; "Lead Scrum Master" is kept in English as in the source.
- Plural `other` forms (fractions) are rarely shown; check "uporządkowanie Twojego stosu" and the `quiet.done.*`, `join.exp.days`, `dlg.find.*` forms.
- "Tablica" for board (rather than the loanword "board"); change if Polish teams in your experience say "board".
- `prof.level.*` and `prof.role.*` are left English where Polish developers use the English term.
- `wz.adv.val.lead` joins other values with commas; word order is untouched.
