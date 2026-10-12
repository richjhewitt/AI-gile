# Irish (ga): first pass (AIG-489)

Register: casual singular "tú"/"do", as in LocoRadio's ga.json. Standard Caighdeán Oifigiúil spelling. Dates should use `ga-IE`. Plain strings: after numbers Irish uses the singular noun ("5 cárta", "3 foireann"), which is what is used for `{n}` strings, so no plural handling is needed.

Dev words wrapped in `{{dev:...}}` are left in English inside the marker.

## Glossary
| English | Irish |
|---|---|
| card | cárta |
| board | bord |
| lead | ceannaire |
| team | foireann |
| project | tionscadal |
| For you | Duitse |
| To do | Le déanamh |
| In progress / Doing | Ar siúl |
| Team checking | An fhoireann ag seiceáil |
| For the team | Don fhoireann |
| Verify / test | {{dev:test}} (English kept) |
| Done | Déanta |
| sprint | sprint (kept) |
| backlog | backlog (kept) |
| stand-up | stand-up (kept) |
| inbox | bosca isteach |
| Setup | Socrú |
| Look | Cuma |
| Views | Amharcanna |
| Usage | Úsáid |
| test steps | céimeanna {{dev:test}} |
| assumption | toimhde |
| night watch | faire na hoíche |
| No Token Mode | Mód Gan Tokens |
| token | token (loanword) |
| poke / nudge | bior |
| wake | dúisigh |
| Lead Scrum Master | Príomh-Scrum Master |
| Accept / Send back | Glac leis / Seol ar ais |
| Blocked | Bactha |
| Friends / DMs | cairde / DManna |
| Relay | athsheachadán |
| Folder | fillteán |
| Permissions | Ceadanna |
| Glossary | gluais |
| Tour | Turas |
| Pretend friend | cara bréige |

## For the reviewer
- Initial mutations (lenition/eclipsis) after prepositions and possessives where `{name}`, `{who}`, `{col}`, `{project}` are filled in are not applied; the text was kept so the name is not in a mutating position where possible.
- Genitive forms in compound phrases (e.g. "teorainn an lae inniu", "ainm an tionscadail") were written by hand; please check.
- "bior" for poke, "Duitse" for For you, and "Le déanamh" for To do should be checked against what feels natural on a kanban board.
- `col.verify` ("Duitse le {{dev:test}}") is awkward.
- "Token" is kept as a loanword (plural "tokens"); native alternatives may be preferred.
- Short time units (`ago.bare.*`, `usage.unit.*`): u (uair), l (lá), nóim.
