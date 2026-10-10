# Dutch (nl) glossary

Choices made for `public/lang/nl.json` (Netherlands Dutch, informal "je"). One translation per concept; keep to these when adding strings.

## Board terms

| English | Dutch | Why |
|---|---|---|
| card | kaart | Plain word, used by Trello and Jira in Dutch. |
| board | bord | Short and literal; matches "kanbanbord". |
| column | kolom | Standard. |
| project | project | Same word. |
| team lead / lead | teamleider | Clear for a non-developer; "lead" alone sounds like sales jargon in Dutch. |
| team member | teamlid | Standard. |
| assignee | toegewezen aan (lanes: "per persoon") | Dutch has no good single noun; "per persoon" is shorter in the lanes menu. |
| type (feature / bug / task) | soort (functie / bug / taak) | "Soort" is everyday Dutch; "type" sounds technical. |
| priority low / normal / high / urgent | laag / normaal / hoog / dringend | "Dringend" is more natural than "urgent". |
| blocked | geblokkeerd (a card); "zit vast" (a person) | "Geblokkeerd" is the standard status word; for a person "zit vast" reads naturally. |
| blockers (stand-up) | blokkades | Common in Dutch agile teams. |
| needs you | heeft jou nodig | Literal and warm. |
| poke | duwtje (geven) | "Porren" sounds rude; "een duwtje" is friendly. |
| wake (a team) | wekken | Literal; fits "team slaapt". |
| accept / send back | goedkeuren / terugsturen | Standard approval words. |
| your call | aan jou | Short; "jouw oordeel" sounded formal. |
| view (saved filters) | weergave | Standard UI word. |
| lanes / swimlanes | rijen | "Zwembanen" is jargon; rows is what the user sees. |
| inbox | inbox | Common in Dutch; "Postvak IN" is Outlook-specific. |
| DMs / direct messages | DM's / privéberichten | "DM" is everyday Dutch; title uses the full word. |
| messages (inbox section) | berichten | Standard. |
| stand-up | stand-up (report: stand-upverslag) | Used as-is in Dutch teams; compound spelled per Taalunie. |
| going quiet | even weg | Short and friendly. |
| home (page) | startpagina (rail button: Start) | Standard. |
| Setup (page) | Instellingen | What Dutch apps call it. |
| Usage (page) | Verbruik | Like energy or phone usage. |
| plan (subscription) | abonnement | "Plan" is not used this way in Dutch. |
| window (5-hour / 7-day) | periode | "Venster" is a literal calque. |
| reading (usage) | meting | Standard. |
| gauge | meter | Standard. |
| folder / connect folder | map / map koppelen | Windows Dutch uses "map". |
| permissions | rechten | Short; "machtigingen" is long and formal. |
| look (colour and emoji) | stijl | "Uiterlijk" made the board toolbar wrap. |
| archive / unarchive | archiveren / uit archief halen | Standard. |
| key (card prefix) | code | "Sleutel" is confusing; "code" says what it is. |
| log | logboek | Standard. |
| Pop out | los venster | Says what happens. |
| ways of working | werkafspraken | The normal Dutch term. |

## Columns

| English | Dutch |
|---|---|
| Backlog | Backlog |
| To do | Te doen |
| In progress | Bezig |
| Team checking | Team checkt (shorter than "Team controleert", which wrapped) |
| For you to test | Jij test (short: Voor jou) |
| For the team | Voor het team |
| Done | Klaar |

## Developer words (`{{dev:...}}`)

These are loanwords Dutch teams use as-is, so the English word stays and needs no bracket:
`{{dev:Backlog}}`, `{{dev:sprint}}` / `{{dev:sprints}}`, `{{dev:bug}}`, `{{dev:test}}` / `{{dev:tests}}`, `{{dev:commits}}`.

- "test" doubles as the Dutch verb form ("Jij test", "Zo test je het"), so the marker always wraps the English word itself. Where Dutch would need "testen" or "teststappen", the sentence is rephrased around the noun ("klaar voor jouw test", "Stappen voor de test") so the marker never holds a Dutch form.
- If a later string needs a real translation, write the Dutch word with the English marker in brackets: `samenvoegen ({{dev:merge}})`, `vastleggen ({{dev:commit}})`.
- Note for the glossary card: if it adds "(English)" after markers for Dutch, skip it when the shown word equals the English one, or these loanwords would read "bug (bug)".
