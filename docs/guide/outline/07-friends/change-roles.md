---
title: Change roles
journeys: Give someone a change role
status: new
features: AIG-856, AIG-858
---
Who raises changes and who says go or no go. Three levels; the Setup help level picks the default: all the help = full course, some help = step by step, no help = highlights.

## Highlights
- Change roles sit on top of a friend's share role. They never replace it.

- Three roles: **Project manager**, **Test lead**, **Dev lead**.

- Only the owner sets them.

- The test lead and dev lead vote on every change by default.

## Step by step
1. Open the Share dialog and find the friend.

2. Under **Change roles**, pick **Project manager**, **Test lead** or **Dev lead**.

3. Or use the CLI: `aigile change-roles <proj> --pm add <friend>`.

4. Set the leads: `aigile change-roles <proj> --test-lead <who> --dev-lead <who>`.

5. Clear one with an empty name. Remove a PM with `--pm remove <friend>`.

6. The friend is told: "{name} made you: {roles}".

7. List them with `aigile change-roles <proj>`.

## Full course
- **Why it matters:** a change needs the right eyes. Roles say whose eyes.

- **Owner:** sets roles, approvers and windows, votes, and can **Go anyway**.

- **Project manager:** one or more. Raises change cards, sets approvers and window, clicks **Submit for go**, votes. Sees the project's changes in the Approvals tab.

- **Test lead:** one per project. Votes on every change by default. Gets the tester verdict on change cards even with a low share role.

- **Dev lead:** one per project. Votes on every change by default. Can fill or fix **How to undo** on any change card.

- **Who counts:** a roster name (agent or person), or a friend.

- **Who votes:** the approvers on the card. Default is dev lead, test lead and owner. Nobody votes on a change they raised or work on; the owner takes that vote.

- **Friends:** a friend's vote comes over the share link and is checked against their change role.

## Related
- [Change cards](../03-cards/changes.md)
- [People and roles](roles.md)
- Change control: `docs/CHANGE-CONTROL.md`
