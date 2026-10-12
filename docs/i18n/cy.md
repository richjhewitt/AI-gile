# Welsh (cy): first pass (AIG-489)

Register: casual "ti" (dy, dy ... di), as in LocoRadio's cy.json. Standard (South-leaning, neutral) Welsh with colloquial contractions ("Dw i", "Gelli di"). Dates should use `cy-GB`. Plain strings: `{count}`-style fixed forms use the neutral singular noun after a number (Welsh uses the singular after numerals: "5 cerdyn"), so no plural handling is needed.

Dev words wrapped in `{{dev:...}}` are left in English inside the marker; the grammar around them is Welsh.

## Glossary
| English | Welsh |
|---|---|
| card | cerdyn (pl. cardiau) |
| board | bwrdd |
| lead | arweinydd |
| team | tîm (pl. timau) |
| project | prosiect |
| For you | I ti |
| To do | I'w wneud |
| In progress / Doing | Ar y gweill |
| Team checking | Y tîm yn gwirio |
| For the team | I'r tîm |
| Verify / test | {{dev:test}} (English kept) |
| Done | Wedi'i wneud |
| sprint | sprint (kept) |
| backlog | backlog (kept) |
| stand-up | stand-up (kept) |
| inbox | blwch derbyn |
| Setup | Gosod |
| Look | Gwedd |
| Views | Golygon |
| Usage | Defnydd |
| test steps | camau {{dev:test}} |
| assumption | rhagdybiaeth |
| night watch | gwylio'r nos |
| No Token Mode | Modd Dim Tocynnau |
| token | tocyn |
| poke / nudge | hwb |
| wake | deffro |
| Lead Scrum Master | Prif Scrum Master |
| Accept / Send back | Derbyn / Anfon yn ôl |
| Blocked | Wedi'i flocio |
| Friends / DMs | ffrindiau / negeseuon uniongyrchol |
| Relay | cyfnewidydd |
| Folder | ffolder |
| Permissions | Caniatadau |
| Glossary | geirfa |
| Tour | Taith |
| Pretend friend | ffrind ffug |

## For the reviewer
- Singular-after-number pattern ("{n} cerdyn", "{n} tîm", "{n} mun") used throughout; check `poke.many`, `inbox.sum.*`, `dms.count.*`.
- "hwb" for poke/nudge is a loose choice; "pwt" or "procio" are alternatives.
- Soft mutations after "ei", "dy", "ein" and after prepositions are not handled where a name or count is filled in (kept out of mutation position where possible); check `{name}`-containing strings.
- "Gwedd" (Look) vs "Golygon" (Views): confirm they read as distinct.
- Verbal nouns used for `update.what.*` (Diweddaru, Adnewyddu, Ailgychwyn) because `leave.confirm` embeds them.
- Short time units (`ago.bare.*`, `usage.unit.*`) are abbreviations (mun, awr, d).
- Fun lines such as `sm.push.1` ("Cadw'r platiau i droelli") and `sm.push.5` are free renderings of the English idioms.
