---
title: Service management
journeys: Run a project as a service
status: new
features: AIG-1045, AIG-1158
---
How to run what you have built so the people using it get a reliable service. Three levels; the Help level you picked in the Help menu chooses which one opens first: all the help = full course, some help = step by step, no help = highlights.

## Highlights
- Tell the board which projects are **services**: what they offer, who uses them and their web address. The board then watches the address for you.
- When a service stops answering, the board raises **one incident** by itself. A card that waits too long shows a red ⏰ "reply by" clock.
- A really bad incident gets the **🚨 Major** button: one click wakes the right agent and tells you. A public status page shows friends what is up.
- What you learn is kept: **🧩 Known errors**, **📖 Runbooks** (how to fix X) and a **📝 Post-incident review** on each major incident.
- Keep an eye on the **🗂️ Items** your service stands on (expiry dates, backups), the **🔐 Access review** every 90 days, **🚀 Releases**, the **📈 Improvements** list and, once a month, the **📆 Review** (with an optional monthly token cap).

## Step by step
1. On the project board click **🎨 Look**. In the **Project settings** dialog find the **🛎️ Service** section. Tick **This project is a service** and fill in what it offers, who uses it and its web address.
2. Choose the **On-call agent** (the lead by default) and tick **Public** if friends may see it on the status page. Optionally type a **Monthly token cap** so one project cannot eat the whole budget. Click **Save**.
3. Look at the project's dot on **Home**: green means the address answers. If it stops answering, an incident card appears by itself.
4. Open that incident card. A bad one? Click **🚨 Major**. Click **End major incident** when it is over.
5. Cards that wait too long show a red ⏰. Open them first. The inbox filter **Desk: incidents** shows only incidents from friends and the feedback form.
6. Click **⋯ More** on the board, then **🗂️ Items**. Click **+ Add item** for each server, domain, certificate, key, repo or supplier. Add an expiry date and, for data, where it is backed up and how often. Click **Backed up today** after each backup.
7. On an incident card, look at the **📖 Runbooks** box: it lists the how-to notes that match. Click **Open** to read one.
8. After a major incident is done, its card shows **📝 Post-incident review**. Read the timeline, then click **Make a card** next to each thing worth changing.
9. Click **⋯ More**, then **🧩 Known errors** to see problems that have a workaround. Click **🚀 Releases**, type a name like v1.3 and click **🚀 New release** to gather the done cards into notes. **↩ Roll back** files an undo checklist card.
10. Click **⋯ More**, then **📆 Review** once a month: use **← Earlier** and **Later →** to change month, and **✍️ Summary** for a two-line summary from the on-call agent.
11. Click **⋯ More**, then **📈 Improvements** (also in the **❓ Help** menu) to see retro ideas, review actions and problem fixes in one list. In **Setup**, click **Run access review now** to see who can get in, then **Keep** or **Remove** each one.

## Full course
- **Service details:** in **🎨 Look**, **Project settings**, **🛎️ Service** you say what a project offers, to whom, at what web address and who is on call. Only projects you tick count as services.
- **Uptime dot:** every few minutes the board asks the web address if it is alive. Green is fine; red means it did not answer. Three misses in a row open one incident, never a pile, and a comment says when it was back ("Up again after N min").
- **Reply-by ⏰:** each kind of card has a time to reply by (an incident about an hour, a friend request a couple of days, a bug about a week). Late cards go red and the daily brief lists them. These are aims, not promises.
- **🚨 Major:** for an incident that hurts many users or risks money or data. One click turns on the swarm, wakes the on-call agent, sends you one note and asks for a "Status:" comment every 30 minutes.
- **Status page:** a public page shows each public service as green, orange or red with the latest status line. It never shows card text, only the line you or the agent chose.
- **Service desk:** reports from friends and the feedback form are sorted into **Request**, **Incident** or **Idea**. The inbox filter (**Desk: all**, **Desk: requests** and so on) shows one kind. A report that looks like a card you already have says "looks like AIG-12" with a **Link** button.
- **🧩 Known errors:** a problem with a known cause and a workaround that is not done yet. They are listed per project and for all projects, and go into each agent's brief, so nobody investigates twice.
- **📖 Runbooks:** short step-by-step notes on how to fix a thing. An incident card shows the ones that match its title. After a review, the agent can propose a new runbook and you say Go or Not yet.
- **📝 Post-incident review:** after a major incident is done, the agent writes a **Timeline**, **What helped** and **What to change**. Each action becomes a card with **Make a card**. If no agent is free, you write it yourself.
- **🗂️ Items:** the list of things a service stands on, with a **Kind** (server, domain, certificate, key, repo, supplier, other). Each can have links to cards or web addresses. A key is only its name from Secrets, never the key itself. Incident and change cards can show what they **Affect**.
- **Expiry and backups:** each day the board checks expiry dates and backup age. A card appears before something runs out or when a backup is too old, and once a month a restore-test card reminds you that a backup you never tried to restore is only a hope.
- **Server health:** the board watches CPU, memory and disk on your servers and raises an upgrade card before they fill up.
- **🔐 Access review:** every 90 days one card lists share links, friends' roles and kept secrets (names only), each with **Keep** or **Remove**. Run it now from **Setup**.
- **🚀 Releases:** a release is a named bundle of the cards that became done since the last one, with short notes. **↩ Roll back** files a checklist card with the undo steps.
- **📈 Improvements:** retro suggestions, review actions and problem fixes in one list, filterable by project, so good ideas do not get lost between retros.
- **📆 Monthly review:** one page per service for one month: incidents opened and closed, average time to fix, cards that met their reply-by target, uptime, tokens used and server peaks. Open it from **⋯ More → 📆 Review** or from **Project settings → Service**.
- **Monthly token cap:** in **Project settings → Service** you can set a monthly limit of tokens. At 80% the daily brief warns you; at 100% background runs for that project wait until next month or until you raise the cap. Your own Wake still works.
- **Good habits:** fill in the service details first, keep the web address correct, look at the status dot daily, write up every major incident and check the improvements list after each retro, and read the monthly review while the month is fresh.

## For agents
- Raise an incident: `aigile add <proj> "Site is down" --type incident`
- Problem cause and workaround: `aigile problem <proj> AIG-9 --cause "..." --workaround "..."`
- Configuration items: `aigile ci <proj>` lists them; `aigile ci <proj> add <kind> <name>` adds one
- Runbooks: `aigile runbook <proj>` lists them; `aigile runbook <proj> <name>` prints one
- Major incident (owner or lead): `aigile major <proj> <incident id> --as NAME`; run it again to end it
- Post-incident review: `aigile pir <proj> <incident id> --timeline ".." --helped ".." --actions "one | two" --as NAME`
- Runbook from a review: `aigile pir-runbook <proj> <incident id> <name> --text ".." --as NAME`
- Releases: `aigile release <proj>` lists; `aigile release <proj> <name> --as NAME` makes one; add `rollback` to undo it

## Related
- [Incidents and problems](../03-cards/incidents-problems.md)
- [Change cards](../03-cards/changes.md)
- Plan: `docs/SERVICE-MGMT-PLAN.md`
