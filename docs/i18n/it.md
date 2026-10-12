# AI-gile in Italian (it)

First pass by Babel for AIG-491, before the native-speaker check.

## Register
- Casual **tu** throughout (never Lei), matching LocoRadio's Italian and AI-gile's friendly English. Imperatives in the tu form ("Clicca", "Incolla", "Apri").
- Standard Italian (Italy). Quotes in running text are « » where they stand for a quoted phrase; the straight `"` is kept wherever the English file uses it around a card title or a literal.
- Keyboard keys: Invio (for Enter), Maiusc (for Shift), Esc. Product names unchanged.
- Durations and units: min, h, g (giorni). Dates follow it-IT.
- Plurals use Intl's categories for Italian (one, many, other); "many" carries the same text as "other".
- `{{dev:...}}` markers wrap the whole Italian word ("{{dev:testare}}", "{{dev:sprint}}"). Backlog, sprint, bug, commit, push, merge, branch, hook, deploy, token, test are kept as English loanwords, as Italian software teams say them. The invariant ones repeat the same word in the glossary `*.also` lists.

## Glossary
| English | Italian | Note |
|---|---|---|
| card | card | loanword, feminine ("la card") |
| board | board | loanword, feminine |
| project | progetto | |
| team | team | |
| lead | lead | Lead Scrum Master kept |
| Scrum Master | Scrum Master | kept |
| For you | Per te | |
| For you to test | Per te da testare | |
| To do | Da fare | |
| In progress / Doing | In corso | |
| Team checking | Il team controlla | |
| For the team | Per il team | |
| Done | Fatto | |
| Backlog | Backlog | |
| sprint | sprint | |
| stand-up | stand-up | |
| inbox | Posta in arrivo | |
| Setup | Impostazioni | |
| Usage | Consumi | the plan-usage page |
| test | test / testare | |
| test steps | passaggi del test | |
| bug | bug | |
| AI tester passed / failed | superato / non superato | |
| Send back | Rimanda indietro | |
| Accept | Accetta | |
| Wake (team) | Sveglia | |
| Poke | Sollecita / dare una spinta | |
| night watch | guardia notturna | |
| Going quiet | Vado in silenzio | |
| idle | inattivo | |
| assumption | ipotesi | "Plug this" = "Tappala" |
| No Token Mode | modalità No Token | |
| token | token | |
| agent | agente | |
| Look (🎨) | Aspetto | |
| Permissions | Permessi | |
| Views | Viste | |
| DM | DM | kept |
| Pop out | Apri a parte | |
| Space | Space | kept |
| Checklist | Checklist | |
| Hook | hook | kept |

## For the reviewer
- **"Via" for GO:** the GO button and "OK, go" sentences use "Via". Check it reads as an approval and not as "away".
- **"Tappala" for "Plug this":** an idiom for covering a gap; confirm it is clear for assumptions.
- **"Per te" short column name** and **"Aspetto"** for 🎨 Look.
- **Gender of friends and people:** `{name}` lines use masculine defaults in a few places ("è stato aggiunto", "è bloccato", "con lui"); change to neutral wording if you prefer.
- **Imperative vs infinitive on buttons:** buttons use the imperative ("Salva", "Invia"), long confirmation questions use the infinitive ("Eliminare ...?"). Check consistency.
- **`servers.ssh.ph`** keeps the example `rich@92.113.144.194` on purpose.
- **Long values:** `usage.note`, `dlg.conn.intro`, `budget.*.help`, `scale.push.help` and the `share.*` help texts are close translations and may run longer than English.
