# Ways of running a lead: what they cost (AIG-461)

Measured from Claude Code's own session files, 7 Oct to 14 Oct 2026 (1,504 sessions). Re-run any time:

    node tools/session-modes.cjs --days 7

| Mode | Sessions | Prompts | API calls | Cost units | per call | per prompt | calls per prompt | cache reads | wait per prompt |
|---|---|---|---|---|---|---|---|---|---|
| VS Code | 63 | 1686 | 11653 | 493M | 42k | 292k | 6.9 | 99% | 15 s |
| VS Code, helper agents | 703 | 703 | 18846 | 351M | 19k | 500k | 26.8 | 96% | 273 s |
| Background (board's `claude -p`) | 249 | 1078 | 10921 | 170M | 16k | 158k | 10.1 | 98% | 22 s |
| Background, helper agents | 446 | 446 | 10044 | 138M | 14k | 309k | 22.5 | 94% | 277 s |
| Terminal | 39 | 72 | 271 | 5M | 17k | 66k | 3.8 | 98% | 2 s |

Cost units weigh tokens like the API prices them (fresh input 1, cache write 1.25 or 2, cache read 0.1, output 5): for comparing, not a bill.

## Recommendation

- **Leads run in the background** (the board's runs, the night watch): about **half the cost per prompt** of VS Code (158k vs 292k), because each run starts with a small, fresh context

- **VS Code** costs the most per call (42k): long chats drag a big context into every call. Use it when Rich is working live with a lead; start a fresh chat when moving to another card

- **Helper agents** were 40% of all spend, 300k to 500k per helper. Keep the rule: only hand a helper a job big enough to beat a fresh start

- **Terminal**: too few sessions to judge (39 short ones); nothing suggests it beats background runs

- Speed: a background prompt answers in about 22 s, VS Code in 15 s (median); helpers take 4 to 5 minutes each
