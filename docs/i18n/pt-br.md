# AI-gile in Portuguese (pt-br, Brazil)

First pass by Babel for AIG-491, to be checked value by value by a native-speaker reviewer. Source: `public/lang/en.json` (1929 keys). Most strings were written together with the pt (Portugal) file and then adapted.

## Register
- **você** throughout, as in LocoRadio's `pt-br.json` ("use o volume do seu dispositivo"). Imperatives in the você form: "Clique", "Escolha", "Cole", "Arraste". Possessives "seu/sua".
- Brazilian Portuguese: tela, arquivo, celular, equipe, usuário, compartilhar, conectar/conexão, salvar, "Carregando…" and "Trabalhando" (gerund), "Configurações", "Aparência", "log", "sênior", "Ver" for look, "mouse".
- Dev talk as Brazilian teams say it: "card" (not cartão), "build", "log", "app", "print" (screenshot), "tour", "daily" is accepted as an alias of stand-up.
- Dates and durations come from the browser locale.
- Plurals: `one`, `many`, `other` (Intl.PluralRules for pt-BR); `many` repeats `other`.
- `{{dev:...}}` markers kept as in the pt file: "Para você {{dev:testar}}".
- Keys, `{placeholders}`, emoji, `**bold**`, backticks, CLI commands and brand names untouched.

## Glossary
| English | Brazilian Portuguese | Note |
|---|---|---|
| card | card | masculine: "o card"; plural "cards" |
| board | quadro | |
| project | projeto | |
| team | equipe | |
| lead | líder | "Lead Scrum Master" kept |
| Scrum Master | Scrum Master | kept |
| For you | Para você | |
| To do | A fazer | |
| In progress / Doing | Em andamento | |
| Team checking | A equipe verifica | |
| For the team | Para a equipe | |
| For you to test (Verify) | Para você {{dev:testar}} | |
| Done | Concluído | |
| Backlog | Backlog | loanword |
| sprint | sprint | loanword |
| stand-up | stand-up | loanword |
| inbox | caixa de entrada | |
| Setup | Configurações | |
| Usage | Uso | |
| test | teste / testar | |
| AI tester | testador de IA | |
| passed / failed | aprovado / reprovado | |
| test steps | passos do teste | |
| Accept | Aceitar | |
| Send back | Devolver | |
| Wait and see | Esperar para ver | |
| Poke | dar um toque (cutucar in running text) | button "👉 Dar um toque" |
| Wake | Acordar | |
| Watch (👁) | Observar | |
| night watch / watchman | vigilância noturna / vigilante noturno | |
| Going quiet | Ficar offline | kept after review |
| assumption | suposição | "Plug this" = "Corrigir" (review) |
| Watchman ticks every project | O vigilante cobre todos os projetos | same label in `lead.watchAll` and `sm.night.title` |
| Stand-up all | Stand-up geral | |
| raise (a bug) / raise (a card) | registrar or reportar / criar | not "levantar" |
| ways of working | formas de trabalhar | "jeito de trabalhar" only for the user's own style |
| where teams run | onde as equipes trabalham | "rodar" only for commands and programs |
| build | build (noun), construir (verb) | |
| status (card) | status | not "estado" |
| log | log (verb: registrar) | never "registo" |
| Undo | Desfazer | not "anular" |
| Pro-friendly | Ideal para o Pro | |
| Steady (push level 3) | Constante | |
| step (slider level) | nível | |
| Reporter (share role) | Relator | |
| passed / failed chip | 🤖 Aprovado / 🤖 Reprovado | |
| Got it | Entendi | not "Percebido" |
| Slide | Slide | not "Diapositivo" |
| Tour | tour | not "visita" |
| Skip | Pular | not "Saltar" |
| waiting | esperando / aguardando | never "à espera" |
| Send to {name} | Enviar para {name} | |
| mid (level) | pleno | |
| No Token Mode | Modo Sem Tokens | |
| token | token | |
| agent | agente | |
| Look (🎨) | Aparência | |
| Permissions | Permissões | |
| Views | Visualizações | |
| DM | MD (mensagem direta) | |
| Pop out | Destacar | |
| Space (🪐) | Espaço | |
| helpers | ajudantes | |
| Go (button) | Go | kept: the protocol word the team reads |

## For the reviewer
- "card" instead of "cartão" is my choice for Brazilian software teams; check against what your users say.
- Some strings were adapted from the pt file by rules (cartão to card, equipa to equipe, Definições to Configurações, utilização to uso); read them for leftover Portugal wording or odd gender agreement ("todos os cards", "Cards propostos").
- "Ficar offline", "dar um toque" and "Tapar o buraco" are my own choices; check they sound natural.
- `gloss.*.word` is the displayed term and `gloss.*.also` extra spellings the page should underline.
- Several strings run long (settings help texts, `wz.*`, `scale.*`); look for ones that overflow buttons.

## Answers (native-speaker review)
- "card" is right for Brazilian software teams; it stays, masculine ("o card", "Cards propostos", "todos os cards" are correct).
- "Ficar offline" and "dar um toque" stay; "cutucar" is used in running text where it reads better.
- "Tapar o buraco" was too figurative for a button: "Plug this" is now "✋ Corrigir".
- `gloss.*.also` checked against every `{{dev:...}}` word: all are covered.
- No button overflow found.

## Review
Native-speaker review for AIG-491: 201 values changed, including 3 new keys (`boot.retry`, `boot.broke`, `boot.reload`) that came in with the latest en.json.
- Added the three `boot.*` strings.
- Leftover Portugal wording removed: "à espera" (inbox summaries, usage, links, waiting chips), "a editar", "Registo", "Guardar endereço" / "Guardar e voltar", "Os meus servidores", "Percebido", "Diapositivo", "Olhadela", "Saltar", "Anular", "Repor os predefinidos", "durante uma hora", "por usar, expira dentro de", "Larga aqui", "Não consegui perceber", "por fazer", "Enviar a {name}".
- tu forms left over from pt fixed: "Queres acrescentar algo?", "Risca-o", "deu-te o papel", "clica para retirar", "Escreve este comando… executa-o".
- Gender and agreement: "um tela" is now "uma tela"; "Lemos uma para o outro" is now "Lemos um para o outro"; role lists ("Adicionadas", "Trocadas", "Removida") follow "função".
- Imperatives in the você form where the pt tu imperative had been kept and read as 3rd person ("Encontre os projetos…", "Avise todas as equipes…").
- Consistent terms: "Status" for card status, "log", "tour", "Pular", "Desfazer", "Entendi", "Conversador" (not "Falante"), "Em andamento", "Buscar", "Manual" in the usage-check help to match its option.
- Same meaning fixes as pt: "rodar" for teams is now "trabalhar"; `srv.notokens.guard`; `lead.watchAll` / `sm.night.title` now match; "levantar bugs" is now "registrar bugs", cards are "criados"; "colora" (not a real form) replaced.
- Smaller wording: "Stand-up geral", "Neste ritmo", "reinicia em {in}", "Ideal para o Pro", "Restaurar o padrão", "Lembrete" for Remind me.

Still worth a human look:
- "🐞 Relator" for the Reporter share role.
- "Afazer na rua" for Errand, and "Olhada noturna" for Night glance.
- `prof.team.solo` is read as "a team for someone working alone"; check that matches the English intent.
- `board.happening` "O que está rolando?" is casual on purpose; switch to "O que está acontecendo?" if it reads too informal.
