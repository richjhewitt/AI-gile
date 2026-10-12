# Scottish Gaelic (gd): first pass (AIG-489)

Register: casual singular "thu", as in LocoRadio's gd.json. Curly apostrophe (’) is used as in LocoRadio. Dates should use `gd-GB`. Plain strings: after numbers Gaelic uses a singular noun in many cases, but the neutral form chosen here is the plural/base form that reads naturally (e.g. "{n} cairtean"); see below.

Dev words wrapped in `{{dev:...}}` are left in English inside the marker.

## Glossary
| English | Gaelic |
|---|---|
| card | cairt (pl. cairtean) |
| board | bòrd |
| lead | stiùiriche |
| team | sgioba (pl. sgiobaidhean) |
| project | pròiseact |
| For you | Dhutsa |
| To do | R’ a dhèanamh |
| In progress / Doing | Ga dhèanamh |
| Team checking | An sgioba a’ sgrùdadh |
| For the team | Dhan sgioba |
| Verify / test | {{dev:test}} (English kept) |
| Done | Deiseil |
| sprint | sprint (kept) |
| backlog | backlog (kept) |
| stand-up | stand-up (kept) |
| inbox | bogsa a-steach |
| Setup | Rèiteachadh |
| Look | Coltas |
| Views | Seallaidhean |
| Usage | Cleachdadh |
| test steps | ceumannan {{dev:test}} |
| assumption | barail |
| night watch | faire na h-oidhche |
| No Token Mode | Modh gun Thòcan |
| token | tòcan |
| poke / nudge | putadh |
| wake | dùisg |
| Lead Scrum Master | Prìomh Scrum Master |
| Accept / Send back | Gabh ris / Cuir air ais |
| Blocked | Bacte |
| Friends / DMs | caraidean / DMs |
| Relay | ath-sheachadan |
| Folder | pasgan |
| Permissions | Ceadan |
| Glossary | faclair |
| Tour | Cuairt |
| Pretend friend | caraid leigeil-orm |

## For the reviewer
- Numeral + noun agreement is not fully done (Gaelic has singular after numbers 1-10 in many cases, plus lenition/eclipsis); `{n} cairtean`, `{n} sgioba`, `{n} ceistean` etc. should be checked.
- Many strings with `{name}` or `{who}` may need case/lenition; names were kept out of mutation position where possible but not everywhere.
- "Dhutsa" (For you) and "R’ a dhèanamh" (To do) are short; check they fit the column headers.
- `col.verify` ("Dhutsa airson {{dev:test}}") is awkward; check.
- "Rèiteachadh" for Setup vs "Coltas" for Look: confirm.
- "putadh" for poke is literal; alternatives welcome.
- Typing/tone: some long help strings follow the English structure closely and may read stiffly.
