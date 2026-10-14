# Polish (pl)

Written by Babel for AIG-491, then reviewed by a native-speaker pass (see Review). LocoRadio's docs/i18n.md has no Polish-specific rules; its pl.json sets the tone (warm, plain, short). Dates use pl-PL.

## Register
- Casual second person singular ("ty": "Twoje", "Ci", "Ciebie" capitalised, as in LocoRadio's pl.json and common Polish app style). Imperatives for buttons ("Zapisz", "Odeślij").
- Gender: the owner is never addressed in a gendered form. Use present tense, imperative, passive/impersonal or a noun instead ("Wybrana jest cała pomoc", "Co widać?", "Zakończono połączenie", "Twoja odpowiedź: nie teraz"). The same goes for AI speakers (watchman, pretend team): "zostało zatrzymane", not "zatrzymałem".
- Friends and other third persons (gender unknown): no "(a)" forms; use present tense ("{name} odsyła", "{name} akceptuje test"), "Połączenie zakończone przez: {name}" or "{name}: nie teraz". The pretend friend (Davy) stays "he".
- Names inside a sentence stay in the nominative: put them after a colon or in brackets ("Wysłano do: {name}", "Wysłano ({name})") rather than where Polish needs a case ending.
- Developer words stay English loanwords in Polish declension where the English has `{{dev:...}}` (`{{dev:sprinty}}`, `{{dev:bug}}`, `{{dev:buga}}`, `{{dev:testu}}`, `{{dev:commity}}`). `gloss.*.word` keeps the English term; `gloss.*.also` lists English and Polish search aliases.
- Counts: where a number would need a plural form inside a plain string, use "label: {n}" ("Zablokowane: {n}", "Pytania: {n}").
- Plurals: one / few / many / other (Intl.PluralRules `pl`). `other` is the fractional form (genitive singular).
- UI names inside a sentence: "w sekcji 🎨 Wygląd", "w kolumnie Dla Ciebie", so the name stays in the nominative.

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
| test (verb / noun) | testować, przetestować / test |
| test steps | kroki testu |
| bug | bug |
| hook | hook (pl. hooki) |
| Accept | Zaakceptuj |
| Send back | Odeślij |
| Wait and see | Poczekajmy |
| Not sure yet | Nie wiesz jeszcze? |
| poke | szturchnięcie (verb: szturchnąć) |
| wake (a team) | obudzić |
| stuck | utknął / zawieszone |
| blocked | zablokowane, blokada |
| assumption | założenie |
| plug (an assumption) | popraw |
| night watch / watchman | nocna straż / nocny strażnik |
| going quiet | przerwa (button: 🌙 Robię przerwę / 🌙 Zrób przerwę) |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | token |
| Verbose | tryb szczegółowy |
| Look (project colour/emoji) | Wygląd |
| Permissions | Uprawnienia |
| Views | Widoki |
| Docs | Dokumenty |
| Agent | agent |
| helper | pomocnik |
| build (verb) | budować / zbudować |
| Pop out | Osobne okno |
| Stand-up report | Raport ze stand-upu |
| Tour | przewodnik |
| Life board | Tablica życia |
| pretend friend | udawany znajomy |
| a friend (3rd person) | znajomy; the other side: "druga strona" |
| link offer | propozycja połączenia |
| reply / Messages | odpowiedź / Wiadomości |

## Questions from the first pass, answered
- **Wake / poke (obudzić, szturchnąć):** natural enough and playful; kept. "Cichnąć" was not: going quiet is now "przerwa" ("🌙 Robię przerwę", "gdy robisz przerwę").
- **Masculine past forms:** removed everywhere (see Register). No "(a)" forms either.
- **"Lead" = "lider", "Lead Scrum Master" kept in English:** fine; Polish teams say it that way.
- **Plural `other` forms:** checked; `other` is the fractional genitive singular and reads right ("2,5 zespołu").
- **"Tablica" for board:** kept. It is what Trello and Jira say in Polish.
- **`prof.level.*` / `prof.role.*` in English:** fine for junior/mid/senior/principal, Frontend, Backend, Full-stack, Mobile.
- **`wz.adv.val.lead`:** a comma list of short choices; works as is.

## Review
Native-speaker pass for AIG-491: every value read next to English; 253 values changed (250 edits, 3 new `boot.*` keys).
- Removed every gendered address to the owner ("Wybrałeś", "Co zobaczyłeś?", "chciałeś", "jakbym był nowy", "dostałeś", "przeczytaliśmy") and the masculine AI narrator ("zatrzymałem", "przestałem", "wciągnąłem").
- Replaced all "(a)" third-person forms with present tense or impersonal phrasing.
- Going quiet: "cichnąć" replaced by "przerwa" in every string; Tour: "wycieczka" replaced by "przewodnik".
- Number agreement: strings like "{n} zablokowanych", "{n} razy" (n = 1) rewritten as "label: {n}".
- Calques smoothed: "Niech talerze się kręcą" → "Byle się kręciło", "Szefuje" → "Nadzoruje", "Chętnie" → "Z zapałem", "co Cię potrzebuje", "Żadne słowo tego nie pasuje", "Daj każdemu projektowi te kolumny", "Pytać przed każdą budową".
- Terms made consistent: "hooki" (not "haki"), "propozycja" (not "oferta") for link offers, "Czeka na Ciebie" (not "Potrzebuje Ciebie"), "w sekcji 🎨 Wygląd".
- Fixed meaning slips: "Ktokolwiek" → "Wszyscy" (filter), "Brak osoby" → "Nieprzypisane", "W tej chwili" → "W chwili wydarzenia" (reminder at event time).

Still for a human native speaker to look at:
- "szturchnąć" for poke and "zawieszone" for stuck cards: fine to me, but a Polish user may prefer "przypomnieć" / "utknęło".
- "Nocny podgląd" for Night glance, "Byle się kręciło" and "Trzymaj krótko" for the push levels: playful choices worth a second opinion.
- Present-tense friend notices ("{name} odsyła:", "{name} akceptuje test") read naturally in a feed, but check they don't feel odd for old events.
