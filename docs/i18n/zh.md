# AI-gile in Chinese, Simplified, Mainland (zh), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Casual but polite **你** throughout (never 您), matching LocoRadio's zh and AI-gile's friendly English.
- Simplified script, Mainland vocabulary (默认 not 預設, 文件夹, 服务器, 软件, 用户, 设置). Full-width punctuation in Chinese text; Latin letters and numbers keep a thin space where it reads better ("5 小时").
- Quotes use “ ” in prose. Plurals: Chinese has none, `{count}`/`{n}` texts are one form.
- `{{dev:...}}` markers wrap the whole Chinese word: {{dev:测试}}, {{dev:迭代}}, {{dev:Bug}}, {{dev:提交}}; Backlog stays English inside the marker.

## Glossary
| English | Chinese | Note |
|---|---|---|
| card | 卡片 | |
| board | 看板 | also Kanban |
| project | 项目 | |
| team | 团队 | |
| lead | 负责人 | "team lead" |
| Lead Scrum Master | 首席 Scrum Master | Scrum Master kept |
| For you | 待你处理 | column short name |
| For you to test | 待你{{dev:测试}} | |
| To do | 待办 | |
| In progress / Doing | 进行中 | |
| Team checking | 团队检查中 | |
| For the team | 交给团队 | |
| Done | 已完成 | "完成" on buttons |
| Backlog | Backlog | loanword |
| sprint | 迭代 | glossary also matches Sprint |
| stand-up | 站会 | |
| inbox | 收件箱 | |
| Setup | 设置 | |
| Usage | 用量 | |
| test / test steps | 测试 / 测试步骤 | |
| Accept | 接受 | |
| Send back | 退回 | |
| Wake (team) | 唤醒 | |
| Poke | 戳一下 | |
| night watch | 夜间值守 | the watchman = 看守人 |
| No Token Mode | 无 Token 模式 | |
| assumption | 假设 | |
| agent | 智能体 | |
| comment | 评论 | |
| DM | 私信 | |
| attachment | 附件 | |
| view | 视图 | |
| column / row (lane) | 列 / 行 | lane = 泳道 once |
| Pro-friendly | 适合 Pro | review: was 对 Pro 友好 / 照顾 Pro |
| token | Token | loanword |
| project key | 代号 | review: was "Key" |
| secret (password, token) | 机密信息 | review: 密钥 stays for API keys only |
| Plug (an assumption) | 纠正 | review: was 堵上 |
| Not now | 以后再说 | review: was 现在不要 |
| starter team / main team | 起步团队 / 主团队 | |
| time window (5-hour) | 窗口 | as in 时间窗口 |
| commit / branch / merge / hook | 提交 / 分支 / 合并 / 钩子 | |

## For the reviewer
- "Backlog" kept as English; check whether 需求池 or 待办列表 reads better to Mainland teams.
  - **Answer:** keep Backlog. Mainland agile teams say "Backlog" (or 产品待办列表 in formal Scrum texts); 待办列表 would clash with 待办 (To do).
- "Blocked" is 受阻, "Poke" 戳一下, "Quiet" 安静: check tone.
  - **Answer:** all three are fine. 戳一下 is the familiar chat-app word. For "going quiet" 安静 stays in labels, but full sentences now say 不在 / 离开 where 安静 read oddly (quiet.confirm).
- "Lead" 负责人 vs 组长 for team lead.
  - **Answer:** keep 负责人. 组长 sounds like a school or factory group leader, and 负责人 also works for a single AI.
- Glossary `.also` lists mix English and Chinese trigger words; check they do not over-match common words (测试, 提交, 分支).
  - **Answer:** they cannot over-match: glossary.js only marks a word with no letter on either side (`\p{L}`), and Han characters count as letters. The opposite is the real issue: inside running Chinese text (待你测试) a Chinese term never gets its dotted tip; only stand-alone words (buttons, chips, "🧪 测试") do. That needs a code change for CJK (match without word boundaries), not a translation change.
- Strings with a trailing space in English (`act.notyet.say`, `inbox.sum.*`) have none in Chinese.
  - **Answer:** right, keep it that way; the full stop 。 ends each sentence.

## Review (native-speaker pass, AIG-490)
- Added the 181 strings English gained after the first pass: night-watch poke reasons, demo projects, the pretend team's replies (`pt.*`), server-written notes (`srv.*`), the "how agents work with you" sliders (`scale.*`), the 👥 Team dialog (`tm.*`, `pe.*`, `mt.*`).
- Turned the 8 plural keys into `{ "other": ... }` with `{count}`.
- Fixed literal `\n` (shown as backslash-n) in `verdict.open.confirm` and `assume.plug.comment`; they are real line breaks again.
- Followed English changes: `board.team` gets 👥, `quiz.help` says 滑块 (sliders), the wizard's roles screen is now 选一个起步团队 / 起步团队.
- Calques replaced: 让盘子转起来 → 保持运转就好, 挥鞭催马 → 快马加鞭, 带回来 → 立即恢复 (snoozed card), 在其之上再启动 → 再额外启动, 夜间模式已持续自 → 自 … 起处于夜间模式, 推你一下 → 提醒你一下.
- Durations: 小时 instead of 时 (3时 reads as 3 o'clock): `ago.bare.h`, `usage.unit.h`; `ago.bare.m` is {n}分钟.
- Wording: 永不 → 禁止 (permission), 现在不要 → 以后再说 (ask a friend's AI), 密钥 → 机密信息 where English says "secret", Key → 代号 (project key), 约会 / 预约 → 预约 (约会 is a date), 应用标志 → 应用图标, 空闲 → 未占用 (free avatar), "his project" → 自己的项目.
- Smaller polish: spacing in 5 小时 / 7 天, 是/否 answers in the quiz → 要/不用, watch summary word order (交接 {h} 项 · 完成 {d} 项 …).

### Still for a human native speaker
- 智能体 for "agent": standard in Mainland AI products, but some developers still say Agent / 代理; check it feels right in Setup.
- `srv.assume.refill` shows `{priority}` as whatever the server passes (probably the English word); check it on a real night run.
- 窗口 for the 5-hour / 7-day usage windows (5 小时窗口) is understandable but technical; 周期 is an alternative.
- The pretend-team texts (`pt.*`) use a playful tone (马上做！); check they match the English cheerfulness without sounding childish.
