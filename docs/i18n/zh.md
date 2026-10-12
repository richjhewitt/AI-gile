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
| Pro-friendly | 对 Pro 友好 | |
| token | Token | loanword |
| commit / branch / merge / hook | 提交 / 分支 / 合并 / 钩子 | |

## For the reviewer
- "Backlog" kept as English; check whether 需求池 or 待办列表 reads better to Mainland teams.
- "Blocked" is 受阻, "Poke" 戳一下, "Quiet" 安静: check tone.
- "Lead" 负责人 vs 组长 for team lead.
- Glossary `.also` lists mix English and Chinese trigger words; check they do not over-match common words (测试, 提交, 分支).
- Strings with a trailing space in English (`act.notyet.say`, `inbox.sum.*`) have none in Chinese.
