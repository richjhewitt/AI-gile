# AI-gile in Vietnamese (vi), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Casual **bạn** for the reader, as in LocoRadio's Vietnamese. No honorific pile-ups; short imperatives ("Bấm", "Hãy chọn"). The Lead Scrum Master and agents are referred to as "bạn ấy" where English says "it" for a person-like helper.
- Standard Vietnamese, Latin script with full diacritics. Dates and times follow vi-VN.
- Plurals: Vietnamese has none, so plural objects are `{ one, other }` with the same text.
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
| Poke | Nhắc | "hích" in a tooltip |
| night watch | Trực đêm | watchman = "người gác (đêm)" |
| Going quiet | Im lặng | |
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
| Checklist | Danh sách kiểm | |
| Hook | hook | |

## For the reviewer
- "Nhóm" is used for both "team" and "group of cards" (`card.f.group` is "Nhóm thẻ" to tell them apart); check it reads clearly.
- "Tải lại" (refresh) and "Khởi động lại" (restart) are used as the `{what}` word in `leave.confirm`; verify the sentence still parses ("Vẫn Tải lại và mất nó?").
- The pretend-team jokes in `sm.push.*` ("Giữ cho đĩa quay", "Vung roi") are idiomatic renderings; confirm tone.
- "bạn ấy" for the Lead Scrum Master: check it does not feel too personal.
- Longest buttons to check for fit: "Thiết lập bằng trình hướng dẫn (khuyên dùng)", "Chấp nhận tất cả thẻ AI đã cho đạt".
- `ago.bare.*` abbreviations (p, g, n) are very short; consider "phút/giờ/ngày" if space allows.
