---
title: Service management
journeys: Run a project as a service
status: new
features: AIG-1045, AIG-1158
---
How to run what you have built so the people using it get a reliable service. Three levels; the Help level you picked in the Help menu chooses which one opens first: all the help = full course, some help = step by step, no help = highlights.

## Highlights
- Tell the board which projects are **services**: what they offer, who uses them and their web address. The board then watches the address for you.
- When a service stops answering, the board raises **one incident** by itself. When a card waits too long you see a red ⏰ "reply by" clock.
- A really bad incident gets the **🚨 Major** button: one click wakes the right agent and tells you. A public status page shows friends what is up.
- What you learn is kept: **known errors**, **runbooks** (how to fix X) and **incident reviews**, so the same fire is fixed the same way, faster.
- Once a month look at the **service review**: incidents, fix times, tokens used, and the **improvements** list. Keep an eye on items that expire, backups and who has access.

## Step by step
1. Open the project, then **Look**, then **Service**. Tick **This project is a service** and fill in what it offers, who uses it and its web address.
2. Choose the **on-call agent** (the lead by default) and tick **Public** if friends may see it on the status page.
3. Look at the project's dot on the home page: green means the address answers. If it goes down, an incident card appears by itself.
4. Open that incident card. A bad one? Press **🚨 Major**. Press **End major incident** when it is over.
5. Cards that wait too long show a red ⏰. Open them first.
6. Click **🗂️ Items** on the board to list the servers, domains, certificates, keys, repos and suppliers the service depends on. Add an expiry date and, for data, where it is backed up and how often.
7. Link an item to an incident or change card so the item remembers its history.
8. When the incident is solved, fill in the review. Tick the actions you want; each becomes a card.
9. Once a month open the **monthly review** for the service and read the improvements list. Say Go to the ones that are worth it.
10. Set a monthly **token cap** on a busy project so it cannot eat the whole budget.

## Full course
- **Service details:** in **Look**, **Service** you say what a project offers, to whom, at what web address and who is on call. Without this the board cannot look after it. Only projects you tick count as services.
- **Uptime dot:** every few minutes the board asks the web address if it is alive. A green dot is fine; red means it did not answer. Three misses in a row open one incident, never a pile, and a comment says when it was back.
- **Reply-by ⏰:** each card type has a target (an incident about an hour, a friend request a couple of days, a bug about a week). Late cards go red and the daily brief lists them. These are aims, not promises.
- **🚨 Major:** for an incident that hurts many users or risks money or data. One click turns on the swarm, wakes the on-call agent, sends you one note and asks for a short status line every 30 minutes.
- **Status page:** a public page shows each public service as green, orange or red with the latest status line. It never shows card text, only the line you or the agent chose.
- **Service desk:** reports from friends and the feedback form are sorted into request, incident or idea. A filter in the inbox shows one kind. If a report looks like one you already have, it says "looks like AIG-12" and you can link them.
- **Known errors:** a problem with a known cause and workaround. They are listed in one place and put in each agent's daily brief, so nobody investigates twice.
- **Runbooks:** short step-by-step notes on how to fix a thing. An incident card shows the runbooks that match it. After a review the agent can suggest a new one and you say Go or Not yet.
- **Incident reviews:** after a major incident the agent drafts the timeline, what helped and what to change from the card's comments. You tick the actions; each becomes a card.
- **Items (configuration items):** the list of things a service stands on. Each can carry links to cards or web addresses, an expiry date and a backup rule. A key is only its name from Secrets, never the key itself.
- **Expiry and backups:** each day the board checks expiry dates and backup age. A card appears 30 days before something runs out or when a backup is too old, and once a month a restore-test card reminds you that a backup you never tried to restore is only a hope.
- **Server health:** the board watches CPU, memory and disk on your servers that can answer, and raises an upgrade card before they fill up.
- **Access review:** every three months one card lists the share links, friends' roles and kept keys, each with keep or remove. Old access is a risk, so remove what is not needed.
- **Releases:** a release is a named bundle of done changes with notes and a way back. Name one, check the notes and roll back if it goes wrong.
- **Monthly service review:** one page per service with incidents, average fix time, targets met, tokens and server use for last month.
- **Token cap:** a monthly limit per project. At 80% the brief says so; at 100% background runs for that project pause with a clear reason until you raise it.
- **Improvements:** retro ideas, review actions and problem fixes in one list with a status, so good ideas do not get lost between retros.
- **Good habits:** fill in the service details first, keep the web address correct, glance at the status dot daily, review every major incident, and do the monthly review while it is fresh.

## For agents
- Raise an incident: `aigile add <proj> "Site is down" --type incident`
- Runbooks: `aigile runbook <proj> [name]`
- Known errors and problems: `aigile problem <proj> AIG-9 --cause "..." --workaround "..."`
- Your brief lists known errors, late cards and the token cap: `aigile brief <proj>`

## Related
- [Incidents and problems](../03-cards/incidents-problems.md)
- [Change cards](../03-cards/changes.md)
- Plan: `docs/SERVICE-MGMT-PLAN.md`
