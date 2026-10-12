# AI-gile in Chinese, Traditional, Taiwan (zh-tw), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Casual but polite **你** throughout (never 您), matching LocoRadio's zh-tw and AI-gile's friendly English.
- Traditional script with Taiwan vocabulary (預設, 資料夾, 伺服器, 軟體, 使用者, 設定, 檔案, 螢幕, 訊息, 留言, 專案, 程式碼, 執行, 儲存, 載入, 連結). Full-width punctuation, 「 」 quotes in prose.
- Plurals: Chinese has none, so `{n}` texts are one form.
- `{{dev:...}}` markers wrap the whole word: {{dev:測試}}, {{dev:Sprint}}, {{dev:Bug}}, {{dev:Commit}}, {{dev:Backlog}} (these are left in English as Taiwanese teams do).

## Glossary
| English | Chinese | Note |
|---|---|---|
| card | 卡片 | |
| board | 看板 | |
| project | 專案 | Taiwan term |
| team | 團隊 | |
| lead | 負責人 | |
| Lead Scrum Master | 首席 Scrum Master | |
| For you | 待你處理 | |
| For you to test | 待你{{dev:測試}} | |
| To do | 待辦 | |
| In progress / Doing | 進行中 | |
| Team checking | 團隊檢查中 | |
| For the team | 交給團隊 | |
| Done | 已完成 | |
| Backlog | Backlog | |
| sprint | Sprint | 衝刺 as extra glossary match |
| stand-up | 站立會議 | |
| inbox | 收件匣 | |
| Setup | 設定 | |
| Usage | 用量 | |
| test / test steps | 測試 / 測試步驟 | |
| Accept | 接受 | |
| Send back | 退回 | |
| Wake (team) | 喚醒 | |
| Poke | 戳一下 | |
| night watch | 夜間值守 | |
| No Token Mode | 無 Token 模式 | |
| assumption | 假設 | |
| agent | 代理程式 | Taiwan usage |
| comment | 留言 | |
| DM | 私訊 | |
| attachment | 附件 | |
| view | 檢視 | |
| column / row (lane) | 欄 / 列 | |
| token | Token | |
| commit / branch / merge / hook | Commit / 分支 / 合併 / Hook | |
| pull request | Pull Request | |
| repository | 儲存庫 | |

## For the reviewer
- Check 代理程式 vs 智能體, 站立會議 vs 站會, and whether 衝刺 should replace Sprint.
- 摺疊/展開, 檢視, 回報者 (Reporter) and 檢視者 (Viewer) role names are my choices.
- Glossary `.also` lists mix English and Chinese; check they do not over-match common words.
- Strings with a trailing space in English have none in Chinese.
