---
title: Incidents and problems
journeys: Handle an incident, Find the cause of repeat incidents
status: new
features: AIG-614, AIG-887, AIG-888
---
What to do when live breaks (incident), and how to stop it breaking again (problem and change request). Three levels; the Setup help level picks the default: all the help = full course, some help = step by step, no help = highlights.

## Highlights
- An **incident** 🔥 is a card for "it is broken now". It jumps the queue and has a red edge.
- Closing it asks three short questions: what happened, why, what we change.
- If the same thing breaks again, group the incidents under one **problem** 🧩 with its root cause and a workaround.
- The real fix goes through a change request.

## Step by step
1. Raise the incident: **New card**, type **🔥 incident**, or `aigile add <proj> "Site is down" --type incident`.
2. Fix it first. Use the workaround if the problem card has one.
3. Move it to done. Fill in **What happened**, **Why**, **What we change**, then **Done**.
4. It happened before? Make a problem: `aigile problem <proj> add "Deploys break the site" --incidents AIG-1,AIG-2`.
5. Fill in the cause and the workaround: `aigile problem <proj> AIG-9 --cause "..." --workaround "..."`.
6. Add later incidents with `aigile problem <proj> AIG-9 link AIG-12`.
7. Raise a change request for the fix and link it: `aigile problem <proj> AIG-9 --change AIG-20`.
8. Open the problem card: root cause, workaround, incidents and the change request are all shown.

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
