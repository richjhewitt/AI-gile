# AI-gile in German (de)

Written by Babel for AIG-489, then checked value by value by a native-speaker reviewer (model).

## Register
- Casual **du** throughout (never Sie), matching LocoRadio's German and AI-gile's friendly English. Imperatives in du form ("Tipp", "Klick", "Füg ein", "Lass").
- Avoid a sentence that starts with a bare "Sie ..." or "Ihr ..." when it means "they/their": next to du it reads like the formal Sie. Name the subject instead ("Die Spalte enthält", "Das andere Board", "{name} antwortet").
- Standard German (Germany), ß spelling, German quotes avoided (the UI uses plain `"` as in the English file).
- Keyboard keys: Enter, **Umschalt** (not Shift), Esc.
- Durations: Min., Std., T. Dates follow de-DE.
- Plurals: neutral forms such as "Team(s)", "{n}-mal".
- `{{dev:...}}` markers kept around the whole German word ("{{dev:Testen}}", "{{dev:testest}}"). Backlog, Sprint, Bug, Commit, Test, Merge, Branch, Deploy are English loanwords as German software teams say them.
- "Agent" is a weak noun: des/dem/den **Agenten**, plural **Agenten** (not "Agents").

## Glossary
| English | German | Note |
|---|---|---|
| card | Karte | |
| board | Board | loanword |
| project | Projekt | |
| team | Team | |
| lead | Lead | "Teamlead" in running text, Lead Scrum Master kept |
| Scrum Master | Scrum Master | kept; referred to as "er" |
| For you | Für dich | |
| To do | Zu tun | |
| In progress / Doing | In Arbeit | |
| Team checking | Team prüft | |
| For the team | Fürs Team | |
| Verify column ("For you to test") | Zum Testen für dich | |
| Done | Erledigt | "Fertig" for dialog buttons |
| Backlog | Backlog | |
| sprint | Sprint | |
| stand-up | Stand-up | |
| inbox | Posteingang | |
| Setup | Einrichtung | |
| Usage | Verbrauch | |
| plan (Claude plan) | Tarif | |
| test | Test / testen | |
| test steps | Testschritte | "{{dev:Test}}schritte" where the marker applies; never "Teststeps" |
| AI tester passed / failed | bestanden / durchgefallen | |
| Send back | Zurückschicken | |
| Accept | Akzeptieren | |
| build (verb, "ask before every build") | Umsetzung | "Vor jeder Umsetzung fragen" |
| Wake (team) | Wecken | |
| Poke | Stups / anstupsen | button "👉 Anstupsen" |
| night watch | Nachtwache | night watchman = Nachtwächter |
| Going quiet / Go quiet | Funkstille / Funkstille starten | was "Ruhe bitte"; running text "dich ausklinken" |
| idle | im Leerlauf | |
| assumption | Annahme | "Plug this" = "Lücke schließen" |
| Come back… (timed) | Wiedervorlage… | |
| No Token Mode | No-Token-Modus | |
| token | Token | |
| agent | Agent (pl. Agenten) | |
| Look (🎨) | Look | kept, as on the button |
| Permissions | Berechtigungen | |
| Views | Ansichten | |
| DM | DM | |
| Pop out | Auslagern | |
| Group (cards) | Gruppe | |
| Space | Space | kept |
| Life board | Lebens-Board | "Real life" switch = "Alltag" |
| Focus | Fokus | |
| Checklist | Checkliste | |
| Hook | Hook | kept |
| Stuck | hängt | |

## Questions from the first pass, answered
- **"Teststeps" vs "Testschritte":** "Testschritte" everywhere (`lead.steps.help`, `tester.title`, `share.prev.intro` fixed); the card tab keeps `{{dev:Test}}schritte`.
- **"Stups"/"stupsen":** fine for the home pill and the help texts; the card button is now the verb "👉 Anstupsen", which reads better as a button than the noun.
- **"Look" and "Space":** kept. Both are common loanwords in German software UIs, short on buttons, and used consistently. "Aussehen" would undersell the 🎨 panel, which also holds team roles and run settings.
- **`sm.push.*` jokes:** "Die Teller am Drehen halten", "Immer sachte", "Gleichmäßig", "Eifrig", "Peitsche raus" are fine in tone.
- **Pretend friend "ihm"/"sein":** fine, the pretend friend is Davy. Real friends are now neutral ("{name} und den Chat entfernen?", "Code einfügen", "dieser Person").
- **Button length:** "Einladungscode erstellen", "Verbrauch jetzt prüfen", "Trotzdem zeigen" are acceptable. "Projekt aus dem Archiv holen" shortened to "📤 Aus dem Archiv holen"; "Alle von der KI bestandenen akzeptieren" to "Alle KI-bestandenen akzeptieren".

## Review
What changed (166 values):
- Formal-looking "Sie ..." sentences rewritten where "they" was meant (`standup.blockers`, `cols.hide.confirm`, `pack.ask`, `share.test.intro`, `share.teamRead.on`, `sb.never`, `dlg.conn.next.html`).
- Agent declension and plural: "des Agenten", "Agenten" (`usage.bars.explain`, `dms.filter.agents`, `face.lib`, `look.roles.count`, setup help texts).
- Going quiet is "Funkstille" (was "Ruhe bitte" / "Ruhe einkehren lassen"); idle is "im Leerlauf" (was "untätig").
- Wrong meanings fixed: `join.noStatus` (it said the join service could not ask), `pretend.auto` ("abhaken" means tick, the English says untick), `setup.next` ("auf dem Start"), `quiz.go`/`lead.go.*` ("Vor jedem Bau").
- Word order with time placeholders: "hat {when} gefragt", "ist {when} hängen geblieben", "Letztes Lebenszeichen von {name}: {when}".
- Keyboard hints use Umschalt+Enter.
- "Hat Jetzt nicht gesagt" became "hat vorerst abgelehnt"; "Teste…", "Prüfe…", "Füge hinzu…", "Installiere…", "Sendet…" status lines became passive or third person ("Wird getestet…", "Wird hinzugefügt…").
- Calques fixed: "Zeige nur Fragen", "Keine Karten passen", "Sieht richtig aus", "Bilder der Agents", "Nichts poppt auf", "Komm zurück…" (now "Wiedervorlage…"), "aus deinem Weg".
- The Setup switch name quoted in `sm.night.title` now matches `lead.watchAll` exactly.
- Column headers on the Usage page: "Ein"/"Aus" became "Eingabe"/"Ausgabe" (they read as on/off).

Still worth a human native speaker's eye:
- "Funkstille" for Going quiet: natural and short, but a native may prefer "Bin weg" or "Feierabend".
- "Wiedervorlage" is office German; it is exact but slightly formal for this casual UI.
- "Lebens-Board" and "Scheinfreund" are coined words; check they don't sound odd.
- "No-Token-Modus" and "Look" stay English; fine for developers, maybe less so for the "Lots of help" audience.
- Long labels: "🤝 Sicher Bestandenes wird erledigt", "📋 {name} mein ganzes Board zeigen (…)", "🔄 Verbrauch jetzt prüfen".
