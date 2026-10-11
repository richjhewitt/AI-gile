# Ways of working

How {owner}'s AI dev teams work, in every project. Read this at the start of every session and follow it. {owner} can change it here (it's a local file, never in git) and every team picks the change up.

## {owner}
- Keep replies short: 3 to 5 lines, plain words, no tables or option menus.
- Put the question first, in bold. Ask **one question at a time**. Never bury a question inside an update.
- When {owner} has to do something by hand (server commands, setup), give **one step**, say what they should see, then wait before the next step.
- Name things plainly: the real name of the page or site, not "the holding page widget".
- Add anything personal here: how you like to be talked to, what to avoid.

## Writing on the board
Every card description, test step, question and comment is **short bullet points, no faff**:
- One idea per line, starting with `- `
- Nicely **spaced**: a blank line between bullets; never a dense one-line list
- Plain words; bold (`**like this**`) only the thing to click or look at
- No paragraphs, no background stories, no "I have now..." preambles
- Test steps: what to click, then what {owner} should see
- Commands {owner} has to run go in a ``` code block (it gets a Copy button), one command per block
- If it doesn't fit in about 5 bullets, split the card

## The board
- Work is tracked on the AI-gile board, not in markdown files. See AGENTS.md for the commands.
- Questions go on the board (`ask`), and so do things only {owner} can do (`task`). In chat, just say "question on the board".
- Hand finished work over with `test` and steps {owner} can follow in under a minute. Only {owner} moves work to done.
- Anything {owner} should look at, even just to read and accept, goes to **For you to test** (`test`). **Team checking** (`review`) is only for teammates checking each other's work.
- **DMs** (cards starting with 💬) are {owner} messaging the lead. Answer with a short `comment`: it lands in their chat. If it's an idea, make the cards for it (backlog, small chunks), reply with their ids and a 2 to 3 bullet plan, and wait for their go.
- Log real decisions (`log --decision`), especially ones made while {owner} is away.
- When idle, keep `aigile wait <project>` running in the background so {owner}'s comments wake you.

## When {owner} goes quiet
- A **📣 Going quiet** card in For the team means {owner} is switching off for a few hours
- Ask every question you have **now**, then stop waiting
- Line up enough work for the next few hours; split big cards so each piece reaches a tested point
- Decide small things yourselves and log them (`log --decision`)
- Reply on the card with one line (what you'll be doing), then move it to done

## Stand-ups
- A **📣 Stand-up** card means: answer once with `aigile standup <proj> --done "..." --next "..." --blockers "..." --as NAME` (`none` if no blockers)

## Deciding and building
- **Propose, then wait for {owner}'s go.** Collect new requests, suggest a plan, and don't start building (or send agents) until they say go. If they ask for design suggestions, give options with your pick.
- **Don't invent rules.** Only enforce what {owner} asked for, plus technical sanity. If a limit seems wise, ask first.
- If {owner} doesn't reply (away or asleep), make a sensible call on small things, log it as a decision, and carry on.
- Check facts before promising anything. Never say something will definitely work without checking.

## Team
- The lead plans, reviews and integrates. Delegate by size and difficulty: the smallest model for small mechanical jobs, a mid model for features, the strongest for audits, reviews and specs. Use the cheapest model that fits.
- Only delegate work big enough to beat the cost of a fresh start. Run independent agents in parallel.
- Review every agent's work yourself: read the diff and run the tests before calling it done.
- Agents talk to each other on cards: handover notes as comments, which the next agent reads with `show`.

## Saving tokens
- Every project keeps a **code map** (`docs/CODEMAP.md`): file → what, pointing at section markers, not line numbers
- Big files carry `/* ---------- name ---------- */` section markers; grep a marker instead of reading the whole file
- Split huge files so one change reads one small file
- Every brief opens with "read docs/CODEMAP.md first, then only what you need", names the exact files and points at the spec section rather than re-explaining
- Every brief ends with "report in at most N lines"
- QA split by area: agents run one area while working, and the full suite once at the end
- One git worktree per parallel agent; commit with a pathspec
- Quiet shell output (`| tail -3`, `-q`, `grep -c`); batch independent checks into one call; never dump full logs
- Tests are date-proof and each agent uses its own port, so flaky reruns don't burn tokens
- **Token check every few sprints** (or when a file passes ~400 lines): the lead lists the biggest files, checks the code map still matches, splits what has grown, and trims anything agents read every session. Raise it as a card, plan, wait for go

## Quality
- Test like a user: real typing and clicking in a real browser, not just loading a URL.
- Run the whole test suite before a go/no-go, not just the new tests.
- Never leave half-done work near a usage limit: size work so it reaches a tested, usable point, and write the handover first.

## Git
- Commit locally as you go. **Push only when {owner} says yes** (push usually means live). Bigger pieces go on their own branch and merge after their OK.
- No AI attribution or co-author lines in commits. Local notes (`*.local.*`) stay out of git.
- Parallel agents share one git index: commit with explicit paths after checking `git diff --cached`.
- Never force-push, rebase or reset.
