# Basque (eu) - first pass, native-speaker reviewed

Source of rules: LocoRadio docs/i18n.md and eu.json (standard Batua; plurals one / other; dates use eu-ES). Tone: warm, plain, short.

## Register
- "Zu" (the standard software register in Basque), never the marginal "hi". Possessive "zure". Imperatives: "Gehitu", "Ireki".
- Developer words stay as loanwords the way Basque software teams say them (backlog, sprint, stand-up, bug, commit, push, branch, merge, token, hook). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Basque forms where needed (`{{dev:probatzeko}}`, `{{dev:proba}}`, `{{dev:probaren}}`, `{{dev:probatu}}`).
- Loanwords take a hyphen before Basque suffixes (stand-up-ak, commit-ak, token-ak).
- Plurals: one / other (Intl.PluralRules gives these two for eu); both forms are written as "{count} X" because Basque does not inflect the noun after a number.
- No gendered forms: Basque has no grammatical gender, so nothing to avoid. "Laguna" for friend.
- Short forms: "duela {n} min / h / egun"; bare "{n} min / h / egun".

## Glossary
| English | Basque |
|---|---|
| card | txartela |
| board | taula |
| project | proiektua |
| team | taldea |
| lead | taldeburua |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Zuretzat |
| For the team | Taldearentzat |
| For you to test (Verify) | Zuk {{dev:probatzeko}} |
| To do | Egiteko |
| In progress / Doing | Egiten |
| Team checking | Taldeak aztertzen |
| Done | Eginda |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | sarrera-ontzia |
| Setup | Konfigurazioa |
| Usage | Erabilera |
| test (verb / noun) | probatu / proba |
| test steps | proba-urratsak |
| bug | bug |
| Accept | Onartu |
| Send back | Bidali atzera |
| Wait and see | Itxaron eta ikusi |
| poke | bultzada (verb: bultzatu) |
| wake (a team) | esnatu |
| assumption | suposizioa |
| night watch | gaueko zaintza (watchman: zaintzailea) |
| going quiet | isilik egon |
| No Token Mode | No Token Mode (feature name kept) |
| token | token |
| Verbose | Verbose (kept, as in the English setting name) |
| Look (project colour/emoji) | Itxura |
| Permissions | Baimenak |
| Views | Ikuspegiak |
| Docs | Dokumentuak |
| Agent | agentea |
| Pop out | Atera leiho batera |
| Space (🪐) | Espazioa |
| Life board | Bizitzako taula |
| friend | laguna |
| pretend friend | lagun simulatua |
| GO (answer button) | Go (kept; GO in quoted replies) |
| Team news | Taldearen berriak |
| AI tester | AI probatzailea (passed / failed = gaindituta / huts egin du) |
| group (of cards) | multzoa (never "taldea", which is the team) |
| night watchman | gaueko zaintzailea (the feature: gaueko zaintza) |
| urgent (priority) | premiazkoa |
| wizard | morroia (verb: abiarazi morroia) |
| Focus (session) | arreta-saioa |
| port | ataka |
| {name} of a friend | "{name} laguna" + the case ending on "laguna": {name} lagunak / lagunari / lagunaren / lagunarekin / lagunarengandik |
| {name} of a project | "{name} proiektua" + the case ending, or a colon label |

## For the reviewer (answered in the review)
- Names with case endings: answered. No more "(r)i / (e)k / (r)en" brackets. A friend's name is followed by "laguna", which takes the case ending ("{name} lagunari", "{name} lagunaren taula"); a project name by "proiektua"; everything else uses a colon label ("Konektatuta: {path}", "itzulera: {time}", "Honi erantzuten: {link} {title}") so the filled-in text never needs a suffix.
- "taldeburua" for lead: kept. It reads naturally and sits fine next to "Lead Scrum Master", which stays as a role name.
- "Egiteko / Egiten / Eginda" and "Zuretzat": kept; these are the usual Basque kanban labels. When a column is named in running text it is now "Egiteko zutabera", "Eginda zutabera", never "Egiteko-ra / eginda-ra".
- Time phrases: kept the colon style ("hasiera: {when}"). Fixed the ones that still glued a suffix onto `{time}` (`card.backat`, `srv.limit`, `srv.night.head`).
- `col.verify` "Zuk {{dev:probatzeko}}" and `inbox.t.tag`: fine as they are.
- Playful lines: 🏇 "Zartagada" (a blow with a frying pan) is now "Zartailua astindu" (crack the whip); "Mantendu platerak biraka" kept.
- Percent: "%{n}" (sign first) is the Basque norm and is kept. Phrases that glued a suffix onto a percentage ("%{pct}ean", "%{pace}eko") were reworded, because the right ending depends on the number.
- "Verbose": kept in English as the setting name.

## Review
Native-speaker review, every value read next to the English (AIG-494).
- Filled in the 7 keys that were missing (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- Removed every "{name}(r)i / (e)k / (r)en" hack (about 70 values) using "{name} laguna…", "{name} proiektua…" or a colon label. Also `{n}(e)tik` in the checklist ("{done}/{n}").
- "Group" of cards was "Taldea", the same word as team: now "Multzoa" everywhere (`card.f.group`, `filter.groups`, `inbox.g.*`, `group.chip.title`).
- Ergative mistakes where the subject was a bare placeholder ("<b>{who}</b> galdetu du", "{who}(r)ek galdera bat du") reworded.
- `assignee.you.task` had lost its leading ": " that the code appends after "Zu".
- `srv.night.stuck` had lost its leading ", ".
- `sm.night.title` quoted a setting label that did not match the real label (`lead.watchAll`).
- Grammar: "zenbat aldiz" → "zenbatero" (how often), "ordubete" → "ordubetez" (for an hour), "aldatu bati" → "aldatu batera", "Nork erantzuten dizkie" → "Nork erantzuten die", "eman {n} proiektuei guztiei" → "{n} proiektu guztiei", "dezakezu" forms with the bare stem ("alda dezakezu", "salta dezakezu", "gasta dezakezu"), "jarraitu" with the dative ("Taldeburuari jarraitzen").
- Calques and odd wordings: "larria" for urgent → "premiazkoa"; "Baiezta?" → "Ados?"; "Zeren gainean ari den" → "Zertan ari den"; "fidagaitza" → "ez da fidagarria"; "Lasai lo egin" → "Ondo lo egin"; "molestatu" → "traba egin"; "Kontuz" → "Zuhurra" (to match the budget step); "Exekutatu morroia" → "Abiarazi morroia"; "X. urratsa, guztira N" counters → "Urratsa: X/N".
- Shorter placeholders and key hints: "Enter-ek bidaltzen du, Shift+Enter-ek lerro berria egiten du" → "Enter bidaltzeko, Shift+Enter lerro berrirako".
- "agente-programa" → "agentearen programa"; "{port}. portua" (an ordinal) → "{port} ataka".
- Night watchman: `watch.h` now "Gaueko zaintzailea" to match the glossary.

Still worth a human native check:
- "AI" is kept as in the first pass ("AIa", "AIari", "AI probatzailea"). Many Basque texts write "AA" (adimen artifiziala); switching would touch about 40 values.
- Loanword hyphens (stand-up-ak, token-ak, bug-ak, hook-ak): kept consistent with the first pass; Euskaltzaindia only requires the hyphen where the spelling would mislead, so "tokenak", "bugak" would also be correct.
- "Pankake-denda" for Pancake Shop and "morroia" for the wizard.
- `usage.unit.d` is "e" (egun); check that the short unit reads well where it is shown.
