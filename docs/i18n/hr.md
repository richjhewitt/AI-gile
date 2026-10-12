# Croatian (hr) first pass

Card AIG-489. File: `public/lang/hr.json` (1846 keys after review). Needs a native check.

## Register
- Casual "ti" (as in LocoRadio), Latin script, standard Croatian (ijekavian), not Serbian or Bosnian forms. Dates use `hr-HR`.
- Gender (settled in review): **no slashes, no gendered forms for the reader, the agents or a friend.** Every first- and second-person message is phrased gender-free: present tense ("Tu sam opet", "Pokreće se…", "Ne mogu se pokrenuti"), passive or impersonal ("pa je zaustavljeno", "Odabrana je sva pomoć"), a noun ("tvoja prijava", "tvoj odgovor: ne sada") or a question ("Ne znaš još?"). A friend's `{name}` gets the feminine noun "osoba" so the verb agrees with that noun ("Osoba {name} prekinula je vezu"). Grammatical masculine stays only where it agrees with a masculine noun (tim, voditelj, AI, projekt) and for Davy, the pretend friend, who is "he" in English.
- Names are put where no case ending is needed. Where a sentence needs a case with `{name}` (e.g. "osobe {name}") the name is left in its basic form after a case-carrying noun. Check these.
- Plurals: neutral forms ("{n} kartica", "{n} min"); Croatian has one/few/other, the plain strings use the genitive plural after numbers.

## Glossary
| English | Croatian | Note |
|---|---|---|
| card | kartica | |
| board | ploča | |
| project | projekt | |
| team | tim | |
| lead | voditelj | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Za tebe | |
| To do | Na redu | review: "Za napraviti" is a calque |
| In progress / Doing | U tijeku | |
| Team checking | Tim provjerava | |
| For the team | Za tim | |
| Verify | Za tvoje testiranje | wrapped in `{{dev:...}}` |
| Done | Gotovo | |
| backlog | Backlog | loanword |
| sprint | sprint | plural "sprintovi" |
| stand-up | stand-up | plural "stand-upovi" |
| inbox | Pristigla pošta | |
| Setup | Postavke | |
| test steps | koraci testiranja | |
| bug | bug | plural "bugovi" |
| commit / push / merge / repo | kept in English | |
| branch | branch | glossary also lists "grana" |
| assumption | pretpostavka | |
| night watch | noćna straža | "Night watchman" = noćni čuvar |
| No Token Mode | Način bez tokena | |
| token | token | |
| Usage | Potrošnja | |
| poke | pogurati / pogurni | nudge (noun) = poticaj |
| going quiet | povlačim se | |
| DM | izravna poruka | |
| friend | prijatelj | |
| permissions | dopuštenja | |
| view | prikaz | review: was "pogled" |
| column | stupac | |
| group | grupa | |
| attachment | privitak (privici) | |
| archive | arhiviraj | |
| tour | obilazak | |
| wizard | čarobnjak | |
| focus | fokus | |
| checklist | popis za provjeru | |
| hook | hook (hookovi) | review: "kuka" is a meat hook to Croatian developers |
| build (a feature) | izrada | review: was "izgradnja" |
| pretend friend | izmišljeni prijatelj | review: "lažni prijatelj" means a false friend |
| Life board | ploča svakodnevice | real life = svakodnevica |
| Steady (push level 3) | Umjereno | |
| AI passed | AI odobrio | the tester approved; not "AI prošao" |

## For the reviewer
- `{{dev:...}}` markers wrap the Croatian word (testiraš, sprintovi, bug...). Check the future "English in brackets" feature will not double words that are already English.
- `gloss.*.also` lists contain inflected Croatian forms plus English; verify they are sensible match words.
- Gendered forms with "/la" and "/na" appear in several messages (night.back, wz.*, ask.*, pretend.*). Decide on a convention.
- "pogurnuti" for Poke and "Za napraviti" for To do may feel stiff; alternatives: "Potakni", "Na redu". (Review: To do is now "Na redu".)
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).

## Answers to the questions above
- `{{dev:...}}` on Croatian words: fine. Words that already are English (Backlog, bug, commit) should be skipped by any "English in brackets" feature; that is a code check.
- `gloss.*.also`: sensible; the hook entry is now "hookovi, hooka, hookove".
- Gender: settled, see Register. All "/la", "/na", "/a" forms are gone (night.back, wz.*, ask.*, share.*, sb.*, verdict.*, dlg.*).
- Poke stays "pogurati / pogurni" (natural); To do is now "Na redu".

## Review
Native-speaker pass over all 1846 values (AIG-489). 244 values changed, 79 added.
- Added the 79 keys that were missing (demo projects, pretend team, server-written notes `srv.*`), so the file now matches `en.json` key for key.
- Gender convention applied everywhere (about 45 strings), including the new `srv.*` notes the Scrum Master writes in first person.
- Terms: Za napraviti → Na redu; pogled → prikaz; kuke → hookovi; lažni → izmišljeni prijatelj; izgradnja → izrada; "Za tebe da testiraš" → "Za tvoje testiranje"; "AI prošao" → "AI odobrio".
- Fixed grammar: "Dati svih {n} projekata" (dative), "povremeni dobacivanje" (agreement), "od prošli put", "Sesija ... ploča u VS Codeu" (panel, not board), "Pristigla pošta ... čeka tebe" → "te čeka".
- Fixed meaning: `lead.smRole.help` (teams that have To do cards, not "with cards"), `look.intro` tabs (jezičci, not kartice), status lines "Pokrećem…" → "Pokreće se…".
- Counts that broke for 2-4 ("2 kartica", "3 timova") rephrased as "Kartica: {n}" where the string is short.
- Calques smoothed: "izvan tvog puta" → "ne smeta", "Pričekaj i vidi" → "Pričekaj malo", "Dobro došao/la" → "Pozdrav" / "Dobrodošlica".

Still worth a human look:
- Some longer count strings still use the genitive plural ("{n} starih sesija", "{n} {{dev:commitova}}"), which is wrong for 2-4. Real plural support in the code (one/few/other) would fix it properly.
- "Na redu" as the To do column name: good on the board, check it still reads well inside sentences.
- `sm.push.5` "Pucaj bičem" and `quiet.done.h` "Slatki snovi" are playful; fine to a native ear, but a matter of taste.
- "osoba {name}" is grammatical but a bit formal; with a short first name it reads well, with long names less so.
