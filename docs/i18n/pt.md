# AI-gile in Portuguese (pt, Portugal)

First pass by Babel for AIG-491, to be checked value by value by a native-speaker reviewer. Source: `public/lang/en.json` (1929 keys).

## Register
- Casual **tu**, as in LocoRadio's `pt.json` ("Mudar para o tema", "o teu dispositivo"). Imperatives in the tu form: "Clica", "Escolhe", "Cola", "Arrasta".
- European Portuguese: ecrã, ficheiro, telemóvel, equipa, utilizador, partilhar, ligar/ligação, guardar, "A carregar…" and "A trabalhar" (a + infinitive, not the gerund), "Definições", "Aspeto", "registo", "sénior".
- Present perfect and the usual pt-PT clitic order ("diz-lhe", "acorda-a").
- Dates and durations come from the browser locale, not from this file.
- Plurals: `one`, `many`, `other` (what Intl.PluralRules gives for pt-PT); `many` repeats `other`.
- `{{dev:...}}` markers kept around the whole word where English has them. Inside: loanwords stay (`{{dev:Backlog}}`, `{{dev:sprints}}`, `{{dev:bug}}`, `{{dev:commits}}`), "test" becomes "teste/testar/testares" ("Para {{dev:testares}}").
- Keys, `{placeholders}`, emoji, `**bold**`, backticks, CLI commands and brand names untouched.

## Glossary
| English | Portuguese | Note |
|---|---|---|
| card | cartão | pt-PT Trello also says cartão |
| board | quadro | |
| project | projeto | |
| team | equipa | |
| lead | líder | "Lead Scrum Master" kept |
| Scrum Master | Scrum Master | kept |
| For you | Para ti | column and badges |
| To do | A fazer | |
| In progress / Doing | Em curso | |
| Team checking | A equipa verifica | |
| For the team | Para a equipa | |
| For you to test (Verify) | Para {{dev:testares}} | |
| Done | Concluído | |
| Backlog | Backlog | loanword |
| sprint | sprint | loanword |
| stand-up | stand-up | loanword; also matches "daily" in the glossary |
| inbox | caixa de entrada | |
| Setup | Definições | the page is a settings page |
| Usage | Utilização | |
| test | teste / testar | |
| AI tester | testador de IA | |
| passed / failed | aprovado / reprovado | |
| test steps | passos do teste | |
| Accept | Aceitar | |
| Send back | Devolver | |
| Wait and see | Esperar para ver | |
| Poke | dar um toque | button "👉 Dar um toque" |
| Wake | Acordar | |
| Watch (👁) | Observar | |
| night watch / watchman | vigilância noturna / vigilante noturno | |
| Going quiet | Ficar offline | "quiet" has no natural short word; reviewer may prefer another |
| assumption | suposição | "Plug this" = "Tapar o buraco" |
| No Token Mode | Modo Sem Tokens | |
| token | token | |
| agent | agente | |
| Look (🎨) | Aspeto | |
| Permissions | Permissões | |
| Views | Vistas | |
| DM | MD (mensagem direta) | |
| Pop out | Destacar | |
| Space (🪐) | Espaço | |
| helpers | ajudantes | |
| Go (button) | Go | kept: it is the protocol word the team reads |
| GIF, PR, WIP | kept | |

## For the reviewer
- "Going quiet" / "Ficar offline", "Poke" / "dar um toque" and "Plug this" / "Tapar o buraco" are my own choices; check they sound natural.
- "Views" as "Vistas" (saved filters) might read oddly; "Filtros guardados" is an alternative.
- Hooks, relay, commit, branch and similar dev words are kept as English loanwords in the glossary entries.
- `gloss.*.word` is the displayed term and `gloss.*.also` lists extra spellings the page should underline: check they match how the dotted words appear in this language's text.
- Several strings run long (settings help texts, `wz.*`, `scale.*`); look for ones that overflow buttons.
