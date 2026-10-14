# Where the tokens go, and how to save them (AIG-522)

A deep dive into the token use of the board's runs, with suggested savings. **Nothing here changes behaviour:** these are proposals for Rich to pick from.

**Data:** `data/logs/_runs.jsonl` (296 background team runs, 279 with full fields, 2026-10-11 12:44 to 2026-10-12 07:44 UTC, about 19 hours), the team logs, `_scrummaster.raw`, the card files and the prompts in `lib/`.

**Cost unit:** the input-token equivalent on the API price list. A fresh input token counts 1, a cache write (1-hour TTL, the kind these runs use) counts 2, a cache read counts 0.1 and an output token counts 5. Plan limits weight usage in a similar way. In total the 279 runs came to **137M units**.

## Top 10

| # | Action | Est. saving | Effort | Risk |
|---|--------|------------:|:------:|------|
| 1 | **Cap a team run's resumed context.** Start a fresh session when `p.runSession` gets past about 150k tokens, or after 55 minutes idle. The Scrum Master already does the idle part. | 14% (24% at a 100k cap) | S | Low. The run loses chat memory, but notes and the brief carry it. |
| 2 | **Night sprints: one fresh session per card**, or a lower auto-compact threshold. One Tunio sprint alone cost 25.6% of everything. | 10–20% (overlaps #1) | M | Medium. Hand-offs between cards rely on the board. |
| 3 | **Cap helper fan-out.** Allow at most 4 helpers per run, give each a short brief with exact file slices, and do translations as a script-driven diff. | 8–12% | S–M | Low. Big batches take longer. |
| 4 | **A token budget per team per night**, checked during the run as well as at its start. Today `budget.mayRun()` only gates the start, and the SPRINT prompt says "don't stop". | 5–10% (overlaps #2) | S | Low |
| 5 | **Debounce wakes.** Wait for 3–5 minutes of quiet and fold the comments into one run. | 3–5% | S | Low. Replies arrive a little later. |
| 6 | **Comment-only wakes on Sonnet**, together with a fresh session. A model switch on a resumed session throws its cache away. | 3–5% | S | Low |
| 7 | **Trim the fixed prefix of background runs.** Use `--strict-mcp-config` and turn off unused tools and skills. Today every call carries about 28k tokens of system, tools and skills. | ~3.6% per 10k trimmed | S | Low–medium. A tool a run really needs could go missing. |
| 8 | **Skip idle wakes.** A Haiku pre-check (already in `dispatch.js`) could answer thanks or "ok" itself without waking the team. | 3–4% | M | Low |
| 9 | **i18n without re-reading `en.json`.** Add an `aigile i18n missing <lang>` command and split the file by area. | 2–5% on translation nights | M | Low |
| 10 | **Measure the blind spots.** Log Scrum Master, tester and lead-session usage to `_runs.jsonl`, and show cache reads on the Usage page. | 0% direct, it makes 1–9 checkable | S | None |

The savings overlap, so don't add them up. Doing #1, #2, #3 and #5 together should cut the background-run cost by roughly **30–40%**.

## 1. Where the tokens go

**By type of token (cost-weighted):**
- Cache reads are 63%: 989M tokens.
- Cache writes are 31%: 21.5M tokens.
- Output is 5%: 1.55M tokens.
- Fresh input is about 0%.

So the cost is set mostly by **how big the context is on each call, times the number of calls**, not by what the runs write.

**By project (background runs only):**

| Project | Runs | Share of cost | Avg cache read per run |
|---|---:|---:|---:|
| tunio | 40 | 42.1% | 11.1M |
| locoradio | 77 | 37.3% | 4.5M |
| ai-gile | 36 | 13.3% | 3.8M |
| state-of-the-smizflark | 25 | 4.2% | 1.3M |
| all the others | 101 | 3.0% | 0.2–0.5M |

**By size of run:**
- The 25 runs that touched 6 or more cards are 61% of the cost.
- The 101 runs that touched no card are 5.7%.

**The two biggest runs** make up 41.5% of the 19 hours:
- **Tunio night sprint (25.6%):** 233 minutes, about 1,229 API calls, 247M cache read, 12 cards.
- **LocoRadio night sprint (15.9%):** 42 minutes, 64M cache read, 7.1M cache write, 194 Reads (1.9M chars read), 10 cards. About 100 helper agents translated 93 languages, one writer and one reviewer per language.

**Models:**
- 112 runs were Opus only, and 30 of them touched no card.
- 119 runs were Sonnet only.
- 27 runs used both Sonnet and Opus. These were helpers on another model, and they carry 45% of cache reads.

**Blind spots:**
- `_runs.jsonl` holds only background team runs (`presence.js` `logTokens`). The Lead Scrum Master, the AI tester and the watchman write no token lines. `_scrummaster.raw` keeps only the last run (10 turns, 250k cache read, $0.31).
- The VS Code lead sessions and their helper worktrees aren't logged either. That is most of AI-gile's 17.7M "today" on the Usage page: its background runs come to only 2.4M in.
- The Usage page headline shows in plus out, which leaves out cache reads, the biggest cost driver.

## 2. What each run is sent

**Fixed prefix.** The first call of a Scrum Master run wrote 13.8k cache and read 14.1k. So every call starts from about 28k tokens of system prompt, tools and skills:
- 35 tools, including Cron, RemoteTrigger, DesignSync and WebSearch;
- the claude.ai Claude Docs MCP, connected;
- 30 skills and 66 slash commands.

Over about 4,900 calls in 19 hours, each 10k tokens trimmed saves about 49M cache reads (3.6%). `ask.js` and `pack.js` already use `--tools ''`, `--setting-sources user` and `--strict-mcp-config`. Team, Scrum Master and tester runs don't.

**Prompts:**

| Prompt | Where | Size | Model | Session |
|---|---|---|---|---|
| PROMPT, DAY, SPRINT | `presence.js` | 0.3–1.6k chars | default (Opus), or Sonnet with `runs.light` | `--resume` of one `p.runSession` |
| Scrum Master brief | `scrummaster.js` | small, and already a diff ("What changed") | Opus for Rich's messages, Sonnet for routine | Resumed; fresh after 1 h idle |
| Tester | `tester.js` | about 0.6k chars, plus `docs/TESTER.md` (3.9k chars) | Sonnet | Fresh every run |
| Dispatch, Scrum Master triage | `dispatch.js`, `scrummaster.js` | short | Haiku, 1 turn, no tools | none |

`runs.light` isn't set in `aigile.local.json`. So team runs **never** start fresh: every wake resumes the same conversation.

**Notes and the brief are small:**
- `aigile brief` is 0.9–3.9k chars (ai-gile 3,940, tunio 3,074, locoradio 2,225).
- The auto-loaded `CLAUDE*.md` files are 1–4.3k chars per project.
- `WAYS-OF-WORKING.md` is 8.3k chars and `AGENTS.md` 11.7k. Every helper and fresh session reads them, about 5k tokens each time.

**Hooks are already lean.** `updates --hook` prints nothing when there is no news, and the poke message is one line. A diff brief would save about 1k tokens per wake, under 1%.

## 3. Waste patterns, with evidence

**A resumed context that never shrinks (the big one).** I estimated context per call as cache read divided by (fresh input ÷ 2), at roughly 2 fresh tokens per call. It grows run after run:

| Project | Context at first wake | Context at last wake |
|---|---:|---:|
| locoradio | 150k | 614k |
| tunio | 39k | 580k |
| state-of-the-smizflark | 342k | 403k |

A 2-call comment reply on LocoRadio reads about 1.2M cache tokens. A fresh session would read about 60k.

The CLI reports `contextWindow: 1000000`, so auto-compaction hardly ever fires.

Capping the context at 150k would save 18.7% gross and 14.1% net, after paying about 60k for each fresh restart. A 100k cap would save 23.7% net.

**A resume after an hour re-writes everything.** Cache writes use the 1-hour TTL. The 9 small runs that started more than 60 minutes after the last one wrote **176k tokens of cache on average**. LocoRadio wrote 592k for one comment, which costs 2× input. Runs within the hour wrote 3.4k on average. #1 fixes this: start fresh after 55 minutes idle, as `scrummaster.js` `session()` already does.

**Wakes back to back.** 108 of 270 runs started less than 5 minutes after the previous run for the same team ended. The median gap is 7.8 minutes. Those runs are 24.8% of the cost, and the small ones 5.0%. Each wake pays at least 2–3 calls on the whole context.

**Wakes that do nothing.** 101 runs (36%) touched no card. They averaged 12 seconds and 0.58M cache read, and 90 of them wrote under 700 output tokens. They are 5.7% of the cost, and 30 of them ran on Opus. The "nothing new" guard (AIG-465) already stops runs with no unseen news. What remains is news that needs no work.

**Helper fan-out.** The LocoRadio sprint wrote 7.1M of cache, and runs with 6 or more cards wrote 21.2% of all cost as cache writes. Every helper pays:
- the 28k prefix, at 2× as a cache write;
- its own reads of the same big files.

**Big files:**
- `public/lang/en.json` is 108k chars and 1,932 keys, about 27k tokens per full read. A language written whole is about 30k output tokens, which is 5× the cost of input.
- `presence.js` is 34k chars, `routes.js` 31k and `aigile.js` 29k.
- I couldn't count how many agents re-read `en.json`, because session transcripts are off limits to this review. `readChars` shows one run read 1.9M chars.

**`show` output is not the problem.**
- The biggest card prints 8.7k chars (AIG-199). Only 1 card on the whole board has 50 or more comments (MIG-3, 60 comments, 9k chars).
- `ai-gile.json` is 1.8 MB because of its 523 cards (`proof` 595k, comments 467k, testSteps 125k), not because any one card is big.
- The risk is `brief --json`, which dumps the whole 1.8 MB file. Nothing should call it from an agent.

**Images.** There are 155 image attachments, averaging 87 kB, and none over 1 MB. `TESTER.md` already says "one screenshot". The cost is that an image read in a resumed session is re-read as cache on every later call. #1 solves that too.

**Hang restarts.** The logs show 0 hangs, so there is nothing to save there.

## 4. Ideas in more detail

1. **Context cap (S).**
   - In `launch()`, read the size of the last run (cache read ÷ calls, both already in `_runs.jsonl`). Over 150k, or idle over 55 minutes, start fresh.
   - `runsSinceFresh` and FRESH_EVERY already exist for `runs.light`. This makes them depend on size and time rather than every 5th run.
2. **Sprint per card (M).**
   - The SPRINT prompt makes one run go on for hours.
   - Instead, let the board start one fresh run per To do card, carrying the card id, and chain the next card in `ended()`.
   - Alternative: set the CLI's auto-compact threshold lower for background runs, if the installed version supports it.
3. **Fan-out cap (S–M).**
   - Add one line to WAYS-OF-WORKING and the SPRINT prompt: "at most 4 helpers at a time; give each the exact files and line ranges".
   - For translations, a script lists the missing keys per language, and helpers translate only those, returned as JSON. A writer and a reviewer per language doubles the cost, so review only a sample.
4. **Night budget (S).** `budget.js` could check the run's tokens so far, from `runTokens` on the live run, every few minutes. Over budget, it ends the run after its current card.
5. **Debounce (S).** In `presence.nudge`, wait about 3 minutes before `startTeam`, and restart the timer on each new comment. The existing "again" flag already folds comments that arrive mid-run.
6. **Sonnet for comment replies (S).** Use the model part of `runs.light` without the every-5th rule, but always with a fresh session, so the cache isn't lost by a model switch.
7. **Leaner background runs (S).**
   - Add `--strict-mcp-config` and a `--disallowedTools` list to the args in `presence.js`, `watchman.js` and `tester.js`.
   - Check first that nothing a run uses goes missing. At the least, background runs don't need Claude Docs, Cron, RemoteTrigger or DesignSync.
8. **Idle wakes (M).** `dispatch.js` already asks Haiku who to tell. It could also classify "needs no work". Then the board posts a 👍, marks the news seen and wakes no one.
9. **i18n tooling (M).** An `aigile i18n missing <lang>` command that prints only the missing keys, or `en.json` split by area. Agents then never read 108k chars to add 20 strings.
10. **Measure (S).**
    - Append the Scrum Master's stream-json `result` usage to `_runs.jsonl` as `_scrummaster`, and do the same for the tester (run it with `--output-format stream-json`).
    - Add a "cache read" column to the Usage page.
    - Then a week of numbers can confirm the estimates above.

**Checked and found low value:** comment truncation in `show`, a brief diff, lighter hooks, smaller screenshots, prompt-cache ordering and hang restarts. Each is under 1%, as the evidence in section 3 shows. Ripgrep-first guidance would help helpers a little: only 8 Greps against 315 Reads were logged, so agents read whole files rather than search. A WAYS-OF-WORKING line is the effort, and the saving is maybe 1–2%.
