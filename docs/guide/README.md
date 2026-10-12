# AI-gile guide: site plan (AIG-425)

Outline only for now. No screenshots and no full guide text: the UI changes too often.

## Sections (outline/<section>/<page>.md)
01-start First run and setup | 02-boards Boards and projects | 03-cards Cards | 04-foryou For you and inbox | 05-teams Teams and AI | 06-tokens Tokens and budget | 07-friends Friends and sharing | 08-reallife Real life, night and focus | 09-look Look and settings | 10-help Help and later

`journeys.md` lists every user journey, one line each, linked to its page.

## Page template
```
---
title: Short name
journeys: Verb the thing
status: placeholder | changed | written
features: AIG-xxx, AIG-yyy
---
One line: what it is for.
## How to      (numbered steps, short, exact button names)
## Tips        (2-3 bullets)
## Related     (links to other pages)
```
Wording: the owner's words, short sentences, **bold** what to click. Same page names in every language.

## Languages
`docs/guide/en/` first, then `nl/` (Nederland) and `nl-BE/` (Vlaams), same file names and front-matter. Translate only pages with status `written`, reusing the app's language files (docs/lang) for button names. Until then `outline/` is the English source.

## Where it lives
Plain Markdown in docs/guide now. Later built into a static `site/` hosted on aigile.lol: one page per file, a language switcher, and no screenshots until the UI settles.

## Upkeep rule (every team)
When you hand over a feature that changes what the owner sees, update the matching outline page. It is a one-line job:
- add, remove or rename a bullet (or add your AIG number to `features:`)
- if the steps changed, set `status: changed`
- new journey with no page? add one line to journeys.md and a stub from the template

A writer later turns `placeholder` and `changed` pages into `written`.
