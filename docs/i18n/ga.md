# Irish (ga): first pass and native review (AIG-489)

Register: casual singular "tú"/"do", as in LocoRadio's ga.json. Standard Caighdeán Oifigiúil spelling. Dates should use `ga-IE`.

Numbers: the plural objects (`{count}`) use one/two/few/many/other with the right mutation: one, two and few (3-6) lenite ("1 chárta", "2 chárta", "5 chárta"), many (7-10) eclipses ("8 gcárta"), other (0, 11+) is radical ("20 cárta"); "uair" goes "3 huaire", "8 n-uaire". Plain `{n}` strings can't mutate, so a counted noun goes into a label with a colon ("Ceisteanna: {n}", "Cártaí seolta: {n}") or the number moves into brackets.

Dev words wrapped in `{{dev:...}}` are left in English inside the marker.

## Glossary
| English | Irish |
|---|---|
| card | cárta |
| board | bord |
| lead | ceannaire |
| team | foireann, fem. ("ina codladh", "a céad rith") |
| project | tionscadal |
| For you | Duitse |
| To do | Le déanamh |
| In progress / Doing | Ar siúl |
| Team checking | An fhoireann ag seiceáil |
| For the team | Don fhoireann |
| For you to test | Le {{dev:test}} agatsa |
| Done | Déanta |
| sprint | sprint (kept) |
| backlog | backlog (kept) |
| stand-up | stand-up (kept) |
| inbox | bosca isteach |
| Setup | Socrú ("sa tSocrú") |
| Look | Cuma |
| Team (project tab) | 👥 Foireann |
| Views | Amharcanna |
| Usage | Úsáid |
| test steps | céimeanna {{dev:test}} |
| assumption | toimhde (pl. toimhdeanna) |
| night watch | faire na hoíche; watchman = faireoir (oíche) |
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
| Glossary | gluais, fem. ("an ghluais") |
| Tour | Turas |
| Pretend friend | cara bréige (gen. "an charad bhréige") |
| Advanced | Ardleibhéal |
| Starter team | foireann tosaigh |
| tidy | cuir in ord |
| comment | trácht (pl. tráchtanna) |
| snapshot (commit) | grianghraf |

## For the reviewer (answered)
- Mutations around `{name}`, `{who}`, `{col}`, `{project}`: names sit after "le", "ó", "chuig", "ag", "do", where Irish does not mutate a name in writing. Where a column name followed "i"/"go", it became "go dtí" or a colon ("Cárta nua: {col}").
- Genitives: checked; fixed "an chineál", "na tosaíochta" (lanes now "Sraith do gach ..."), "an chara" ("an charad").
- "bior", "Duitse", "Le déanamh": fine on a kanban board; kept.
- `col.verify`: now "Le {{dev:test}} agatsa".
- "Token" kept as a loanword, as Irish tech writing does.
- Short time units: fine.

## Review (AIG-489)
Changed 173 values. Main points:
- Plurals: all 8 plural keys are objects with one/two/few/many/other and lenition/eclipsis ("chárta / gcárta", "fhoireann / bhfoireann", "cheannaire / gceannaire", "huaire / n-uaire").
- Numbers in plain strings: no noun after `{n}` any more (`poke.many`, `quiet.sent`, `inbox.sum.*`, `inbox.badge.q.many`, `inbox.notify.many`, `dms.count.many`, `share.lane.replies`, `ofl.counts`, `ask.long`, `ask.size` ...).
- Mutations and grammar: "i dteirminéal", "sa tSocrú" (all), "san fhillteán", "i m’fhoireann", "d’fhreagra", "do m’fhoireann", "ar shliseog", "mar thábla", "an ghluais", "ina codladh" for a team, "ar fud gach tionscadal".
- Wrong meaning: "Cé go" (although) used for "while" in `watch.help`, `watch.morning`, `pretend.help`, `fx.sum.h`, now "Fad is"; "Buail an tsnáthaid" for crack the whip, now "An fhuip amach"; "Athfhreagairt" for refresher, now "Meabhrúchán"; "Léargas" for snapshot, now "Grianghraf"; "in order" (English) now "in ord"; "Aon cheann" for None, now "Dada"; "Casta" for Advanced, now "Ardleibhéal"; "Seirbhís" for errand, now "Teachtaireacht".
- Odd sentences rewritten: `views.intro`, `tour.inbox.why`, `card.stale`, `runin.cmd.help`, `share.switch.off`, `share.allow.teamRead`, `budget.pace`, `ofl.renamed`.
- Strings whose English had moved on: `board.team` (👥), `wz.adv.roles.h/sub`, `wz.adv.row.roles`.

Still for a human native speaker:
- "i tokens" (loanword after "i") left unmutated.
- `card.wait` "Fan go bhfeicfidh tú" and `tour.lvl.new` "Nua anseo" are free choices.
- `ask.long` "Carachtair ar a mhéad i gceist: {n}" avoids a mutating number; a native may prefer another shape.
- 181 newer English keys are not in ga.json yet and show in English.
