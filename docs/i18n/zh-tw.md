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
| Pro-friendly | 適合 Pro | review: was 照顧 Pro / 對 Pro 友善 |
| project key | 代號 | review: was "Key" |
| secret (password, token) | 機密資訊 | review: 金鑰 stays for API keys only |
| Plug (an assumption) | 修正 | review: was 堵上 |
| Not now | 以後再說 | review: was 現在不要 |
| starter team / main team | 起步團隊 / 主要團隊 | |
| time window (5-hour) | 區間 | review: 視窗 is only a UI window |
| commit / branch / merge / hook | Commit / 分支 / 合併 / Hook | |
| pull request | Pull Request | |
| repository | 儲存庫 | |

## For the reviewer
- Check 代理程式 vs 智能體, 站立會議 vs 站會, and whether 衝刺 should replace Sprint.
  - **Answer:** keep 代理程式 (智能體 is Mainland usage; AI 代理 would also work in Taiwan). Keep 站立會議: 站會 is heard in Taiwanese teams but 站立會議 is what tools and articles write. Keep Sprint: Taiwanese Scrum teams say Sprint; 衝刺 stays only as an extra glossary match.
- 摺疊/展開, 檢視, 回報者 (Reporter) and 檢視者 (Viewer) role names are my choices.
  - **Answer:** all natural Taiwanese UI words; keep them.
- Glossary `.also` lists mix English and Chinese; check they do not over-match common words.
  - **Answer:** they cannot over-match: glossary.js only marks a word with no letter on either side (`\p{L}`), and Han characters count as letters. The real issue is the opposite: inside running Chinese text (待你測試) a Chinese term never gets its dotted tip; only stand-alone words do. That needs a code change for CJK, not a translation change. 錯誤 as a Bug match is fine for the same reason.
- Strings with a trailing space in English have none in Chinese.
  - **Answer:** right, keep it that way.

## Review (native-speaker pass, AIG-490)
- Added the 181 strings English gained after the first pass: night-watch poke reasons, demo projects, the pretend team's replies (`pt.*`), server-written notes (`srv.*`), the "how agents work with you" sliders (`scale.*`), the 👥 Team dialog (`tm.*`, `pe.*`, `mt.*`).
- Turned the 8 plural keys into `{ "other": ... }` with `{count}`.
- Fixed literal `\n` (shown as backslash-n) in `verdict.open.confirm` and `assume.plug.comment`.
- Followed English changes: `board.team` gets 👥, `quiz.help` says 滑桿 (sliders), the wizard's roles screen is now 選一個起步團隊 / 起步團隊.
- 視窗 → 區間 for the 5-hour / 7-day usage windows (視窗 only means a screen window in Taiwan).
- Calques replaced: 讓盤子轉起來 → 維持運轉就好, 揮鞭催馬 → 快馬加鞭, 帶回來 → 立即恢復 (snoozed card), 在其之上再啟動 → 再額外啟動, 夜間模式已持續自 → 自 … 起處於夜間模式, 推你一下 → 提醒你一下.
- Durations: 小時 instead of 時 (3時 reads as 3 o'clock): `ago.bare.h`, `usage.unit.h`; `ago.bare.m` is {n}分鐘.
- Wording: 永不 → 禁止 (permission), 現在不要 → 以後再說, 金鑰 → 機密資訊 where English says "secret", Key → 代號, 約會 / 預約 → 預約, 應用程式標誌 → 應用程式圖示, 空閒 → 未使用 (free avatar), "his project" → 自己的專案, 加入你的朋友 → 新增你的朋友.
- Smaller polish: 5 小時 / 7 天 spacing, quiz answers 是/否 → 要/不用, watch summary word order.

### Still for a human native speaker
- 代理程式 is long in tight places (filters, 🤖 chip); AI 代理 is shorter if it reads naturally.
- `srv.assume.refill` shows `{priority}` as whatever the server passes (probably the English word); check it on a real night run.
- The pretend-team texts (`pt.*`) use a playful tone (馬上做！); check the cheerfulness lands.
- 大頭貼 for avatar pictures is casual Taiwanese; 頭像 is the neutral alternative.
