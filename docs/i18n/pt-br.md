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
| Going quiet | Ficar offline | reviewer may prefer another phrase |
| assumption | suposição | "Plug this" = "Tapar o buraco" |
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
