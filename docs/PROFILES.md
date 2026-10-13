# Agent profiles and team templates (AIG-415)

Design only. Lets the owner set how agents work with them on plain numbered scales, gives ready-made profiles for every role and level, and lets a whole team be added to a project in one click.

## What exists today (and where it moves)
- **Your lead** quiz and switches (`public/js/leadquiz.js`, saved by `lib/setup.js` in `aigile.local.json`): `lead.tidyCards`, `lead.chatty` (+ per project `p.chatty`), `lead.go` ('' | ask | small), `night.watchAll`, `push` (AIG-673: "ask" | "auto", git push ask first or just push; a line in `aigile brief` and every background prompt, `Bash(git push:*)` allowed in auto, force pushes always denied), dev words (`aigile.explain` in the browser).
- **Help level** `helpLevel` 1..3 (`public/js/help.js`): how much the *app* explains. Stays an app setting, not an agent scale.
- **Spend scale** `PLANS` (fly, careful, normal, generous, nospare) in `lib/setup.js`: usage checks, budget %, run cap, helpers per model.
- **Team roles per project** `p.roles` (AIG-366): 8 fixed strings in `lib/store.js` `TEAM_ROLES`, ticked in 🎨 Look; default for new projects `lead.roles`.
- **Dispatcher** `dispatch` (rules | haiku | lead): who is woken. Not a profile setting; unchanged.
- **Ways of working**: git-ignored `/WAYS-OF-WORKING.md`, made from `docs/starter/WAYS-OF-WORKING.md` by `ensureWays()`. Holds the prose rules (one step at a time, short replies, propose and wait). Stays; the scales override the matching lines.
- **Briefs**: run prompts in `lib/presence.js` (PROMPT, SPRINT, DAY, FIRST) say "run the board brief"; `aigile brief` (`lib/cli/cmds-read.js`) already prints `<owner>'s rule:` lines for go, helpers and roles. That is where compiled profiles land.

## 1. The scales
Every scale is 1..5 (tidy 1..3). Higher always means **more** of the thing named. Bold = the step that matches today's starter ways of working (the default; it costs no brief line).

**steps**: how many instructions at a time, for anything the owner does by hand (server commands, setup, a fix on their machine)
1. **One step, say what you should see, wait for "done"**
2. Two or three steps, then wait
3. One small stage at a time (e.g. "install", then "configure")
4. Whole task as a numbered list, check in at the end
5. Everything at once, all the detail, I'll read it

**chat**: how chatty in DMs and comments
1. Answers only, no extras
2. **Short and plain, 3 to 5 lines**
3. Short, plus one friendly line now and then (today's chatty lead)
4. Friendly, nudges about what is waiting on me
5. Chatty: jokes, cheer, running commentary

**go**: ask before building
1. Ask before every build, however small (today `go: ask`)
2. **Propose a plan, wait for go**
3. Small things (under an hour) without asking, log a decision (today `go: small`)
4. Build whole cards without asking; ask only for new features or scope
5. Build everything, tell me after

**alone**: how much it decides alone while working (design, libraries, splitting cards)
1. Asks the lead (or owner) about every choice
2. Small choices alone, asks about anything visible to users
3. **Decides and logs it; asks about big or risky ones**
4. Decides almost everything, flags only what can't be undone
5. Fully independent

**words**: detail and jargon in explanations
1. No dev words at all; explain everything like I'm new (today 📖 dev words on)
2. **Plain words; a dev word gets a short "(that means...)"**
3. Normal team talk
4. Dev words fine, brief (today 📖 dev words off)
5. Full technical depth, file names, line refs

**push**: how hard the 🧭 Lead Scrum Master pushes (AIG-441). The step table is `PUSH` in `lib/scrummaster.js` (plain numbers, reuse it, don't copy it); saved as `scrumMaster.push`, default 3. Higher = checks more often, pokes sooner.
1. **Keep the plates spinning**: round every 30 min, pokes cards stuck over 1 day, no reminders, 4 AI runs a day
2. Every 20 min, stuck over 8 h, 6 runs
3. **Steady** (today's night behaviour): every 10 min, stuck over 3 h, one gentle reminder for a question waiting 4 h, 8 runs
4. Every 5 min, stuck over 1 h, reminder after 2 h, 12 runs
5. **Crack the whip**: every 2 min, stuck over 30 min, reminder after 1 h, a status line each hour, 16 runs

**tidy**: how tidy cards must be (owner's own quick cards)
1. Leave cards as I wrote them
2. Short title only
3. **Short title and bullet description** (today `tidyCards: on`)

**thrift**: token thrift; one step sets today's `PLANS`
1. No spare: no caps (`nospare`)
2. Generous (`generous`)
3. **Normal (`normal`)**
4. Careful (`careful`)
5. Fly: cheapest model always, one run at a time (`fly`)

**tests**: testing depth before handing over
1. Smoke check: it loads, no errors
2. Try the change by hand once
3. **Run the tests that cover it, add one for the change**
4. Full QA area + edge cases
5. Full QA, AI tester pass, a second agent checks

Night (`watchAll`) stays a plain on/off switch: it is when the board wakes teams, not how they behave.

## 2. The profile file
One short Markdown file. A `key: value` header (no YAML library: one `key: value` per line between `---` lines), then a free "How I work" section of bullets.

```
---
id: frontend-mid
name: Frontend
level: mid
model: sonnet
alone: 2
tests: 3
words: 3
---
## How I work
- Build the page side only; ask Backend for new API routes
- Check it at phone width and in dark mode before handing over
```

- Keys that are left out inherit (template < owner copy < project override). A profile only lists what differs.
- `id`, `name`, `level`, `model` are labels; every other key must be a scale name with a whole number in range (bad value = ignored, warned once in the server log).
- "How I work" is capped at 6 bullets / 600 characters when compiled.

**Where they live**
- Built-in templates, in git: `profiles/roles/<id>.md`, `profiles/teams/<id>.md`, `profiles/owner.md` (the owner-level defaults = the bold steps above).
- The owner's edited copies, git-ignored: `profiles.local/<same path>` (add `/profiles.local/` to `.gitignore`; the zip updater never ships it). Editing a template in the UI writes here; "Reset to template" deletes the copy.
- Per project: numbers only, in the project data `p.profiles = { owner: {steps: 3}, 'frontend-mid': {tests: 4} }`. No files in the project's own repo.

**How they're applied** (`lib/profiles.js`, one compiler)
- `aigile brief` prints a **"How <owner> works"** block from the owner scales: one short sentence per scale that is **not** at its default (the step's line above). The default owner costs 0 extra lines; Rich today costs about 3.
- The existing go / helpers / roles lines move into this compiler (same text, one place).
- The lead's brief adds one line: `Brief helpers with: aigile profile <slug> <role>`. That prints the role's compiled lines (scales not at default + How I work), 3 to 8 lines, which the lead pastes at the top of the helper's prompt.
- Built (AIG-421): `aigile profile <slug> [role] [--set k=n,... [--all]] [--reset [--all]]`; your copy at `PUT/DELETE /api/profiles/roles/<id>`, this project's numbers at `PUT /api/projects/<slug>/profiles/<owner|role>` (owner: steps, go, words; a role: alone, tests, steps, words; null clears one). A helper gets the owner's steps and words unless its role sets its own.
- Ways of working keeps the prose. Where a scale is set off default, the brief line says "this overrides your ways of working".

## 3. Templates
Levels pick the model and default `alone`: **junior** Haiku, alone 1 · **mid** Sonnet, alone 2 · **senior** Sonnet, alone 3 · **principal** Opus, alone 4. Junior and mid work is always checked by a senior or the lead.

| Role | Levels offered | Scales it changes | How I work (first bullet) |
|---|---|---|---|
| Lead | principal | alone 4 | Plans, delegates, reviews, integrates |
| PM / scrum | mid, senior | tidy 3, chat 3 | Keeps cards small, ordered, folded |
| Frontend | junior..senior | tests 3 | Page side only; phone width, dark mode |
| Backend | junior..senior | tests 4 | API, data, server; never breaks old data |
| Full-stack | mid, senior | tests 4 | Whole feature end to end |
| Mobile | mid, senior | tests 4 | Small screens, touch, offline |
| DevOps / server | mid, senior | alone 1, steps 1 | Never runs anything on a live server unasked |
| QA / tester | junior, mid | tests 5 | Writes steps the owner can follow in a minute |
| Security | senior, principal | alone 1, tests 5 | Reports, never fixes silently |
| UX / UI designer | mid, senior | words 2 | Options with a pick, sketches before code |
| UX researcher | mid, senior | chat 3, words 1 | Asks the owner short questions, sums up in bullets |
| Copywriter / docs | junior, mid | words 1 | Plain words, short lines |
| Data | mid, senior | tests 4 | Checks numbers twice, shows the query |
| Accessibility | mid, senior | tests 4 | Keyboard, contrast, screen reader |
| i18n / translator | junior, mid | words 3 | Every string through `t()`, all languages |
| Code reviewer | senior, principal | alone 1, tests 4 | Reads the diff, runs tests, comments on the card |

Today's 8 `TEAM_ROLES` become: lead-principal, reviewer-principal, frontend-mid, backend-mid, qa-junior, quickfix-junior, copywriter-junior (Docs), tester-mid. Quick fix and Tester (the AI tester) are the two templates outside the 16 (AIG-419). Old role strings in `p.roles` are read as these ids (no data rewrite needed).

**Team templates** (`profiles/teams/*.md`: header `roles: a, b, c`, plus one line on when to use it)
- **Small solo helper team**: lead, quickfix-junior, qa-junior (cheapest; good for side projects)
- **Web app team**: lead, frontend-mid, backend-mid, qa-junior, reviewer-senior
- **Mobile team**: lead, mobile-senior, backend-mid, accessibility-mid, qa-junior
- **UX team**: ux-researcher-senior, uxui-designer-mid, accessibility-mid, copywriter-junior
- **Security review crew**: security-principal, reviewer-senior, devops-mid
- **Docs and launch team**: copywriter-mid, i18n-junior, pm-mid
- **Data team**: data-senior, backend-mid, qa-junior

One click "Add team" switches those roles on in `p.roles` (adds, keeps what's there; the same role at another level is swapped out; Lead always on). The lead's brief "You may delegate to" line then lists them. Built (AIG-420): `POST /api/projects/<slug>/apply-team { team, mode: add | replace }` answers with what was added and swapped out; today's 8 stay in `p.roles` by their old names, other roles by id; ➕ Add team sits under the roles in 🎨 Look until the 👥 Team dialog.

## 4. Owner-level vs agent-level
- **Owner-level** (how agents treat the owner; one set for all agents, per project override allowed): **steps, chat, go, words, tidy, thrift**. Whoever talks to the owner uses them; helpers that don't talk to the owner still use `words` and `steps` in any test steps or task cards they write.
- **Agent-level** (per role profile, per project override): **alone, tests**, model, level, How I work.
- An agent profile may not loosen an owner rule: `go` is owner-only, so no profile can build without the owner's go when the owner said ask.
- Spend: `thrift` is owner-level; a role's `model` is a preference the thrift scale can lower (thrift 5 = Haiku where it fits).

## 5. UI
- **⚙️ Setup, "How agents work with you"** (replaces "Your lead"): one slider per owner scale, the chosen step's line shown under it. The quiz stays as a quick way to set them (one new question: steps). Spend plan buttons become the thrift slider; the detail fields stay under "More".
  Built (AIG-422): `public/js/leadquiz.js` `scaleSlider`, saved as `prefs.scales` on release; push is the Scrum Master's slider; a custom spend mix shows thrift as "a mix of your own".
- **👥 Team on a project** (moves the roles ticks out of 🎨 Look into its own dialog, opened from the project header and Look): the roles on this project as rows (name, level, model), "Add team" dropdown, "Add role" dropdown, ✏️ edit, ✕ remove. A "This project: how agents work with you" fold for owner overrides.
- **Profile editor** (dialog): sliders for the agent scales, model and level selects, a "How I work" box, buttons **Save for all projects** / **Save for this project only** / **Reset to template**. A small "brief preview" shows the compiled lines and their rough token count.
  Built (AIG-423): `public/js/dialogs/team-profile.js`, 👥 Team in the project header and in 🎨 Look (the ticks left Look). Rows save at once; Add role at another level swaps like Add team. Editor: alone and tests as sliders, steps and words as "like you" or a step; a level change swaps the role on the project at once; Save for all = your copy (this project's numbers for the role are cleared); this project only = numbers only; Reset = both go. Preview: `POST /api/projects/<slug>/profiles/<role>/preview`. Roles added from a team are in the card's role picker by their label.
  Built (AIG-444): a team is applied with **➕ Add members** (mode add: same role at another level swapped, the rest kept, named, with "✕ Remove the kept ones") or **🔁 Replace team** (mode replace); either way **↩ Undo** / **↩ Restore them** puts back the roles from before.
- **⚙️ Setup, "👥 Your main team"** (AIG-460): new projects start with it (`lead.roles`, prefs `newRoles`). Start from a team template or tick roles; every role is optional except the Lead, which runs the team; the 🧭 Lead Scrum Master (`scrumMaster.role`, AIG-476) is a tick of its own. Saved at once; `mainTeamHtml` in `public/js/dialogs/team-profile.js`.
- **🧙 Wizard**: quick mode asks steps (1, 3, 5 as three pictures); advanced mode adds "Pick a starter team" for the first project.
  Built (AIG-424): the advanced roles screen is "Pick a starter team", the same box as Setup's main team (saved on Next as `newRoles` and `smRole`); steps stay a question on the lead screen (AIG-416), quick mode sets them through its team style.
- Help level, dev words in the page and night stay where they are.

## 6. Build cards (in order)
1. **Steps at a time for every lead (first slice).** `steps` 1..5 in setup prefs, validated; one brief line for every lead ("give N steps at a time") when not 1 (1 is already in the ways of working); Setup select + quiz question; en + nl strings. Agent: Backend (Sonnet). Check: Lead.
2. **Scale table and compiler** `lib/profiles.js`: SCALES with step lines, defaults, parse/format of the profile file, compile; brief's go / helpers / roles lines move into it (same output). Backend (Sonnet). Check: Reviewer (Opus).
3. **Owner scales from today's prefs**: chatty, go, tidyCards, explain, plan read and written as chat / go / tidy / words / thrift; old keys still accepted. Backend (Sonnet). Check: Reviewer (Opus).
4. **Built-in role templates**: the 16 roles x levels as `profiles/roles/*.md` from section 3. Docs (Haiku). Check: Lead.
5. **Team templates and profile ids in `p.roles`**: `profiles/teams/*.md`, old role strings mapped, "add team" API. Backend (Sonnet). Check: Reviewer (Opus).
6. **`aigile profile <slug> <role>`, owner copies in `profiles.local/`, per project numbers in `p.profiles`**, plus the lead's "brief helpers with" line. Backend (Sonnet). Check: Lead.
7. **Setup sliders**: "How agents work with you" replaces Your lead. Frontend (Sonnet). Check: QA (Haiku).
8. **👥 Team dialog and profile editor** (add team, edit, reset, preview). Frontend (Sonnet). Check: QA (Haiku) + Tester (Sonnet).
9. **Wizard**: steps question, starter team. Quick fix (Haiku). Check: QA (Haiku).
10. **QA area `profiles`** and folding into one test card for the owner. QA (Haiku). Check: Lead.

## 7. Quick questions for the owner
1. **Steps default for new installs?** a) 1 one at a time (pick: matches today's starter rules) b) 3 a stage at a time c) 5 all at once.
2. **Do steps cover test steps on For you cards?** a) No, only hand jobs in chat and task cards; test steps stay a full list on the card (pick) b) Yes, test cards too c) Card shows the list, the chat feeds them one at a time.
3. **Owner scales: one set or per project?** a) One set, with optional per project overrides (pick) b) Only one set c) Each project its own.
4. **"Add team" on a project?** a) Adds those roles, keeps the ones already on (pick) b) Replaces the project's roles with the team.
