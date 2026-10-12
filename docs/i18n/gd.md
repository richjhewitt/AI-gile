# Scottish Gaelic (gd): first pass and native review (AIG-489)

Register: casual singular "thu", as in LocoRadio's gd.json. Curly apostrophe (’) is used as in LocoRadio. Dates should use `gd-GB`.

Numbers: the plural objects (`{count}`) use one/two/few/other the Gaelic way: one and two take the lenited singular ("1 chairt", "2 chairt"), few (3-10, 13-19) the plural ("5 cairtean"), other (20+, 0) the singular ("20 cairt"). Plain `{n}` strings can't do that, so a counted noun goes into a label with a colon ("Ceistean: {n}", "Cairtean air an cur: {n}") or the number moves into brackets. Units (mion, uair, là) stay as they are.

Dev words wrapped in `{{dev:...}}` are left in English inside the marker.

## Glossary
| English | Gaelic |
|---|---|
| card | cairt, fem. (pl. cairtean) |
| board | bòrd |
| lead | stiùiriche |
| team | sgioba, masc. (gen. "an sgioba", pl. sgiobaidhean) |
| project | pròiseact |
| For you | Dhutsa |
| To do | Ri dhèanamh |
| In progress / Doing | Ga dhèanamh |
| Team checking | An sgioba a’ sgrùdadh |
| For the team | Dhan sgioba |
| For you to test | Dhutsa ri {{dev:test}}; "to test" = ri {{dev:test}} |
| Done | Deiseil |
| sprint | sprint (kept) |
| backlog | backlog (kept) |
| stand-up | stand-up (kept) |
| inbox | bogsa a-steach |
| Setup | Rèiteachadh |
| Look | Coltas |
| Team (project tab) | 👥 Sgioba |
| Views | Seallaidhean |
| Usage | Cleachdadh |
| Refresh / reload | Ath-luchdaich |
| test steps | ceumannan {{dev:test}} |
| assumption | barail, fem. (pl. barailean) |
| night watch | faire na h-oidhche; watchman = fear-faire (na h-oidhche) |
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
| pack (AIGILE pack) | pacaid |
| pile (your pile) | cruach |
| helpers | cuidichean |
| Permissions | Ceadan |
| Glossary | faclair |
| Tour | Cuairt |
| Pretend friend | caraid leigeil-orm |
| Starter team | sgioba tòiseachaidh |
| comment | beachd (pl. beachdan) |

## For the reviewer (answered)
- Numeral + noun agreement: fixed. Plural objects follow the one/two/few/other pattern above; `{n}` strings no longer put a noun after the number.
- `{name}`/`{who}`: names sit after "gu", "le", "do", "bho", "aig", where a name is not lenited in writing. Fixed "dha {name}" to "do {name}".
- "Dhutsa" and "Ri dhèanamh" fit the headers. "R’ a dhèanamh" was not standard; changed everywhere to "Ri dhèanamh".
- `col.verify`: now "Dhutsa ri {{dev:test}}".
- "Rèiteachadh" vs "Coltas": distinct, kept.
- "putadh": kept; it is clear and short.
- Stiff long strings: smoothed the worst (dispatch, budget, share, pack, wizard).

## Review (AIG-489)
Changed 288 values. Main points:
- Plurals: all 8 plural keys are objects with one/two/few/other ("1 chairt / 2 chairt / 5 cairtean / 20 cairt", "seann seisean", "turas / thuras / tursan").
- Grammar: "ag ùrachadh" (not "a’ ùrachadh"), "a’ ruith" (not "ag ruith"), "cha dhùisg/cha tòisich" (not "chan dùisg/chan tòisich"), "mur eil/mura h-eil" (not "mura bheil"), "ceàrr", "sa phasgan/sa bhrabhsair/sa chabadaich", genitive "an sgioba" (masc.), "na chadal" for one team and "nan cadal" for several, feminine agreement for cairt and freagairt ("a’ chairt ... i", "an fhreagairt", "air a freagairt", "ga deasachadh").
- Wrong words: "cabhagach" (hasty) for chatty, now "còmhraideach"; "obair-bhaile" (homework) now "obair leamh"; "srann" (snore) now "bìog"; "crùb" for pile now "cruach"; "pasgan" for an AIGILE pack now "pacaid"; "Cuideachaidhean" now "cuidichean"; "an-asgaidh" for a free (unused) picture now "ri fhaighinn"; "dligheachd air falbh" now "air ruith a-mach".
- Calques and odd sentences: `help.offer.h` ("do chas a lorg"), `inbox.aiall`, `views.intro`, `tidy.title` ("thaiceil"), `quiz.tidy`, `assignee.you.task`, `assignee.prompt`, `ng.calm`, `usage.stale`, `usage.limit`.
- Strings whose English had moved on: `board.team` (👥), `wz.adv.roles.h/sub`, `wz.adv.row.roles` (starter team).

Still for a human native speaker:
- "beachd" is used both for comment and for idea (`idea.*`, `dms.kind.idea`). Common in Gaelic UIs, but "smuain" for idea may read clearer.
- Units after `{n}` ("{n} mion", "{n} là", "{n} uair") are left in one form.
- "Glè mhath" for the Got it button (`info.gotit`) is a free choice.
- "Barailean" for Assumptions, "Rùm" for Space.
- 181 newer English keys are not in gd.json yet and show in English.
