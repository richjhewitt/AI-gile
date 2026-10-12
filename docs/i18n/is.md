# Icelandic (is) - first pass, native-speaker review done

Source of rules: LocoRadio docs/i18n.md and is.json (casual "þú", never "þér"; dates use is-IS; plurals one / other as Intl.PluralRules gives for is: "one" covers 1, 21, 31 ... but not 11). Tone: warm, plain, short. Written by a model, then reviewed by a second model working as a native-speaker reviewer (AIG-494); a human native check is still welcome.

## Register
- Casual "þú". Quotes use „ “.
- Never gendered about the reader: no "tilbúinn/tilbúin", "kominn/komin" or "sjálf/ur" forms. Neuter, passive, "vera við" or a noun is used instead ("Ég er aftur við", "Gaman að sjá þig!", "Lokið"). Words that are grammatically masculine (teymisstjóri, fulltrúi, vinur, vörður) take "hann" as usual.
- Developer words stay as loanwords where Icelandic teams say them (backlog, sprint, commit, push, branch, merge, repo, prod). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Icelandic forms (`{{dev:prófa}}`, `{{dev:prófir}}`, `{{dev:prófunar}}`, `{{dev:villa}}`, `{{dev:villu}}`, `{{dev:sprintar}}`). The glossary `*.also` lists match these forms and the inflected forms used in plain text (the tooltips match whole words only).
- Short forms: "fyrir 5 mín.", "fyrir 2 klst.", "fyrir 3 d." (bare: mín. / klst. / d.).
- Plurals: one / other.
- "by hand" is "handvirkt", not "í höndunum".

## Glossary
| English | Icelandic |
|---|---|
| card | spjald |
| board | borð |
| project | verkefni |
| team | teymi |
| lead | teymisstjóri |
| Lead Scrum Master | Lead Scrum Master (kept; sentences about it stay passive) |
| For you | Fyrir þig |
| For the team | Fyrir teymið |
| To do | Á dagskrá |
| In progress / Doing | Í vinnslu |
| Team checking | Teymið yfirfer |
| Done | Lokið |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stöðufundur |
| inbox | innhólf |
| Setup | Uppsetning |
| Usage | Notkun |
| test (verb / noun) | prófa / prófun; AI tester: gervigreindarprófari; tester role: prófari |
| test steps | prófunarskref |
| passed (a test) | stóðst / staðið próf |
| bug | villa |
| Accept | Samþykkja |
| Send back | Senda til baka |
| Wait and see | Bíða og sjá |
| poke / nudge | ýta við (a friendly nudge from a chatty lead: hnipp) |
| wake (a team) | vekja |
| blocked (a person or team) | stopp (cards: fast / föst) |
| assumption | forsenda |
| night watch | næturvakt (the watchman: næturvörður / vörðurinn) |
| going quiet | button: "Fara í hlé"; in sentences: verða ekki við |
| No Token Mode | No Token Mode (feature name kept; "er í gangi" when on) |
| token | tákn (budget: táknakvóti) |
| icon | táknmynd (never "tákn", which is token) |
| usage window (5 h / 7 d) | tímabil |
| Verbose | Ítarlegt |
| Look (project colour/emoji) | Útlit |
| Permissions | Heimildir |
| Views | Sýnir |
| Docs | Skjöl |
| Agent | fulltrúi (AI agent: gervigreindarfulltrúi; agent program: fulltrúaforrit) |
| Pop out | Sérgluggi |
| Space (🪐) | Rými |
| Life board | Lífsborð (real life: daglegt líf) |
| pretend friend | þykjustuvinur |
| block (a friend) | loka á / opna fyrir |
| GO (answer button) | Áfram (the literal word GO stays in sentences that quote the reply) |
| Got it | Skilið |

## For the reviewer (first-pass questions, answered)
- "Á dagskrá" for To do and "Teymið yfirfer" for Team checking: both read naturally as column names. Kept.
- "teymisstjóri" for lead: kept. "umboðsmaður" for agent: changed to "fulltrúi". "Umboðsmaður" reads as an ombudsman or a sales agent; "gervigreindarfulltrúi" is the word Icelandic media use for AI agents. "tákn" for token: kept. It is the usual Icelandic word in language technology, and the glossary tooltip explains it. "bögg" for bug: changed to "villa". "Bögg" is slang for a nuisance, and its plural "bögglar" means parcels.
- Going quiet: "Verða ekki við" is natural in sentences and stays there. The bare button "Ekki við" was not natural, so the buttons now say "🌙 Fara í hlé" and the heading says "🌙 Fer í hlé". "Næturvakt" and "næturvörður" are right.
- Plurals: "{count} spjald / spjöld" and "eftir {count} dag / daga" are correct for one / other, including 21, 31. Number + noun case was checked: "Ýta þarf við {n} teymum", "{count} teymi látin vita", "{count} sofandi teymi vakin".
- Lead Scrum Master lines: passive voice is fine and reads naturally. Kept.
- Loanwords in compounds ("sprint-dálkar", "README-skrár", "AIGILE-pakki", "Backlog-spjald") are the normal Icelandic way to write them. Kept.

## Review (AIG-494)
What changed (251 values, including the 7 keys that were missing):
- Added the 7 missing keys: usage.runs.total, the usage.kind.* labels and srv.budget.night.
- Terms: agent is now "fulltrúi" everywhere (23 values, plus gloss.agent.*); bug is now "villa" (plus gloss.bug.*, {{dev:villa}} / {{dev:villu}}); inbox is now "innhólf", the usual Windows and Outlook word, instead of "pósthólf"; usage windows are now "tímabil" instead of "gluggi"; icons are now "táknmynd" so they don't clash with tokens; and the going-quiet buttons are now "Fara í hlé".
- Grammar: "1 teymi þarf ýtt" → "Ýta þarf við 1 teymi"; nominative fixes ("Skipanalínugluggi", "Restin af borðinu"); "Síðustu breytingunni þinni var haldið eftir"; "Þú sleist"; "Smíði dagsins"; "ræstist ekki" instead of "ræsti ekki"; "Svona ratar þú um það"; and "Engin mánaðarmörk".
- Meaning: "AI passed" no longer says the AI itself passed ("Stóðst hjá gervigreind"); "📋 Tasks" was "Verkefni" (= projects), now "Verk"; "Hver ert þú og hvaða gervigreindarfulltrúi?"; "{who} er stopp" for a blocked person (no neuter "fast" on a person); and a priority filled into a sentence no longer needs a case ending.
- Calques and register: "Halda diskunum snúandi" → "Halda öllu gangandi"; "Áhugasamt" → "Af kappi"; "í höndunum" → "handvirkt"; "stoppar" → "stöðvast"; "Ég er aftur við" for "I'm back"; "Geng í það!" for "On it!"; "Skilið" for "Got it"; and "Loka á / Opna fyrir" for block / unblock.
- Gender: removed a "sjálf" that had slipped in. Lines about a pretend friend use "hann", as English does.

Still worth a human look:
- "villa" as the tooltip word for bug also marks the plain word "villur" (errors), for example in "engar villur". If that is distracting, drop "villur" from gloss.bug.also.
- "tákn" for token versus "tóki": both are in use.
- "Velkomið í AI-gile" (neutral, sign style) versus "Velkomin".
- "Fara í hlé" for Going quiet, and "Fjarvera" if a noun is ever needed.
- "Spjallglaður / Spjallglatt" for chatty, and "Svipan á loft" for Crack the whip.
