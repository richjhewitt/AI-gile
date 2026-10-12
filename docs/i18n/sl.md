# Slovenian (sl)

First pass by Babel for AIG-493; a native-speaker review follows. LocoRadio's docs/i18n.md has no Slovenian-specific rules beyond the plural categories; its sl.json sets the tone (casual, short). Dates use sl-SI.

## Register
- Casual second person singular ("ti": "tvoj", "te", "nate"), as in LocoRadio's sl.json. Imperatives for buttons ("Shrani", "Pošlji").
- Gender: the owner, agents and friends are never gendered. No slash forms, no masculine past participles. Used instead: present tense, imperative, passive/impersonal, nouns ("Prošnja vodji", "Zbujeno: {names}", "Čaka nate"). AI speakers (watchman, Scrum Master) use first-person present or passive ("zagon je bil ustavljen").
- Friends and other people: the noun "stik" (contact) in lists and buttons ("Dodaj stik"), "oseba" in prose. Roles of a shared link (Viewer, Reporter, ...) are abstract nouns ("Ogled", "Poročanje", "Sodelovanje", "Testiranje", "Razvoj", "Upravljanje") so they carry no gender.
- Names stay in the nominative: put them after a colon or "osebe {name}" ("Odpri tablo osebe {name}", "Poslano: {name}") instead of needing a case ending.
- Dev words: loanwords in Slovenian forms where the English has `{{dev:...}}` (`{{dev:sprinti}}`, `{{dev:napako}}`, `{{dev:testa}}`, `{{dev:commiti}}`). `gloss.*.word` keeps the English term; `gloss.*.also` lists English and Slovenian search aliases.
- Plurals: one / two / few / other (Intl.PluralRules `sl`, dual included). Where a count sits inside a plain string, "label: {n}" is used ("Sporočil: {n}", "Blokirano: {n}").

## Glossary
| English | Slovenian |
|---|---|
| card | kartica |
| board | tabla |
| project | projekt |
| team | ekipa |
| lead | vodja |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Zate |
| For the team | Za ekipo |
| To do | Na vrsti (was "Za narediti", a calque) |
| In progress / Doing | V teku |
| Team checking | Ekipa preverja |
| Done | Končano |
| Backlog | Backlog |
| sprint | sprint (pl. sprinti) |
| stand-up | stand-up (pl. stand-upi) |
| inbox | nabiralnik |
| Home | Domov (Dom on the home page) |
| Setup | Nastavitve |
| Usage | Poraba |
| test (verb / noun) | testirati / test |
| test steps | koraki testa |
| bug | bug / napaka (type label: napaka) |
| hook | kljuka (git hooks) |
| Accept | Sprejmi |
| Send back | Vrni |
| Wait and see | Počakajmo |
| Not sure yet | Še ne vem |
| poke | spodbuditi (noun: spodbuda; never "sunek") |
| wake (a team) | zbuditi |
| stuck | zataknjeno |
| blocked | blokirano |
| assumption | predpostavka |
| plug (an assumption) | zakrpaj |
| night watch / watchman | nočna straža / straža |
| going quiet | odklop ("🌙 Odklop", "Odklopi se", "ko se odklopiš") |
| No Token Mode | No Token Mode (kept) |
| token | žeton |
| Verbose | podrobni način |
| Look | Videz |
| Permissions | Dovoljenja |
| Views | Pogledi |
| Docs | Dokumenti |
| agent | agent |
| friend (DM contact) | stik / oseba; names after "osebe / osebi / z osebo {name}" |
| Tour | vodeni ogled |
| Pop out | Odpri posebej; tooltips "v ločenem oknu" (never "v svojem oknu", which reads as "your window") |
| pile (of cards) | kup |
| chip | oznaka |
| focus (mode) | zbrano delo |
| AI tester / AI passed | AI-testnik / AI-test opravljen |
| Look / Setup inside a sentence | "v razdelku 🎨 Videz", "v ⚙️ Nastavitvah" |
| shared-link roles | Samo ogled, Alfa testiranje, Prijava napak, Sodelovanje, Testiranje, Razvoj, Skrbništvo |

## For the reviewer
- "spodbuditi / spodbuda" for poke: chosen over "sunek" (sounds rough). Check it feels right for a card that is stuck.
- "Utišanje / Utišaj se" for going quiet, "Pozdravljen"-style greetings avoided; "Živjo!" is used.
- Gender avoidance: a few role names and sentences are now abstract nouns ("Sodelovanje", "Razvoj"); a native speaker may prefer another wording.
- "Najin klepet" (sm.fold, "Our chat") uses the dual; check it reads right.
- "stik" for friend may feel clinical in a few buttons; "oseba" was used where a sentence needs a person.
- Pretend friend Davy keeps masculine forms ("njegovo tablo"), as in the other languages.
- `prof.level.*` and developer role names (Frontend, Backend...) stay in English.

### Answers (native review)
- "spodbuditi / spodbuda" is right for poke; "sunek" was still used in four places and is now "spodbuda" everywhere.
- "Utišanje / Utišaj se" read as "mute / silence yourself". Replaced by "Odklop / Odklopi se", which matches the "izklapljaš" in the tooltip.
- Abstract role nouns: "Ogled", "Poročanje" and "Upravljanje" read as activities, not roles. Now "Samo ogled", "Prijava napak" and "Skrbništvo"; the rest stay. Texts that mention a role now say "pri vlogi Sodelovanje".
- "Najin klepet" (dual) is correct and natural for you and the Scrum Master.
- "stik" is fine in buttons and lists. Names now follow "oseba" in the right case ("z osebo {name}", "osebi {name}") instead of "od {name}" or "k: {name}".
- Davy keeping masculine forms is fine.

## Review
Native-speaker pass for AIG-493: 222 values changed, 7 missing keys added (usage.runs.total, usage.kind.*, srv.budget.night).
- Glossary: "To do" is now "Na vrsti" everywhere (column, inbox, gloss, Scrum Master lines); "kopica" is now "kup"; "čip" is now "oznaka"; "vodenje" is now "vodeni ogled"; "zbranost" is now "zbrano delo".
- Gender leaks fixed: "si potreben", "pripravljen si", "kot nov uporabnik", "oba sta videla", "je določil / nastavil {name}", "z tabo še ni delil" are now neutral (present tense, impersonal, "obe strani").
- Case and grammar: "z tvojim" to "s tvojim", "z cdn" to "s cdn", "je vrata" to "so vrata", "varčuje žetone" to "varčuje z žetoni", "ob prvem pridružitvi" to "ob prvi", "Ne bujaj" to "Ne budi", "kako te naj" to "kako naj te", "Poišči moje" to "Poišči svoje", "pokaži mojo" to "pokaži svojo".
- Reflexive trap: "v svojem oknu" (your window) is now "v ločenem oknu" in all tooltips.
- Plurals: counts that broke for 2-4 ("Še {n} korakov", "{h} predanih", "{lines} vrstic") are now in "label: {n}" form.
- Names: "od {name}", "k: {name}" and double colons ("z: {name}:") are rewritten with "osebe / osebi / z osebo {name}".
- Calques and wording: "Za narediti", "Dovolj ostalo", "Prej (najnovejše na vrhu)", "Ustavljalci", "Začni zbranost", "Še kaj za dodati", "Kaj je videti?" (what did you see), "Vrni se ..." (the card comes back), "Odloči pozneje".
- Meaning fixes: "Bring back" no longer clashes with "Send back" (both were "Vrni"); "Next" in stand-ups is "Naslednje", not "Naprej"; "Two big gauges" was singular; leave.confirm no longer glues an imperative to a question.
- Still for a human: "Dobrodošli" in the tour and wizard titles is plural/formal against the casual "ti" register (kept as the usual neutral greeting); "Na vrsti" vs "Za izvedbo" for the To do column; "Skrbništvo" for Admin; "AI-test opravljen" as the inbox tab label (length).
