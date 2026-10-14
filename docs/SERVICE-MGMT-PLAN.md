# Service management plan (AIG-1045)

**Service management** = running what we've built so the people using it get a reliable service, not just shipping features.
This plan builds on what exists. Everything new is plain code unless AI clearly earns its place, and is **off by default per project** (one tick turns it on).

## 1. What we already have

- 🔥 **Incident card** (AIG-614): "live is broken", jumps the queue, can't close without the 3-line post-mortem.
- 🧩 **Problem card** (AIG-887/888): groups repeat incidents, holds root cause, workaround and the fixing change.
- ⚠️ **Risk register** (AIG-863): score, review date; a risk set to "happened" files an incident.
- 🔀 **Change system** (AIG-855..861): change card with undo plan, roles, Go / No go votes, change windows, call link.
- ✅ **Approvals** (AIG-814/815): friend cards and change cards wait for a yes.
- 👀 **Peer review** (AIG-993/994): the other AI engine checks each handover.
- 🩺 **Server health** (AIG-660): relay CPU, memory and disk every 15 min; raises an "upgrade" card.
- 🚨 **Swarm** (AIG-822/901): everyone on one fire; other projects pause.
- 🔁 **Retros** (AIG-865): a suggested change to ways of working, Rich says Go.
- 💬 **Public feedback form** (AIG-968..970): website visitors' reports become bug cards.
- 🙋 **Feature requests** from friends (AIG-846), always held for approval.
- 📦 **Releases**: release notes, What's new, roll back (AIG-560..563, AIG-977).
- 🔑 **Secrets** (AIG-585..587), 🖥️ **My servers** (AIG-374), 🌍 **public boards** (AIG-602..605).
- 💰 **Token budget and No Token Mode** (AIG-353/356), token deep dive (AIG-522).
- ✔️ **Definition of Ready / Done** (AIG-864).

## 2. What's missing

Each item: what it is, why it helps Rich, and who does the work (**code** = plain code, no tokens; **AI** = an agent).

### A. Knowing what we run
- **Service catalogue** (a list of what each project offers, to whom, at what web address).
  - Why: one place to see "what's live, who uses it, who looks after it". Everything below hangs off it.
  - Code: a few fields on the project, shown on home.
- **Configuration items** (the things a service needs: servers, domains, certificates, keys, repos, outside suppliers).
  - Why: when something breaks, see what it depends on; when a domain or certificate is about to expire, know before it breaks.
  - Code: a list per project, linkable from incidents and changes. Expiry checks are plain code (certificate dates, domain dates).

### B. Hearing about trouble
- **Monitoring to incidents** (checks that open an incident by themselves).
  - Why: Rich hears about outages from the board, not from a friend.
  - Code: ping each service's address every 5 min; 3 fails in a row = one incident card (never a pile); back up = a comment. Extends server health.
- **Service desk** (one front door for friends and the public).
  - Why: friend asks, feedback-form reports and Discord messages land as clear request, incident or idea, not mixed bugs.
  - Code sorts by plain rules (form type, keywords). AI only for "is this a duplicate of an open card?", one cheap Haiku call, skippable.

### C. Answering in time
- **Response targets** (a "reply by" time per priority, e.g. incident 1 hour, request 2 days). Internal aims, not promises.
  - Why: nothing quietly rots; the brief says what's late.
  - Code: timers on the card, a brief line, a red clock on the board.
- **On-call** (which agent picks up an incident, per project).
  - Why: no guessing who acts at 3 am; Rich is only woken for the big ones.
  - Code: a project setting (the lead by default); an incident wakes that agent even during quiet time, never in No Token Mode.

### D. When it's really bad
- **Major incident flow** (a bigger incident: many users, money or data at risk).
  - Why: one button does the routine so Rich can think: swarm on, the right agent woken, Rich told on phone or Discord, status updates reminded.
  - Code for the flow. AI (the on-call agent) for fixing and writing the plain-English update.
- **Status page** on aigile.lol (a public "is it working?" page per public service).
  - Why: friends and testers stop asking; trust goes up.
  - Code: the relay shows open incidents of public projects. Only Rich's or the agent's chosen status line is shown, never card text.

### E. Learning from it
- **Post-incident review** (a longer look at a major incident: timeline, what helped, what to change).
  - Why: turns a bad day into fixes.
  - AI drafts the timeline from the card's comments and commits (it earns it: lots of reading). Rich ticks the actions; each becomes a card.
- **Known errors** (a problem with a known cause and workaround, before the real fix ships).
  - Why: agents and Rich use the workaround instead of re-investigating.
  - Code: a list view of problems with workarounds; included in each agent's brief for that project.
- **Runbooks / knowledge base** (step-by-step "how to fix X" notes agents follow).
  - Why: the same fix is done the same way, cheaper (fewer tokens re-discovering).
  - Code stores and finds them (a folder per project, linked from configuration items and problems). AI drafts a runbook from a closed post-mortem; Rich approves.
- **Continual improvement** (a short list of improvement ideas with a status, fed from retros and reviews).
  - Why: ideas don't get lost between retros.
  - Code: retro cards + review actions in one view.
- **Monthly service review** (one page per service: incidents, time to fix, targets met, tokens spent).
  - Why: see trends in a minute; decide where to spend effort.
  - Code builds the numbers; an optional AI two-line summary.

### F. Keeping it running
- **Release management** (a release = a named bundle of done changes, with notes and a way back), for every project, not just AI-gile.
  - Why: friends know what changed; rollback is one step.
  - Code: reuse release notes and roll back per project.
- **Capacity and cost** (tokens and server room per service).
  - Why: spot the service that eats the budget before the weekly limit hits.
  - Code: tag each run with its project (already logged) and add a monthly cap per service.
- **Backups and restore test** (proof that data comes back).
  - Why: a backup never restored is a hope, not a backup.
  - Code checks backup age; a monthly "restore test" task card, AI or Rich runs it.
- **Access review** (who has which share link, key or server login).
  - Why: friends come and go; old access is a risk.
  - Code: a quarterly list with "keep / remove" buttons.

## 3. Phased plan

Each card is at most 1 day for one helper. **Test** = what Rich does to check it. 👤 = needs Rich.

### Phase 1: hear about it, act fast (5 cards)
1. **Service details on a project.** Fields: what it offers, who uses it, web address, on-call agent (default the lead). Shown in Look and on home.
   - Test: fill them in for Tunio; home shows those details under Tunio.
   - 👤 Rich says which projects count as services.
2. **Uptime checks open incidents.** Ping each service address every 5 min (from the relay); 3 fails = one 🔥 incident on that project, assigned to on-call; back up = comment "up again after N min".
   - Test: set a wrong address on a test project; within 15 min one incident card appears, not three.
3. **Response targets.** A "reply by" per type and priority (defaults: incident 1 h, friend request 2 days, bug 1 week); red clock when late; brief line "2 cards past target".
   - Test: raise an incident, wait past the target (test clock); it shows red and the brief lists it.
   - 👤 Rich confirms the default times.
4. **Major incident button.** On an incident card: 🚨 Major. Turns on swarm, wakes the on-call agent, sends Rich one phone/Discord note, and asks the agent for a status line every 30 min until resolved.
   - Test: press it on a test incident; swarm bar shows, one message arrives, a status line appears within 30 min.
   - 👤 Rich picks phone or Discord for the alert.
5. **Status page on aigile.lol.** The relay shows each public service as 🟢 / 🟠 / 🔴 with the latest status line and time, from open incidents only.
   - Test: open aigile.lol/status; a public test project with a major incident shows 🔴 and the status line.
   - 👤 Rich OKs which projects appear publicly.

### Phase 2: front door and learning (6 cards)
6. **Service desk sorting.** Feedback-form reports and friend lane cards get a kind (request, incident, idea) by plain rules; a filter on the inbox.
   - Test: send "site is down" and "please add dark mode" via the form; one lands as incident, one as idea.
7. **Duplicate hint (AI, optional).** One cheap check per new desk card: "looks like AIG-x"; skipped in No Token Mode.
   - Test: send the same report twice; the second shows "looks like AIG-x".
8. **Known errors list.** A page of open problems with workarounds per project; each line also goes into that project's agent brief.
   - Test: add a workaround to a problem; it shows on the page and in `aigile brief`.
9. **Runbooks.** `docs/runbooks/` per project, `aigile runbook <proj> [name]`, linkable from problems; incident cards show matching runbooks.
   - Test: add "restart the relay"; a relay incident card shows the link.
10. **Post-incident review draft (AI).** On a closed major incident, the agent writes timeline, what helped, actions; Rich ticks actions, each becomes a card.
    - Test: close a test major incident; a review appears; ticking one action makes one card.
11. **Runbook from post-mortem (AI).** After a review, the agent proposes a runbook; Rich says Go or Not yet (same as retros).
    - Test: say Go; the runbook file appears.

### Phase 3: what it depends on (6 cards)
12. **Configuration items list.** Per project: servers, domains, certificates, key names (from Secrets, names only), repos, suppliers. Page and CLI.
    - Test: add a domain and the relay server; both listed.
    - 👤 Rich lists domains and suppliers (one sitting).
13. **Link items to incidents and changes.** A picker on incident, problem and change cards; the item shows its history.
    - Test: link an incident to the server; the server page lists it.
14. **Expiry watch.** Daily plain check of certificate and domain end dates; a card 30 days before.
    - Test: add an item with a test expiry in 20 days; a card appears next run.
15. **Server health per server.** Today it only watches the relay; let it watch any server in My servers that can answer.
    - Test: a second server shows CPU/disk in Setup.
16. **Backup check.** Each item can say "backed up where, how often"; a card when the newest backup is too old; a monthly restore-test task.
    - Test: set a backup older than its limit; a card appears.
    - 👤 Rich confirms where backups live.
17. **Access review.** Every 3 months, one card listing share links, friends' roles and kept secrets with keep / remove.
    - Test: run it with a test date; the card lists links and removing one ends that link.

### Phase 4: run it well over time (5 cards)
18. **Releases per project.** Name a release, gather done changes since the last, write notes, roll back per project.
    - Test: make release "v1" on a test project; notes list its done changes.
19. **Monthly service review.** One page per service: incidents, average time to fix, targets met, tokens and server use. Optional AI two-liner.
    - Test: open it for AI-gile; numbers match the board for last month.
20. **Token cap per service.** A monthly token limit per project; at 80% a brief line, at 100% that project's background runs pause.
    - Test: set a tiny cap on a test project; the next run is refused with a clear reason.
21. **Improvement list.** Retro cards, review actions and problem fixes in one list with status.
    - Test: file a retro; it shows on the list.
22. **Service management guide.** Three-level guide page (like incidents-problems.md) covering the whole flow.
    - Test: open it in the guide; steps match what the board does.

**Totals:** Phase 1: 5, Phase 2: 6, Phase 3: 6, Phase 4: 5 = **22 cards**.

## 4. Risks and open questions
- **Too much process for one person.** Everything is off by default and per project; if a phase isn't used in a month, stop there.
- **Alert noise and token burn.** 3-fail rule, one incident per outage, one agent run per incident, No Token Mode always wins.
- **Status page leaks.** Only public projects, only the chosen status line, never card text. Rich OKs each project.
- **Who watches the watcher?** If the relay is down, uptime checks and the status page go too. Open question: board also pings the relay and raises the incident itself?
- **Promises to friends.** Targets are internal aims. Open question: show friends their "reply by", or keep it to Rich?
