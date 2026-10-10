# Vlaams (nl-BE) glossary

The choices behind `public/lang/nl-BE.json`, for the reviewer. One translation per concept. "NL" = what Netherlands Dutch would usually say.

## Tone
- **je / jij / jouw**, not "u": a friendly app speaks informally in Flanders too. "Ge/gij" is spoken Flemish, too dialect for screen text.
- Short sentences, everyday words. Flemish markers are kept to words every Fleming writes too (bewaren, nota, verwittigen, vooraleer, binnen), no dialect.

## Board terms
| English | nl-BE | Why |
|---|---|---|
| card | kaart | Plain word; kept the same everywhere. |
| board | bord | As in "het bord". |
| Backlog | Backlog | Flemish teams say backlog. Kept the `{{dev:}}` marker. |
| To do | Te doen | |
| In progress / in flight / working | Bezig | One word for "busy with it"; also used for the team's presence ("Bezig in VS Code"), kept short so the header fits. NL often "Onderhanden". |
| Team checking | Team kijkt na | "Nakijken" is the everyday Flemish word for checking; NL leans to "controleren". |
| For you to test | Klaar voor jouw test | "test" is the same noun in Dutch, so the marker stays around the English word with no bracket. |
| For you (short) | Voor jou | |
| For the team | Voor het team | Also named in the reply box hint, same words. |
| Done (column, task, stand-up) | Gedaan | Flemish for "finished" ("'t is gedaan"); NL would say "Klaar" or "Afgerond". "Klaar" stays free for "ready" and the dialog button. |
| Done (button that closes a dialog) | Klaar | A different concept: "I'm finished here". |
| bug / sprint / commit / test | bug / sprint / commit / test | Flemish developers use the English words; no bracket. Marker kept. |
| feature | feature | Same; "functie" reads as "function". |
| task | taak | |
| Stand-up | Stand-up | Used as is in Flemish offices. Report = "Stand-up-verslag" (verslag is the usual Flemish word for a report). |
| Blockers | Blokkades | |
| blocked | geblokkeerd / zit vast | "zit vast" when a person is stuck, "geblokkeerd" as a status. |
| needs you | heeft jou nodig | |
| Poke | Duwtje | "Een duwtje geven" is the natural Flemish nudge; NL would rather "porren". |
| Wake | wekken / wakker maken | |
| lead / team lead | teamleider | A non-developer reads "lead" as lood (metal). |
| assignee | Toegewezen aan | |
| Lanes | Rijen | Explains itself (the title already says "rows"). |
| Views | Weergaven | |
| Permissions | Rechten | Shorter and what Flemings say for access rights; NL often "Machtigingen". |
| Look (colour and emoji) | Stijl | |
| Docs | Documenten | |
| Inbox | Inbox | Normal in Flanders. |
| Messages / DMs | Berichten | |
| Alerts | Meldingen | |
| Usage | Verbruik | Flemish "verbruik" (as on an energy bill); NL tends to "Gebruik". |
| plan | abonnement | |
| reading (of the usage meter) | meting | |
| resets | begint opnieuw | Avoids the English "reset". |
| Setup | Instellingen | |
| Archive / Unarchive | Archiveren / Terughalen | |
| Accept / Send back | Goedkeuren / Terugsturen | |
| Wait and see | Even afwachten | |
| Your call | Jij beslist | |

## Flemish rather than Netherlands Dutch
- **Bewaren** for Save (NL: Opslaan). Belgian software and banks use "bewaren".
- **Nota** for a note (NL: notitie).
- **Verwittigen** for "the team has been told" (NL: op de hoogte gebracht / laten weten).
- **Vooraleer** for "before" (NL: voordat).
- **Binnen {in}** for a time ahead: "begint opnieuw binnen 2u" (NL: over 2 uur).
- **u** for hours: "5u", "3u geleden" (NL: "5 uur", "3 uur geleden"); "min." for minutes.
- **bv.** for e.g. (NL: bijv.).
- **Aan het laden… / Aan het zoeken…** (Flemish loves "aan het" + verb; NL: Laden…, Zoeken…).
- **Herladen** for Refresh (NL: Vernieuwen).
- **Enkel** for "only" (NL: alleen).
- **Eender welke** for "any" (NL: elke willekeurige / om het even).
- **Zeg eens dag** (NL: zeg even hallo).
- **Pc** for "this computer" (deze pc).
- **Niks** in short lines (both use it, Flemish more so).

## Dev words
`{{dev:word}}` stays around the English term. The Flemish words chosen for dev terms are the English words themselves (backlog, sprint, bug, commit, test), so no bracket is written in this file. If a later card adds the English in brackets automatically, it should skip words that are already English, or "bug (bug)" will appear.
