---
title: Incidents and problems
journeys: Handle an incident, Find the cause of repeat incidents
status: new
features: AIG-614, AIG-887, AIG-888
---
What to do when live breaks (incident), and how to stop it breaking again (problem and change request). Three levels; the Help level you picked in the Help menu chooses which one opens first: all the help = full course, some help = step by step, no help = highlights.

## Highlights
- An **incident** 🔥 is a card for "it is broken now". It jumps the queue and has a red edge.
- Closing it asks three short questions: what happened, why, what we change.
- If the same thing breaks again, group the incidents under one **problem** 🧩 with its root cause and a workaround.
- The real fix goes through a change request.

## Step by step
1. Raise the incident: **New card**, type **🔥 incident**.
2. Fix it first. Use the workaround if the problem card has one.
3. Move it to done. Fill in **What happened**, **Why**, **What we change**, then **Done**.
4. It happened before? Ask your lead to group the incidents under a **🧩 problem** card (the commands are under *For agents*).
5. The problem card shows the **Root cause**, the **Workaround**, the incidents and the change request.
6. Later incidents join the same problem; the card lists them all.
7. Raise a change request for the fix. The problem stays open until that change is done.

## For agents
- Raise an incident: `aigile add <proj> "Site is down" --type incident`
- Make a problem: `aigile problem <proj> add "Deploys break the site" --incidents AIG-1,AIG-2`
- Cause and workaround: `aigile problem <proj> AIG-9 --cause "..." --workaround "..."`
- Link a later incident: `aigile problem <proj> AIG-9 link AIG-12`
- Link the change request: `aigile problem <proj> AIG-9 --change AIG-20`

## Full course
- **Why it matters:** an incident is about getting back to normal fast. A problem is about the cause. Mixing them means you fix the same fire again and again.
- **Incident:** the post-mortem has no blame. It says what happened, why, and what changes so it does not repeat. A risk from the risk register that happens files an incident for you.
- **Problem:** one cause, many incidents. Root cause is the reason behind the reason (not "the server was down" but "the deploy script skips the tests"). The workaround is what anyone does until the fix ships.
- **Linking:** an incident belongs to one problem. Linking shows on both cards. Linking it to another problem moves it.
- **Change request:** the fix is a change like any other, with a reason, a risk and a way back. The problem stays open until that change is done.
- **Good habits:** look at open problems in each retro; if three incidents share a cause, make the problem; keep workarounds short enough to follow while stressed.

## Related
- [Raise a bug](raise-bug.md)
- [Raise a card](new-card.md)
- Change control: `docs/CHANGE-CONTROL.md`
