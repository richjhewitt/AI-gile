# AI-gile in Korean (ko), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Polite casual 해요체 throughout ("~해요", "~돼요", "~하세요"), matching LocoRadio's Korean and the friendly English. No 합쇼체 (~합니다) and no 반말.
- Imperatives are 하세요 / ~해 주세요. The user is never named with a pronoun (no 당신/너); sentences drop the subject as Korean does.
- Hangul only, no Hanja. Loanwords written in Hangul (스프린트, 백로그, 버그, 테스트).
- Durations: 분, 시간, 일. Dates and plurals: no plural marking; "{n}개" counters used (cards "카드 {n}장", teams "팀 {n}개").
- `{{dev:...}}` markers kept around the whole Korean word ("{{dev:백로그}}", "{{dev:테스트}}할 차례").

## Glossary
| English | Korean | Note |
|---|---|---|
| card | 카드 | |
| board | 보드 | loanword |
| project | 프로젝트 | |
| team | 팀 | |
| lead | 리드 | "팀 리드" |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| Scrum Master | Scrum Master | kept |
| For you | 내 차례 | short column name |
| For you to test | 직접 테스트할 차례 | |
| To do | 할 일 | |
| In progress / Doing | 진행 중 | |
| Team checking | 팀 확인 중 | |
| For the team | 팀 몫 | |
| Done | 완료 | |
| Backlog | 백로그 | |
| sprint | 스프린트 | |
| stand-up | 스탠드업 | |
| inbox | 받은편지함 | |
| Setup | 설정 | |
| Usage | 사용량 | |
| test (verb/noun) | 테스트 | |
| test steps | 테스트 단계 | |
| Accept | 승인 | |
| Send back | 되돌리기 | |
| Wake (the team) | 깨우기 | |
| poke | 재촉 | "슬쩍 찌르기" in prose |
| assumption | 가정 | |
| night watch | 야간 감시 | "감시자" for the watchman |
| No Token Mode | 토큰 없음 모드 | |
| Stuck / blocked | 멈춤 / 막힘 | |
| Look (🎨) | 모양 | |
| Permissions | 권한 | |
| Views | 뷰 | |
| DM | DM | |
| Message | 메시지 | |
| Glossary | 용어집 | |
| Tour | 둘러보기 | |
| agent | 에이전트 | |
| token | 토큰 | |

## For the reviewer
- "For you" is 내 차례 (your turn) and "For the team" is 팀 몫; check these read well as column names and in sentences like the card reply placeholder.
- "Poke" 재촉 (urge) may be too pushy; 알림/깨우기 alternatives are possible.
- Particles written as 을(를) / 이(가) / 은(는) / 과(와) where a placeholder name or id of unknown final sound is inserted. A native check could reword some of these to avoid the parenthesised forms.
- `{what}` in `leave.confirm` is filled from `update.what.*` (업데이트, 새로고침, 다시 시작) followed by "하고"; "다시 시작하고" works, check the other two.
- `gloss.*.also` lists plural/variant spellings the board dots in text; Korean needs no plurals, so some are near-duplicates.
- `act.*.say` and `card.looksright.say` are sent as comments to the AI team; they were translated, not left in English.
- Kept identical to English on purpose: Lead Scrum Master, VS Code, the ssh and path placeholders, GIPHY credit, emoji-only keys.
