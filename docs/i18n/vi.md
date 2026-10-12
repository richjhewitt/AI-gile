# AI-gile in Vietnamese (vi), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Casual **bạn** for the reader, as in LocoRadio's Vietnamese. No honorific pile-ups; short imperatives ("Bấm", "Hãy chọn"). Where English says "it" for the Lead Scrum Master or an agent, the subject is dropped or the role is named again ("Lead Scrum Master", "trưởng nhóm", "AI kia"); no "bạn ấy" (it clashes with "bạn" = you) and no "nó" for people-like helpers. AI voices speak as "mình"; the user's own buttons say "tôi".
- Standard Vietnamese, Latin script with full diacritics. Dates and times follow vi-VN.
- Plurals: Vietnamese has no plural forms (Intl.PluralRules gives only `other`), so plural objects carry `other` only, with `{count}`.
- Software terms stay in English as Vietnamese dev teams say them: backlog, sprint, stand-up, bug, test, commit, push, branch, merge, repo, deploy, hook, token, agent, review, Scrum Master, Kanban. `{{dev:...}}` markers wrap the English loanword in lower case ("{{dev:test}}", "{{dev:bug}}", "{{dev:sprint}}") and the `gloss.*.word/also` keys list the same spellings.
- Short relative times: "p" (phút), "g" (giờ), "n" (ngày).

## Glossary
| English | Vietnamese | Note |
|---|---|---|
| card | thẻ | |
| board | bảng | |
| project | dự án | |
| team | nhóm | |
| lead / team lead | trưởng nhóm | "Lead Scrum Master" kept |
| For you | Cho bạn | |
| To do | Cần làm | |
| In progress / Doing | Đang làm | |
| Team checking | Nhóm kiểm tra | |
| For the team | Cho nhóm | |
| For you to test | Bạn cần test | |
| Done | Xong | |
| Backlog | Backlog | loanword |
| sprint | sprint | loanword |
| stand-up | stand-up | loanword |
| inbox | Hộp thư | |
| Setup | Cài đặt | |
| Usage | Mức dùng | |
| test | test | loanword; "kiểm thử" only in the glossary |
| test steps | các bước test | |
| Accept | Chấp nhận | |
| Send back | Trả lại | |
| Wake (team) | Đánh thức | |
| Poke | Nhắc | also in tooltips ("Nhắc nhóm một tiếng") |
| night watch | Trực đêm | watchman = "người gác (đêm)" |
| Going quiet / go quiet | Tạm vắng | "im lặng" reads as "keep silent" |
| assumption | giả định | |
| No Token Mode | Chế độ không token | |
| token | token | |
| agent | agent | |
| blocked | bị chặn | |
| blockers | vướng mắc | |
| Permissions | Quyền | |
| Views | Chế độ xem | |
| DM | tin nhắn riêng | |
| Look (🎨) | Giao diện | |
| Space | Space | kept in the button, "space" in text |
| Checklist | Danh sách kiểm tra | |
| Hook | hook | |
| Assignee | Người phụ trách | "No assignee" = Chưa giao |
| Pretend friend | bạn ảo | pretend AI = AI giả lập |
| Plug (an assumption) | Sửa lại | |
| secret (in a card) | thông tin bí mật | |
| live (connection) | trực tuyến | opposite of ngoại tuyến |
| Starter team | Nhóm khởi đầu | |

## For the reviewer
- "Nhóm" is used for both "team" and "group of cards" (`card.f.group` is "Nhóm thẻ" to tell them apart); check it reads clearly.
  - **Answer:** it reads clearly as long as the card sense always says "nhóm thẻ". `inbox.g.tag` said only "Nhóm", so it now says "Nhóm thẻ" too.
- "Tải lại" (refresh) and "Khởi động lại" (restart) are used as the `{what}` word in `leave.confirm`; verify the sentence still parses ("Vẫn Tải lại và mất nó?").
  - **Answer:** it did not read well: a capital mid-sentence and "mất nó". `update.what.*` are only used there, so they are now lower case, and the sentence is "Vẫn {what} và bỏ câu trả lời đó?".
- The pretend-team jokes in `sm.push.*` ("Giữ cho đĩa quay", "Vung roi") are idiomatic renderings; confirm tone.
  - **Answer:** Vietnamese has no plate-spinning idiom, and "Vung roi" sounds harsh. Now "🍽️ Thong thả" (1) and "🏇 Thúc ngựa" (5); the emoji keep the picture.
- "bạn ấy" for the Lead Scrum Master: check it does not feel too personal.
  - **Answer:** it also clashes with "bạn" (you). Removed: the subject is dropped or the role is named again.
- Longest buttons to check for fit: "Thiết lập bằng trình hướng dẫn (khuyên dùng)", "Chấp nhận tất cả thẻ AI đã cho đạt".
  - **Answer:** shortened to "🧙 Dùng trình hướng dẫn (khuyên dùng)" and "✅ Chấp nhận mọi thẻ AI đạt ({n})".
- `ago.bare.*` abbreviations (p, g, n) are very short; consider "phút/giờ/ngày" if space allows.
  - **Answer:** kept. "p/g/n" match `usage.unit.*` and the compact spots they appear in; the long "phút trước" forms are used everywhere else.

## Review
Native-speaker pass for AIG-490: 216 values changed.
- **Plurals:** the 8 plural objects now carry `other` only (Vietnamese has no `one`).
- **Wrong meaning:** `wz.adv.roles.h/.sub` and `wz.adv.row.roles` were translated from an older English text ("which AI roles", "🎨 Look"); now "Nhóm khởi đầu" and "👥 Nhóm". `dms.filter.people` said "Mọi người" (everyone); now "🙋 Người". `live.ok` said "trực tiếp" (broadcast live); now "trực tuyến".
- **Missing emoji:** `board.team` had lost 👥.
- **Glossary:** "Going quiet" is now "Tạm vắng" everywhere (was "Im lặng"); Checklist "Danh sách kiểm tra"; Assignee "Người phụ trách"; pretend friend "bạn ảo"; Plug an assumption "Sửa lại"; secrets "thông tin bí mật"; test chip "🧪 Test" (was "Kiểm thử").
- **Calques and register:** "lắm lời" (talkative, negative) for the chatty lead is now "vui tính"/"Kiệm lời"; "xây" for build is now "làm"; "tránh đường bạn" (out of your way) is now "tạm ẩn"; "bạn của bạn" is now "người bạn đó"; "Hôm nay thôi" (Not today) is now "Hôm nay không"; "Lùi" is now "Quay lại"; many "nó" that referred to people, cards or AIs now name the thing.
- **Doubts for a human native speaker:**
  - "Tạm vắng" for Going quiet, and "🍽️ Thong thả" / "🏇 Thúc ngựa" for the push levels.
  - "Danh sách kiểm tra" vs plain "checklist", which many Vietnamese teams use.
  - "Khóa" for `queue.kind.keys` (API keys): some readers may prefer "Key".
  - "bạn ảo" for the pretend friend (could also be "bạn giả lập").
  - 101 newer English keys (`scale.*`, `tm.*`, `pe.*`, `poke.held.*`, `mt.*`) are not translated yet and show in English.
