# Welsh (cy): first pass and native review (AIG-489)

Register: casual "ti" (dy, dy ... di), as in LocoRadio's cy.json. Standard (South-leaning, neutral) Welsh with colloquial contractions ("Dw i", "Gelli di"); imperatives use the informal -a forms (agora, gluda, anfona, dewisa, tro ... ymlaen). Dates should use `cy-GB`.

Numbers: the plural objects (`{count}`) use every Intl.PluralRules category with the right mutation: two = soft ("2 gerdyn", "2 dîm"), few (3) and many (6) = aspirate ("3 cherdyn", "6 thîm"), zero/one/other = radical. Plain `{n}` strings can't mutate, so a noun after `{n}` uses "{n} o + plural" ("{n} o gardiau", "{n} o dimau", "{n} o gwestiynau"), or a label with a colon. Units after `{n}` (mun, awr, diwrnod) stay unmutated.

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
| Verify / test | {{dev:test}} (English kept); plain "test" = prawf / profi |
| Done | Wedi'i wneud |
| sprint | sprint (kept) |
| backlog | backlog (kept) |
| stand-up | stand-up (kept) |
| inbox | blwch derbyn |
| Setup | Gosod |
| Look | Gwedd |
| Team (project tab) | 👥 Tîm |
| Views | Golygon |
| Usage | Defnydd |
| test steps | camau {{dev:test}} |
| assumption | rhagdybiaeth |
| night watch | gwylio'r nos; watchman = gwyliwr (nos) |
| No Token Mode | Modd Dim Tocynnau |
| token | tocyn |
| poke / nudge | hwb (also for "the odd nudge") |
| wake | deffro |
| Lead Scrum Master | Prif Scrum Master |
| Accept / Send back | Derbyn / Anfon yn ôl |
| Blocked | Wedi'i flocio |
| Friends / DMs | ffrindiau / negeseuon uniongyrchol |
| Relay | cyfnewidydd |
| Folder | ffolder |
| Permissions | Caniatadau |
| Glossary | geirfa (fem.: "yr eirfa") |
| Tour | Taith |
| Pretend friend | ffrind ffug |
| Starter team | tîm cychwynnol |
| Got it | Wedi deall |
| Normal (priority, plan) | arferol |

## For the reviewer (answered)
- Singular after a number: right for a bare digit only when no mutation is due. Fixed: plural objects now carry the mutations; `poke.many`, `inbox.sum.*`, `inbox.badge.q.many`, `quiet.sent`, `poke.asleep.many` and friends use "{n} o + plural". `dms.count.*` keep "{n} neges" (n never mutates).
- "hwb" for poke: kept. It is short, friendly and already the noun Welsh speakers use for a nudge; "procio" sounds rougher. Used for "nudge" too, replacing the odd "gwthiad".
- Mutations around `{name}`: checked every string; names sit after "gan", "i", "at", "â", "gyda" where Welsh does not mutate proper names in practice. No change needed.
- "Gwedd" vs "Golygon": distinct enough (appearance vs saved views). Kept.
- Verbal nouns in `update.what.*`: fine inside `leave.confirm`.
- Short time units: fine.
- Fun lines: kept; they read naturally.

## Review (AIG-489)
Changed 163 values. Main points:
- Plurals: all 8 plural keys turned into objects with zero/one/two/few/many/other and the right soft/aspirate mutation.
- Numbers in plain strings: "{n} o + plural" wherever a noun followed `{n}` (no more "{n} cwestiwn", "{n} tasg", "{n} prawf", "~{n} gair", "{n} tocyn").
- Imperatives: instructions to the user now use the informal imperative (agora, gluda, anfona, dweda, dewisa, rheda, tro ... ymlaen, gollynga) instead of the verbal noun; button labels keep the verbal noun.
- Mutation and grammar slips: "yr eirfa" (not "y geirfa"), "ar dy Ddesg", "gydag aigile avatar", "gydag 1 cerdyn", "dad-dicia", "elli di ddim" (was "all ti ddim"), "ei un ei hun", "wedi'i dacluso".
- Wrong or odd meaning: `wz.ask.no` ("Fe wnaf i ei fwrw" was nonsense, now "Fe ffeindia i fy ffordd fy hun"), `life.toast.done`, `card.was`, `share.role.theirs`, `usage.limit`/`usage.line.explain` ("rwyt ti allan"), `help.offer.h` (calque), `ng.calm`, `gloss.push.text`.
- Strings whose English had moved on: `board.team` (now with 👥), `wz.adv.roles.h/sub`, `wz.adv.row.roles` (starter team, 👥 Tîm).
- Terms: "arferol" for Normal, "Frontend", "Ysgrifennwr copi", "Wedi deall" for Got it, iOS/Android menu names left in English (those systems have no Welsh UI).

Still for a human native speaker:
- `ago.d`, `usage.r7`, `usage.compact.wk` and friends: "{n} diwrnod" with a digit is not mutated ("2 diwrnod" rather than "2 ddiwrnod"); common in UI text but worth a look.
- `col.verify` "I ti i'w {{dev:test}}": reads well to me, but the column is narrow.
- `share.safety.need` uses "chi" forms on purpose (two people reading to each other).
- 181 newer English keys (pretend team, night-watch pokes, team editor, server messages) are not in cy.json yet and show in English.
