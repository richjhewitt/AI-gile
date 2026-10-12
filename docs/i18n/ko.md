# AI-gile in Korean (ko)

First pass written by Babel for AIG-490; native-speaker review below (AIG-490).

## Register
- Polite casual 해요체 throughout ("~해요", "~돼요", "~하세요"), matching LocoRadio's Korean and the friendly English. No 합쇼체 (~합니다) and no 반말 (except the sample sentence the user types to the lead in `usage.off.chat.html`, which is how people write to a chat AI).
- Imperatives are 하세요 / ~해 주세요. The user is never named with a pronoun (no 당신/너); sentences drop the subject as Korean does, or use 나/내 for the user's own things ("내 차례", "내 댓글").
- Hangul only, no Hanja. Loanwords written in Hangul (스프린트, 백로그, 버그, 테스트).
- Durations: 분, 시간, 일. No plural marking; counters: cards "카드 {n}장" / "{n}개", teams "팀 {n}개", leads "리드 {n}명".
- Plural objects (`{count}`) use only the `other` category, as Intl.PluralRules gives for Korean.
- `{{dev:...}}` markers kept around the whole Korean word ("{{dev:백로그}}", "{{dev:테스트}}할 차례").

## Particles after placeholders
A filled-in name, id or title can end in a vowel or a consonant, so the particle is never attached in the 을(를) / 이(가) style. Instead:
- friends' names get 님: "{name} 님이", "{name} 님과", "{name} 님에게" (natural and polite in a chat app);
- card ids get a noun: "{id} 카드를", "{id} 카드가";
- projects: "{name} 프로젝트가";
- otherwise the sentence is turned so the placeholder sits before a colon, 에, 의, or at the end ("가장 많이 쓴 곳: {name}", "끝나면 다시 시작해요: {names}").

## Glossary
| English | Korean | Note |
|---|---|---|
| card | 카드 | counter 장 / 개 |
| board | 보드 | |
| project | 프로젝트 | |
| team | 팀 | |
| lead | 리드 | "팀 리드" |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| Scrum Master | Scrum Master | kept |
| For you | 내 차례 | column |
| For you to test | 직접 테스트할 차례 | column |
| For the team | 팀 차례 | column; pairs with 내 차례 (was 팀 몫) |
| To do | 할 일 | particle 로: "할 일로" |
| In progress / Doing | 진행 중 | |
| Team checking | 팀 확인 중 | |
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
| Send back | 돌려보내기 | was 되돌리기, which now only means undo / reset |
| Undo / Reset | 되돌리기 / 초기화 | |
| Bring back (card) | 다시 가져오기 | |
| Wake (the team) | 깨우기 | |
| poke (a team) | 깨우기 | "needs a poke" = 깨워야 해요 |
| Poke (card button, nudge) | 재촉 | "👉 재촉" |
| Going quiet / go quiet | 자리 비우기 | "자리를 비운 동안" (was 조용히 있기, a calque) |
| night watch / watchman | 야간 감시 / 감시자 | |
| assumption | 가정 | |
| No Token Mode | 토큰 없음 모드 | |
| Stuck / blocked | 멈춤 / 막힘 | |
| Look (🎨) | 모양 | |
| Permissions | 권한 | |
| Views | 뷰 | |
| friend | 친구 | name + 님 |
| pretend friend | 가짜 친구 | |
| relay | 릴레이 | |
| helper | 도우미 | |
| brief | 브리핑 | |
| role | 역할 | |
| picture (logo) | 이미지 | profile/agent pictures stay 사진 |
| DM | DM | |
| Message | 메시지 | |
| Glossary | 용어집 | |
| Tour | 둘러보기 | |
| wizard | 마법사 | |
| agent | 에이전트 | |
| token | 토큰 | |

## Answers to the first pass's questions
- "For you" 내 차례 reads well as a column and in sentences. "For the team" 팀 몫 ("the team's share") sounded odd as a column and in the reply placeholder; changed to 팀 차례, which pairs with 내 차례.
- "Poke": 재촉 is fine for the 👉 card button (a nudge for news). Where English means waking a team ("needs a poke", "pokes it itself"), Korean uses 깨우다, which the first pass already did in most places.
- Parenthesised particles: all removed (see "Particles after placeholders").
- `leave.confirm`: reworded to "그래도 {what}할까요? 답글은 사라져요.", which works for 업데이트 / 새로고침 / 다시 시작.
- `gloss.*.also`: the -들 forms are harmless; kept. Added 저장소 to `gloss.repo.also`.
- `act.*.say` and `card.looksright.say`: translating them is right; the teams read Korean fine.

## Review
Native-speaker pass over all 1,929 keys (AIG-490). 413 values changed: 181 keys that were missing (en.json gained them after the first pass) and 232 edits.
- Added the 181 missing keys: night-watch poke reasons, demo projects and the pretend team's canned replies (`demo.*`, `pt.*`, `pf.*`), server messages (`srv.*`), the "How agents work with you" sliders (`scale.*`), the Team dialog (`tm.*`, `pe.*`, `mt.*`), `lang.fun`.
- Plural keys (`inbox.g.count`, `dlg.find.commits`, `dlg.find.sessions`, `queue.bump.title`, `tidy.toast`, `quiet.done.told`, `quiet.done.woke`, `join.exp.days`) are now `{ "other": ... }` objects.
- Send back is 돌려보내기 everywhere; it clashed with 되돌리기 (undo, Bring back).
- "Going quiet" is now 자리 비우기 / 자리를 비운 동안 everywhere (home button, dialog, night-watch texts, wizard).
- Removed every 을(를) / 이(가) / 은(는) / 과(와) / (으)로 after a placeholder (about 60 strings), using 님, "카드", "프로젝트" or reworded sentences.
- Fixed wrong meaning: `dispatch.help` (said the opposite: "unless you name someone or the card is a test"), `standup.answered` (counted people, not teams), `filter.anyone`, `board.team.working` (column heading, not "working"), `usage.headline.html`.
- Fixed stale translations where English had changed: `wz.adv.roles.h`, `wz.adv.roles.sub`, `wz.adv.row.roles` (starter team).
- Restored the missing 👥 in `board.team`.
- Grammar: "할 일으로" → "할 일로"; "고장났나요" → "고장 났나요"; smoother wording in plate-spinning, stand-up, wizard and quiz strings; 사진 → 이미지 for logos.

Still worth a human native speaker's look:
- 님 after friends' names: natural in apps, but a few may prefer bare names in very short labels (`share.card.btn`, `sb.rail`).
- `scale.push` "Scrum Master의 추진력" and `scale.chat` "수다 정도": acceptable but could be snappier.
- 자리 비우기 for "Going quiet" covers "away for the night"; check it does not read as "away from desk for a minute".
- `pt.*` demo replies are written as the AI speaking (저는…); check the tone fits a demo.
