---
title: Change cards
journeys: Ask for a change, Get a go or no go, Put a change live
status: new
features: AIG-857, AIG-858, AIG-859, AIG-861
---
How a change gets asked for, approved and put live. Three levels; the Setup help level picks the default: all the help = full course, some help = step by step, no help = highlights.

## Highlights
- A **change** 🔀 is a card that asks to alter live: what, why, how to undo it.

- Named people vote **Go** or **No go**.

- One **No go** sends it back to To do with their note.

- It goes live (moves to done) only inside a change window.

- It can link back to the incident or problem it came from.

## Step by step
1. Raise it: **🔀 Raise a change**, or **🔀 Raise a change for this** on an incident or problem.

2. Fill in **What**, **Why**, **How to undo**. Pick a **Kind** and a **Risk** if you have one. Set **Planned for** (From, To).

3. Click **Raise change**. CLI: `aigile change <proj> add "Move to new host" --kind fix --what ".." --why ".." --undo ".."`.

4. Click **Submit for go**. CLI: `aigile change <proj> AIG-20 submit`.

5. Each approver clicks **Go** or **No go**. A note is needed for No go. CLI: `aigile change <proj> AIG-20 go "ok"` or `nogo "what has to change"`.

6. All Go: the panel says **Approved: it may go live**.

7. One No go: the card goes back to To do, and the note is a comment. Fix it, then **Submit for go** again (round 2).

8. The owner can click **Go anyway** to override. It is logged as a decision.

9. Check the window: `aigile golive-ok <proj> --card AIG-20`. Then move the card to done.

10. A call is planned? Click **📞 Join call** on the card.

## Full course
- **Why it matters:** a change is the main way live breaks. Asking first, with a way back, keeps it small.

- **Fields:** **What** and **Why** in plain words. **How to undo** is needed before you can submit. **Risk** links one from the risk register, else the card says **No risk logged**. **Planned for** is the go-live slot.

- **Came from / Problems it fixes:** the card shows the incident or problem it came from. A problem lists the change that fixes it, and stays open until that change is done.

- **Approvers:** default is the dev lead, test lead and owner. Roles left unset are skipped; none set means the owner only. Nobody votes on a change they raised or work on; the owner takes that vote.

- **Votes:** the panel shows **no vote yet** for anyone waiting. Votes from friends on a shared board count too, by their change role.

- **Approvals tab:** a submitted change shows there for each approver who has not voted.

- **Change windows:** the owner sets them in the 🎨 Look dialog (**🔀 Change windows**), one per line, like `tue 20:00-22:00 Release`. Empty means any time. Or `aigile change-windows <proj> set "tue 20:00-22:00 Release"`.

- **Outside a window:** moving to done is refused and tells you the next window. The card shows **Next window**.

- **Emergency change:** raised from an open incident, it needs only the owner and may go live outside a window. The post-mortem still applies.

- **Call link:** one link per project or per change (Meet, Jitsi, Discord or Teams). **📞 Join call** opens it in a new tab. The call tool does the video and screen sharing.

## Related
- [Incidents and problems](incidents-problems.md)
- [Change roles](../07-friends/change-roles.md)
- Change control: `docs/CHANGE-CONTROL.md`
