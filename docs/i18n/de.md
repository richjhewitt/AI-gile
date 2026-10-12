# AI-gile in German (de), first pass

Written by Babel for AIG-489. A native-speaker model reviews it next.

## Register
- Casual **du** throughout (never Sie), matching LocoRadio's German and AI-gile's friendly English. Imperatives in du form ("Tipp", "Klick", "Füg ein", "Lass").
- Standard German (Germany), ß spelling, German quotes avoided (the UI uses plain `"` as in the English file).
- Durations: Min., Std., T. Dates follow de-DE.
- Plurals: neutral forms such as "Team(s)", "{n}-mal".
- `{{dev:...}}` markers kept around the whole German word ("{{dev:Testen}}", "{{dev:testest}}"). Backlog, Sprint, Bug, Commit, Test, Merge, Branch, Deploy are English loanwords as German software teams say them.

## Glossary
| English | German | Note |
|---|---|---|
| card | Karte | |
| board | Board | loanword |
| project | Projekt | |
| team | Team | |
| lead | Lead | "Teamlead" in running text, Lead Scrum Master kept |
| Scrum Master | Scrum Master | kept |
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
| test | Test / testen | |
| test steps | Teststeps | compound with the dev marker: "{{dev:Test}}schritte" in the card form |
| Send back | Zurückschicken | |
| Accept | Akzeptieren | |
| Wake (team) | Wecken | |
| Poke | Stups | |
| night watch | Nachtwache | night watchman = Nachtwächter |
| Going quiet | Ruhe bitte | |
| assumption | Annahme | |
| No Token Mode | No-Token-Modus | |
| token | Token | |
| agent | Agent | |
| Look (🎨) | Look | kept, as in "Look" on the button |
| Permissions | Berechtigungen | |
| Views | Ansichten | |
| DM | DM | |
| Pop out | Auslagern | |
| Group (cards) | Gruppe | |
| Space | Space | kept |
| Life board | Lebens-Board | |
| Focus | Fokus | |
| Checklist | Checkliste | |
| Hook | Hook | kept |
| Stuck | hängt | |

## For the reviewer
- "Teststeps" appears as a loanword compound in a few places and "Testschritte" is the pure German form; the card tab uses `{{dev:Test}}schritte`. Pick one.
- The poke concept is "Stups"/"stupsen"; check it is not too cute in the home pill and buttons.
- "Look" (🎨) and "Space" are left in English; consider "Aussehen" / "Bereich".
- Hand-written jokes in `sm.push.*` ("Die Teller am Drehen halten", "Peitsche raus") are idiomatic renderings; confirm tone.
- Gendered references to a friend ("mit ihm", "sein Board") in the Pretend friend keys follow the English "he/his".
- Check that button labels fit: "Einladungscode erstellen", "Verbrauch jetzt prüfen", "Trotzdem zeigen" are the longest.
