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
| Going quiet | Ficar offline | kept after review |
| assumption | suposição | "Plug this" = "Corrigir" (review) |
| Watchman ticks every project | O vigilante cobre todos os projetos | same label in `lead.watchAll` and `sm.night.title` |
| Stand-up all | Stand-up geral | |
| raise (a bug) / raise (a card) | reportar / criar | not "levantar" |
| ways of working | formas de trabalhar | |
| where teams run | onde as equipas trabalham | "correr" only for commands and programs |
| build (verb, noun) | construir / construção | |
| status (card) | estado | |
| log | registo | |
| Undo | Anular | |
| Pro-friendly | Ideal para o Pro | |
| Steady (push level 3) | Constante | |
| step (slider level) | nível | |
| Reporter (share role) | Relator | |
| passed / failed chip | 🤖 Aprovado / 🤖 Reprovado | |
| mid (level) | intermédio | |
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

## Answers (native-speaker review)
- "Ficar offline" stays: it is how people in Portugal say it, and it is short. "Dar um toque" for Poke sounds natural and stays.
- "Tapar o buraco" was too figurative for a button: "Plug this" is now "✋ Corrigir", and the comment says "Corrigir esta suposição".
- "Vistas" stays: Portuguese Office and Outlook use "Vista" for a saved view.
- Dev loanwords (hook, relay, commit, branch, merge, push, deploy) are fine as they are.
- `gloss.*.also` checked against every `{{dev:...}}` word: "testares" added to `gloss.test.also` (test has no tooltip, so this only matters for search).
- No button overflow found: the longest button labels (for example "✅ Aceitar todos os aprovados pela IA ({n})") are about as long as the German ones.

## Review
Native-speaker review for AIG-491: 129 values changed, including 3 new keys (`boot.retry`, `boot.broke`, `boot.reload`) that came in with the latest en.json.
- Added the three `boot.*` strings.
- Calques and unnatural phrasing fixed: "tão longo quanto quiseres", "resposta enlatada", "Amigo do Pro", "Eis como te orientares", "É isto!", "O que está avariado?", "Muda o nome, a ordem, oculta e colore", "dá feedback".
- Wrong meanings fixed: `quiz.words.dev` said "there is no shortage of dev words", now "Termos de programação, sem problema"; `srv.notokens.guard` said "until you switch it off again", now "until you switch the AI back on".
- "correr" for teams (`runin.h`, `look.runin`, `wz.adv.runs.h`, `wz.adv.row.runs`) read as jogging: now "trabalhar".
- "levantar bugs/cartões" (calque of raise) is now "reportar" for bugs and "criar" for cards.
- `lead.watchAll` and `sm.night.title` named the same switch differently; both now "O vigilante cobre todos os projetos".
- AO90 spelling: "Pára" / "pára" is now "Para" / "para" (`nt.title.off`, `wz.plan.*`, `term.run.all.title`).
- `prof.level.mid` was the Brazilian "pleno": now "intermédio".
- 🤖 chips now "Aprovado / Reprovado", matching "Aceitar todos os aprovados pela IA" and the glossary.
- Agreement: role lists ("Adicionadas", "Trocadas", "Removida") follow "função"; an invite "ligação" is "usada"; "restam {h5}" with a percentage.
- pt-PT countdowns: "daqui a {in}" instead of "dentro de {in}".
- Smaller wording: "Stand-up geral", "Repor as predefinições", "Desfazer a ligação", "Nome do amigo", "O teu amigo permite:", "disse que agora não", "nível" for slider steps.

Still worth a human look:
- "🐞 Relator" for the Reporter share role: "Repórter" sounded like a journalist, but "Relator" may still read oddly.
- "Conversa" for Chattiness (`scale.chat`), and "Impedimentos graves" for Showstoppers.
- `prof.team.solo` is read as "a team for someone working alone"; check that matches the English intent.
