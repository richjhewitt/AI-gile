# Bosnian (bs, Latin script) first pass

Card AIG-494. File: `public/lang/bs.json` (1939 keys, same key set and order as `en.json`). Native-speaker review done: see Review below.

## Register
- Casual "ti" (as in LocoRadio), Latin script, standard Bosnian (ijekavian). Bosnian vocabulary where it differs from Croatian and Serbian: sedmica (week), sanduče, računar, historija, obavijest, tačno, šta. Dates use `bs-BA`.
- Gender: no slashes and no gendered forms for the reader, the agents or a friend. Phrased with present tense, passive, nouns or questions ("Opet sam tu", "od tebe", "Pokreće se…"). A friend's `{name}` stays in the nominative at the start or after a colon, with present tense or a passive ("{name} kaže: ne sada", "Poslano za {name}", "{name}: veza je prekinuta s druge strane"); "osoba {name}" is no longer used. The Lead Scrum Master's own notes use the present ("pa ga zaustavljam") rather than a gendered past.
- Plurals: Bosnian has `one`, `few` and `other` in `Intl.PluralRules`; the `{one, few, other}` objects use all three. Plain strings that hold a count were rephrased as "Poruka: {n}" where the number could be 2 to 4.
- `{{dev:...}}` markers wrap the Bosnian dev word (testiranje, sprint, bug, commit).

## Glossary
| English | Bosnian | Note |
|---|---|---|
| card | kartica | |
| board | ploča | |
| project | projekat | gen. projekta |
| team | tim | |
| lead | voditelj | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Za tebe | |
| To do | Za uraditi | |
| In progress / Doing | U toku | |
| Team checking | Tim provjerava | |
| For the team | Za tim | |
| Verify | Za tvoje {{dev:testiranje}} | |
| Done | Gotovo | |
| backlog | Backlog | loanword |
| sprint | sprint | plural sprintovi |
| stand-up | stand-up | plural stand-upovi |
| inbox | Sanduče | |
| Setup | Postavke | |
| Usage | Potrošnja | |
| test steps | koraci testiranja | |
| bug | bug | plural bugovi |
| commit / push / merge / deploy / repo | kept in English | |
| branch | branch | plural branchevi |
| token | token | |
| assumption | pretpostavka | |
| night watch | noćna straža | night watchman = noćni čuvar |
| No Token Mode | Način bez tokena | |
| poke | pogurni / pogurati | a friendly nudge = poticaj |
| going quiet | povlačim se | |
| DM | direktna poruka | |
| friend | prijatelj | |
| permissions | dozvole | |
| view | prikaz | |
| column | kolona | |
| attachment | prilog | |
| archive | arhiviraj | |
| tour | obilazak | a stop = stanica |
| wizard | čarobnjak | |
| focus | fokus | |
| checklist | kontrolna lista | |
| pretend friend | izmišljeni prijatelj | |
| Life board | ploča za život | |
| Steady (push level 3) | Ravnomjerno | |
| AI passed | AI odobrio | chips stay Prošlo / Palo |
| Go (button, plan reply) | Može | go-ahead; in a plan "MOŽE?" |
| waiting on you / needs you | te čeka / treba te | |
| alerts | obavijesti | not upozorenja (warnings) |
| keys (keyboard) | tasteri | |
| browser tab | tab | kartica is a card |
| Pro-friendly | Pogodno za Pro | |

## For the reviewer
- "Za uraditi" for To do is a choice; "Na čekanju" or "Za rad" are alternatives.
- "projekt" (as in nl and hr files) versus "projekat": check which is natural in Bosnia.
- "Pogurni" for Poke can feel stiff; "Podsjeti" is an alternative.
- Some gender-neutral rewrites ("od tebe", "osoba {name}") sound a bit formal.
- Counts shown by `{n}` in plain strings are not inflected; real plural objects use one/few/other.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).

### Answers (native review)
- "Za uraditi": kept. It is what people say in BiH offices; "Na čekanju" means on hold and "Za rad" is vague. Sentences that used it as a noun phrase were reworded ("timove koji imaju kartice Za uraditi").
- "projekt" vs "projekat": both are standard, but "projekat" is the usual form in Bosnia, so every nominative/accusative now says "projekat".
- "Pogurni": kept for the 👉 Poke button and "treba pogurati", which read naturally for a stuck team. The noun "guranje" (shoving) is gone: a light nudge is now "poticaj". "Podsjeti" would clash with reminders.
- "osoba {name}": removed everywhere (see Register). "od tebe" passives were replaced with "tvoja kartica", "svoje prijave", "Šta vidiš?" and similar.
- Counts in plain strings: the "Label: {n}" pattern is kept; a few more were converted ("Poslano timovima: {n}", "kartica: {n}").

## Review
Native-speaker pass over all 1,939 values (card AIG-494). 293 values changed (286 rewritten, 7 added), 48 of them only for projekt → projekat.
- Added the 7 missing keys (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- Go button reads as go-ahead: "Može" on `dms.go`, `act.go`, in the tour and `scale.go.2`; the plan ends "MOŽE?" (was "Kreni", which reads as "set off").
- Glossary: tour = obilazak / stanica (was tura / zaustavljanje), AI passed = AI odobrio, alerts = obavijesti, keys = tasteri (was the Croatian tipke), bar chart = stubići (was the Croatian stupci), Life board = ploča za život, Pro-friendly = Pogodno za Pro.
- Gender: masculine slips for the reader removed ("sam se vraćaš", "da sam vježbaš"); the Scrum Master's notes now use the present ("pa ga zaustavljam", "pa čekam sutra") instead of stiff passives.
- "čeka tebe / čekaju tebe / traže tebe" → "te čeka", "Na tebi je", "Trebaš im".
- Wrong case or meaning fixed: "Dati ove kolone svih {n} projekata", "Pada" → Ponestaje, "Skoro gotovo" → Skoro potrošeno, "Kartica preglednika" → Tab u pregledniku, "Dobrodošlica" → Dobro došli, "Dodijeliti kome?" → Kome dodijeliti?, `leave.confirm` now uses infinitives ("Ipak ažurirati i izgubiti ga?").
- `card.looksright.*` now says "molim te" (casual).

Still worth a human look:
- "Dobro došli" (`tour.welcome.title`, `wz.ask.h`) is the plural/polite form on purpose: it is the fixed greeting, and "Dobrodošao/la" would be gendered.
- Names after prepositions stay undeclined ("sa {name}", "za {name}"), which is normal in apps but not textbook.
- `role.*` / `share.role.help.*` use "njegov / s njim" for the role noun (Član, Prijavitelj): grammatical, maybe stiff. "Prijavitelj" vs "Prijavilac" is a matter of taste.
- `pretend.*` keeps masculine forms on purpose: the pretend friend is Davy (English says "him").
