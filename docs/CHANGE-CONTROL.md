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

## Incidents and problems (AIG-886, spec for AIG-614, AIG-887, AIG-888)

Three kinds of card, one chain: an incident says "live is broken", a problem says "this keeps breaking and here is why", a change request carries the fix (AIG-855/857).

- **Incident card (exists, AIG-614):** card type `incident`, 🔥. It tops Next up and the brief, has a red edge on the board, and cannot be done without the post-mortem (`postmortem`: happened, why, change). The `postmortem` rail turns the check off.
- **Risk that happens:** setting a risk (AIG-863) to `happened` files an incident card; the card holds `riskId`, the risk holds `incident`.
- **Problem card (AIG-887):** card type `problem`, 🧩, high priority. Fields: `rootCause`, `workaround` (what to do until it is fixed), `incidents` (ids) and `changeId` (the change request card with the fix). Stored on the card, so old projects need no change.
- **Incident to problem:** one incident belongs to at most one problem. Linking is both ways: `incidents` on the problem, `problemId` on each incident. Linking an incident to a second problem moves it.
- **Problem to change request:** `changeId` points at the change card that fixes it. The problem stays open until that change is done; closing the incident does not close the problem.
- **Order of work:** incident first (stop the damage, use the workaround), then the post-mortem, then group repeats into a problem, then raise a change request for the root cause.
- **Where:** `lib/problems.js`, routes `GET|POST /api/projects/:slug/problems`, `PATCH .../problems/:id`, `POST .../problems/:id/link {incident}`; CLI `aigile problem`; the open card shows root cause, workaround, incidents and the change request.
- **Guide:** `docs/guide/outline/03-cards/incidents-problems.md`, in three levels that follow the Setup help level (highlights, step by step, full course).
- **Not done:** the change card type itself (AIG-857) is separate, so `changeId` takes any card on the board for now. A friend on a shared board cannot raise a problem.

## Change system (AIG-855..861)

One chain: a problem or an idea becomes a change card; named people say Go or No go; it goes live only in a change window; it can be undone. Built on what exists: card types (store.js `TYPES`), friends' roles (share-base.js `CAN`), Approvals (AIG-814/815), the risk register (AIG-863), the change calendar (AIG-615) and 🚦 Ready for go (AIG-828).

### Roles (AIG-856)

- Change roles sit on top of a friend's share role (viewer..admin) and never replace it. Only the owner sets them.
- **Owner:** everything. Sets roles, approvers and windows, votes, and may "Go anyway" (overrides the chain; logged as a decision).
- **Project manager (PM):** picked per friend per project (one or more). Raises change cards, sets their approvers and window, submits them for go, votes. Sees the project's change cards in their Approvals tab.
- **Test lead:** one per project. Votes on every change by default; gets the tester verdict on change cards even with a lower share role.
- **Dev lead:** one per project. Votes on every change by default; may fill or fix "how to undo" on any change card.
- A role holder is a "who": a roster name (agent or person) or `@<contactId>` for a friend.
- Nobody votes on a change they raised or are assigned to; the owner takes that vote.

### Change card (AIG-857)

- New card type `change` (🔀) in `TYPES`. Friends' `MEMBER.raise` leaves it out, as with `problem`; a PM may raise it.
- Fields live in one object `c.change`, so they never clash with the queue `kind` or the size label `risk`:
  - `kind`: `change` | `feature` | `fix` | `other`
  - `what`, `why`, `undo` (how to undo; required before submit): text, 600 chars each
  - `riskId`: a risk in the register (`data/<slug>.risks`); none = "no risk logged" on the card
  - `when`: `{ from, to }` ISO times, the planned go-live slot (must fit a window, AIG-859)
  - `from`: the incident or problem id it came from, if any
- **Problems:** `changeId` on a problem must now point at a `change` card (old links to other cards stay readable). The change card lists the problems whose `changeId` is its id (a scan, no back field). The problem stays open until the change is done (existing `problems.checkDone`).
- **Incidents:** "Raise a change" on an incident or problem fills `from` and the title. An emergency change (`from` an open incident) defaults to owner-only approval and may go live outside a window; the post-mortem still applies.
- Copy to another board drops `change.riskId` (strip list in projects-cards.js, beside `changeId`).

### Go / no-go chain (AIG-858)

- `c.change.approvers`: list of "who". Default on submit: dev lead, test lead, owner (unset roles skipped; none = owner only).
- `c.change.votes`: `{ who: { go: true|false, note, at } }`; `c.change.round`: 1, 2, ...; past rounds in `c.change.rounds` (last 10).
- Submit sets the AIG-814 field `approval: 'waiting'`, so the card shows in the Approvals tab (AIG-815) for each approver with no vote yet. No second inbox, no second waiting flag.
- Go / No go with a note (required for No go). All approvers Go = the chain calls the Approvals module's own approve, so `approval` ends exactly as an owner Approve would.
- One No go = the Approvals decline path: card back to To do, the note as a comment to the author, round closed. Re-submit starts a new round with empty votes.
- The owner's Approve / Decline in the Approvals tab on a change card counts as the owner's vote, not an override; "Go anyway" is the only override.
- A friend's vote comes over the share link like a comment (new message kind `vote`), checked against that link's change role on my board.
- Same idea as 🚦 Ready for go (kind `plan`): a change card with only the owner as approver behaves like one.

### Change windows (AIG-859)

- `p.changeWindows`: `[{ day, from, to, label }]`, the same shape and `changecal.clean` / `current` as quiet times. None = any time.
- Go live = moving a change card to done. Allowed when approved, inside a window (if any) and not in a quiet time (`quietTimes` rail, as now). Otherwise the route refuses with "next window: Tue 20:00". Emergency changes skip the window only.
- `aigile golive-ok <proj> [--card <id>]` adds the window and approval check; the brief shows "Next change window: ..." while an approved change waits.

### Guides (AIG-860)

- `docs/guide/outline/03-cards/changes.md` and `07-friends/change-roles.md`, three levels like `incidents-problems.md`: change card, go / no-go, windows, and the links to incidents and problems.

### Calls and screen sharing (AIG-861)

- A "Join call" link only: `p.callUrl` per project and `c.change.callUrl` per change (Meet, Jitsi, Discord or Teams), shown on stand-ups, change cards and DMs. Screen sharing is the call tool's own; no media inside AI-gile.

### Data, routes, CLI and files per card

- **856:** `p.changeRoles = { pm: ['@contactId'], testLead: 'who', devLead: 'who' }`. `GET|POST /api/projects/:slug/change-roles` (owner only). CLI `aigile change-roles <proj> [--pm add|remove <friend>] [--test-lead who] [--dev-lead who]`. Files: new `lib/changeroles.js`, `lib/routes/changeroles.js`; `lib/share-base.js` (`canOf` adds the change role), `lib/share.js` (tell the friend their role), `public/js/share.js` (pickers in the Share dialog), `lib/cli/cmds-team.js`. Texts `chgrole.*`. QA `changeroles`.
- **857:** `TYPES` + `change`; `c.change {kind, what, why, undo, riskId, when, from}`. `GET|POST /api/projects/:slug/changes`, `PATCH .../changes/:id`. CLI `aigile change <proj> [add "title" --kind fix --what .. --why .. --undo .. --risk R-1 --when "from..to" | <id> --what ..]`. Files: `lib/store.js` (TYPES), new `lib/changes.js`, `lib/routes/changes.js`, `lib/cli/cmds-changes.js`, new `public/js/changes.js` (`changeHtml`; one line in card.js calls it), `lib/problems.js` (changeId check), `lib/routes/projects-cards.js` (strip list). Texts `chg.*`, `type.change`. QA `changes`.
- **858:** `c.change {approvers, votes, round, rounds}` + `approval`. `POST .../changes/:id/submit`, `POST .../changes/:id/vote {go, note}`, `POST .../changes/:id/go-anyway`. CLI `aigile change <proj> <id> submit | go "note" | nogo "note"`. Files: new `lib/gonogo.js` (calls the AIG-814 approvals module), routes added to `lib/routes/changes.js`, `lib/cli/cmds-changes.js`, `lib/share.js` (`vote` message), `public/js/changes.js` (vote panel), the AIG-815 Approvals tab (one filter line). Texts `gonogo.*`. QA `gonogo`.
- **859:** `p.changeWindows`. `GET|POST /api/projects/:slug/change-windows`. CLI `aigile change-windows <proj> [set "tue 20:00-22:00 Release"]`, `golive-ok --card`. Files: new `lib/changewin.js` (uses `lib/changecal.js`), `lib/routes/changewin.js`, `lib/cli/cmds-read.js` (golive-ok, brief), the done check in `lib/routes/projects-cards.js` (next to the post-mortem check), a windows box in the 🎨 Look dialog beside DoD. Texts `chgwin.*`. QA `changewin`.
- **860:** the two guide files only.
- **861:** `p.callUrl`, `c.change.callUrl` (plain PATCH fields). Files: `lib/store.js` (project field), `public/js/standup.js`, `public/js/dms.js`, `public/js/changes.js` (the link). Texts `call.*`. QA `calllink`.
- Shared files only take added lines (`lib/routes.js` one require each, `lib/cli/help.js`, `public/lang/en.json`, `public/index.html` script tag, one `docs/CODEMAP.md` bullet each): on merge keep both sides.

### Build order

1. In parallel: **856** (roles), **857** (change card), **859** (windows), **861** (call link). 861 adds its card link once 857's `public/js/changes.js` is in.
2. **858** (go / no-go) after 856, 857 and Approvals (AIG-814/815) are merged.
3. Then 859's done check adds "approved" (one line, after 858).
4. **860** (guides) last, from what was built.
