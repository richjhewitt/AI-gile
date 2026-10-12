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
| Going quiet | Stacco un po' | verb «staccare» («quando stacchi», «🌙 Stacca») |
| idle | inattivo | |
| assumption | ipotesi | "Plug this" = «Correggi» |
| No Token Mode | modalità No Token | |
| token | token | |
| agent | agente | |
| Look (🎨) | Aspetto | |
| Permissions | Permessi | |
| Views | Viste | |
| DM | DM | kept |
| Pop out | Apri a parte | |
| friend | contatto | «amico» is gendered; «contatto» reads naturally in a DM list. Invites: «la persona che inviti» |
| GO (reply word) | GO / Via | button «Via», but what it sends, and GO? in pt.plan, stay GO: the board looks for that word |
| Space | Spazio | |
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

## Answers to the questions above
- **«Via» for GO:** reads as an approval («dare il via», «aspetta il mio via»); kept on buttons. The titles now say that GO is what gets sent («Invia GO (via libera) come risposta»), and `pt.plan` ends in GO? again so the GO buttons show.
- **«Tappala»:** unclear for an assumption. Now «✋ Correggi», «Corretta», «Correggi questa ipotesi».
- **«Per te»** and **«Aspetto»:** both fine; kept.
- **Gender of people:** reworded wherever a neutral form reads naturally: «Ti diamo il benvenuto», «Ci devi ancora pensare», «hai dubbi», «Rieccomi», «Lead loquace», «in autonomia», «Avvio non riuscito». Friends are «contatti».
- **Imperative vs infinitive:** consistent as described. `update.what.*` are now infinitives because they are slotted into «Vuoi {what} comunque e perderla?».

## Review
Native-speaker pass for AIG-491 (199 values changed).
- Going quiet: «Vado in silenzio» is not idiomatic; now «Stacco un po'» / «stacchi» everywhere.
- Gendered reader, agents and friends reworded (see above); «amico» → «contatto» in DM, sharing and pretend-friend texts.
- Wrong meaning fixed: `pres.since` and `night.since` got "5 min fa" after «da»; `inbox.t.waiting` now «in attesa da {when}»; `inbox.aiall` (accept the tests the AI passed); `leave.confirm`; GO titles.
- «Dì» → «Di'» (imperative of dire).
- «aspetta te» / «in attesa di te» → «ti aspetta(no)».
- «Space» → «Spazio».
- Shorter or more natural buttons: «Ci penso su», «Tutto ok, passo successivo», «Finestra formato telefono», «Invio per inviare, Maiusc+Invio per andare a capo».

Still for a human native speaker:
- «card» and «board» as feminine loanwords: common in Italian teams, but «scheda» / «bacheca» are the alternatives.
- «Contatto» for friend: check it fits the invite flow; «Famiglia e amici» (life category) kept.
- Plural `many` keys repeat `other`, as Intl gives `many` for Italian.

