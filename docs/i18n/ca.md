# Catalan (ca) - first pass

Source of rules: LocoRadio docs/i18n.md and ca.json (casual "tu"; dates use ca-ES; plurals one / many / other). Tone: warm, plain, short. Standard Catalan (central), not Valencian or Balearic forms.

## Register
- Casual "tu", never "vostè".
- Developer words stay as loanwords where Catalan teams say them (backlog, sprint, stand-up, bug, commit, token, repo). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Catalan forms where needed (`{{dev:provar}}`, `{{dev:prova}}`, `{{dev:proves}}`, `{{dev:provis}}`).
- Short forms: "fa {n} min", "fa {n} h", "fa {n} d" (bare: m / h / d).
- Plurals: one / many / other (as Intl.PluralRules gives for ca).
- Apostrophes are straight (`l'equip`); quotes use « ».

## Glossary
| English | Catalan |
|---|---|
| card | targeta |
| board | tauler |
| project | projecte |
| team | equip |
| lead | líder |
| Lead Scrum Master | Lead Scrum Master |
| For you | Per a tu |
| For the team | Per a l'equip |
| To do | Per fer |
| In progress / Doing | En curs |
| Team checking | L'equip ho revisa |
| Done | Fet |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | safata d'entrada |
| Setup | Configuració |
| Usage | Consum |
| test (verb / noun) | provar / prova |
| test steps | passos de prova |
| bug | bug |
| Accept | Accepta |
| Send back | Torna-ho |
| Wait and see | Espera i veuràs |
| poke | toc (verb: donar un toc) |
| wake (a team) | despertar |
| assumption | suposició |
| night watch / watchman | vigilància nocturna (both; never "el vigilant", which genders it) |
| going quiet | quedar-se en silenci |
| AI tester | la IA de proves (never "el provador"); passed / failed = aprovada / suspesa |
| tester, developer, admin… (roles) | activity nouns: Proves, Desenvolupament, Administració, Només lectura, Informes, Revisió de codi, Disseny UX / UI |
| plug (an assumption) | corregir |
| dev words | termes de programació |
| No Token Mode | No Token Mode (feature name kept) |
| token | token |
| Verbose | Detallat |
| Look (project colour/emoji) | Aspecte |
| Permissions | Permisos |
| Views | Vistes |
| Docs | Documents |
| Agent | agent |
| Pop out | Finestra pròpia |
| Space (🪐) | Ubicació; "a dins" for projects inside |
| Life board | Tauler de vida |
| friend / friends | amistat / amistats; "la persona que convides", "l'altra persona", "l'altra banda" (never amic/amics, ell/ells) |
| pretend friend | amistat de prova (tag: de prova; pretend team / AI: equip de prova, IA de prova) |
| GO (answer button) | Endavant (the literal word GO stays in sentences that quote the reply) |

## For the reviewer
- "tauler" for board (some teams say "board"): check.
- "Per fer" / "En curs" / "Fet" for the columns, and "Per a tu" for For you.
- "Torna-ho" for Send back; the imperative reads shorter than "Retorna" but check the tone next to "Accepta".
- "Endavant" for the Go button (`dms.go`, `act.go`).
- "toc" for poke, and the playful `sm.push.*` / `scale.*` lines (🍽️ "Mantén els plats girant", 🏇 "Fuet en mà").
- Verb/noun agreement in `{{dev:provar}}` phrases such as `col.verify` ("Tu has de provar"), `verdict.waiting` ("que ho provis") and `card.howtotest` ("Com provar-ho").
- Possessive/genitive with names (`{name}` stays in its basic form; check "de {name}" before vowels, e.g. "d'en" cases like `pf.garden`).
- `gloss.test.word` is "Prova" with `also` forms for provar/provis/test.

## Answers (review)
- "tauler" for board: kept. It is what Catalan software (Trello, Jira localisations) uses; "board" would look like a gap.
- "Per fer" / "En curs" / "Fet" and "Per a tu": kept, all standard.
- "Torna-ho" for Send back: kept; it pairs well with "Accepta". The spoken echo `act.sendback.say` is now "Ho torno: " (first person, no gender).
- "Endavant" for Go: kept.
- "toc" for poke: kept ("donar un toc" is the natural idiom). "Mantén els plats girant" and "Fuet en mà" read as intended jokes.
- `col.verify` "Tu has de provar" was heavy: now "Et toca {{dev:provar}}". `verdict.waiting` now "Construït i a l'espera que ho {{dev:provis}}"; `card.howtotest` / `inbox.t.how` now "Com s'ha de {{dev:provar}}" (no hyphen glued to the marker).
- Names: no personal article ("en Davy" → "Davy"), since "en/na" genders the person. `{name}` stays in its basic form after "de".

## Review
- Added the 3 missing keys (`boot.retry`, `boot.broke`, `boot.reload`).
- Gender, reader: removed "tot sol / tu mateix / Soc nou / estàs segur / ocupat / usuari nou" (`usage.check.auto`, `quiet.until.help`, `pretend.auto`, `scale.tidy.help`, `trust.help`, `tour.lvl.new`, `wz.2.agent.help`, `wz.4.sub`, `fx.sum.h`, `trial.h`, `help.m.demo`, `scale.words.1`). "Et donem la benvinguda" was already neutral.
- Gender, agents: no "el vigilant", "el provador d'IA", "Callat", "ell mateix", "Afegeix-lo", "Decideix sol", "un segon líder" (now "dos líders"), "està bloquejat"; agent and friend roles are activity nouns (`share.role.*`, `prof.role.*`).
- Gender, friends: "amic/amics/amic fingit/ells/tots dos/l'un a l'altre" replaced across `inbox.*`, `dms.*`, `dmf.*`, `join.*`, `share.*`, `pretend.*`, `ask.*`, `life.family`, `nt.title.off`, `budget.help`.
- Calques: "Esperant-te a tu" → "T'esperen", "1 pregunta esperant" → "1 pregunta t'espera", "Mostrant" → "Es mostren", "fora del teu camí" → "no et molesta", "n'inicia" → "inicia'n", "abans d'començar" → "abans de començar", "desperts" → "despertars", "unes 150 tokens" → "uns 150", "Darrer" → "Més recent", "polit" → "retocs", "servei d'unió" → "servei d'invitacions", "Ja sóc" → "Ja soc" (2017 norm).
- Meaning: `runin.blind` had a stray "en"; `tour.chat.text` verb agreed with "the lead" (singular); `usage.headline.html`, `queue.bump*`, `quiet.done.*`, `watch.line` rewritten so they read as Catalan.
- Still worth a human look: articles before epicene nouns ("el líder", "els agents") stay masculine by grammar; "amistat" for a single friend is correct (DIEC) but some readers may prefer "persona amiga"; "prof.level.mid" "mitjà" is masculine when shown after a role; "Lead Scrum Master" is now written without an article.
