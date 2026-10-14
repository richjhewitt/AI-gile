# Change control and pro practice, by skill level (AIG-564)

What a professional tech team does to ship safely, and how AI-gile could do each part for people at every level.

## What pro teams do

- **Change control:** every change has a reason (a card), a reviewer and a way back. Big or risky changes are planned before they are built.
- **Reviews:** a second pair of eyes on every change before it ships. The reviewer checks the code, the tests and the "why".
- **Branches and merges:** work happens on its own branch and only merges when the checks are green.
- **Automated checks:** tests run on every change, and a red result blocks the merge.
- **Releases:** changes ship in named builds on a schedule, with notes on what changed. Builds go to testers first, then to everyone.
- **Roll back:** any build can be undone quickly, without losing data.
- **Incidents:** when something breaks live, the team fixes it first, then writes a short "what happened, why, what we change" note with no blame.
- **Decision log:** decisions are written down with their reasons, so nobody has to guess later.

## What AI-gile already does

- Cards for every change, a decision log (`log --decision`), Team checking (`review`) and For you to test (`test`).
- QA areas that click through the real page, and agents that work on their own branches and merge after checks.
- The 🌙 Assumptions page for calls made while the owner is away.

## Gaps, and how the app could fill them

- **Releases:** channels (Stable daily, Live), release notes from done cards, and roll back. Cards AIG-560 to AIG-563.
- **Risk label on a card:** small, normal or risky. A risky card needs a plan approved before it is built, and a reviewer of a higher model.
- **Merge gate:** a branch can't go live until its QA areas and the whole suite are green. The board shows the gate on the card.
- **Incident card:** a 🔥 card type for "broken live". It jumps the queue, and closing it asks for the three-line note.
- **Change calendar:** quiet times (streams, demos, nights) when nothing goes live.

## By skill level

- **Beginner:** guard rails are on and hidden. Every change is reviewed, risky cards are planned first, and releases are automatic and roll back in one click. Plain words, with no "branch" or "merge".
- **Some experience:** the same rails, now visible. They can see the gate, pick a reviewer and read the release notes before an update.
- **Expert:** every rail is a setting. They can skip review on small cards, run their own release schedule and get the incident note template.
- Team templates (AIG-577) can start each level with the right rails switched on.

## Proposed cards

- Risk label on cards (small, normal, risky) and plan-first for risky cards
- Merge gate shown on the card (QA areas and full suite)
- 🔥 Incident card type with a three-line note on close
- Change calendar: quiet times with no going live
- Rails by skill level, linked to help levels
