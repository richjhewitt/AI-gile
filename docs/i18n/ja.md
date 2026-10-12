# AI-gile in Japanese (ja)

First pass written by Babel for AIG-490; native-speaker review below (AIG-490).

## Register
- Friendly polite です/ます style throughout, matching LocoRadio's Japanese and the casual English. No だ/である plain style, no heavy keigo. Short labels and buttons use plain dictionary forms or nouns ("ツアーを始める", "差し戻す").
- Imperatives as ください / ましょう; "あなた" is used only where a label needs a subject ("あなたの番", "あなたの返事待ち").
- Kanji, hiragana and katakana mixed; software loanwords in katakana (スプリント, バックログ, バグ, テスト). Full-width 、。（）！？ and 「」 for quoting UI labels and button names inside sentences ("「一致している」をタップ"). Label colons stay ASCII ": " as in LocoRadio.
- No spaces between Japanese and placeholders unless the English needed them.
- Durations: 分, 時間, 日. Plurals not marked; counters 件, 枚, 個, チーム, 人.
- Plural objects (`{count}`) use only the `other` category, as Intl.PluralRules gives for Japanese.
- `{{dev:...}}` markers kept around the whole katakana word ("{{dev:バックログ}}", "{{dev:テスト}}する番").

## Glossary
| English | Japanese | Note |
|---|---|---|
| card | カード | counter 枚 |
| board | ボード | |
| project | プロジェクト | |
| team | チーム | |
| lead | リード | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| Scrum Master | Scrum Master | kept |
| For you | あなたの番 | column |
| For you to test | あなたがテストする番 | column |
| For the team | チームの番 | column |
| To do | やること | |
| In progress / Doing | 進行中 | |
| Team checking | チーム確認中 | |
| Done | 完了 | |
| Backlog | バックログ | |
| sprint | スプリント | |
| stand-up | スタンドアップ | |
| inbox | 受信箱 | |
| Setup | セットアップ | |
| Usage | 使用量 | |
| test | テスト | "To test" chip: テスト待ち |
| test steps | テスト手順 | |
| Accept | 承認 | |
| Send back | 差し戻す / 差し戻し | |
| Wake (the team) | 起こす | |
| poke (a team) | 起こす | "needs a poke" = 起こす必要があります |
| Poke (card button, nudge) | つつく | |
| Going quiet / go quiet | しばらく離れる / 離席 | was 静かにする, a calque |
| night watch / watchman | 夜間の見張り / 見張り | |
| assumption | 仮定 | |
| No Token Mode | トークンなしモード | |
| Stuck / blocked | 停止中 / ブロック中 | |
| Look (🎨) | 見た目 | |
| Permissions | 権限 | |
| Views | ビュー | |
| friend | 友達 / 相手 | |
| pretend friend | ダミーの友達 | |
| relay | 中継 | |
| helper | ヘルパー | |
| brief | ブリーフ | |
| role | ロール | |
| Outside help | 外部の協力 | |
| DM | DM | |
| Message | メッセージ | |
| Glossary | 用語集 | |
| Tour | ツアー | |
| wizard | ウィザード | |
| agent | エージェント | |
| token | トークン | |

## Answers to the first pass's questions
- あなたの番 / チームの番 read well both as column names and in running text; kept.
- Colons: ASCII ": " in labels is fine and matches the app; kept. Quoted UI names inside sentences now use 「」.
- "Poke": つつく stays for the 👉 card button (playful, clear). Where English means waking a team, 起こす is used, as the first pass did.
- `leave.confirm`: reworded to "それでも{what}しますか？返信は失われます。", which works with all three `update.what.*`.
- Long vowels: ユーザー, サーバー, ブラウザー, エディター, コンピューター are consistent; "フォルダ" stays without ー (the common Windows spelling).
- `act.*.say` and `card.looksright.say`: translating them is right.

## Review
Native-speaker pass over all 1,929 keys (AIG-490). 281 values changed: 181 keys that were missing (en.json gained them after the first pass) and 100 edits.
- Added the 181 missing keys: night-watch poke reasons, demo projects and the pretend team's canned replies (`demo.*`, `pt.*`, `pf.*`), server messages (`srv.*`), the "How agents work with you" sliders (`scale.*`), the Team dialog (`tm.*`, `pe.*`, `mt.*`), `lang.fun`.
- Plural keys (`inbox.g.count`, `dlg.find.commits`, `dlg.find.sessions`, `queue.bump.title`, `tidy.toast`, `quiet.done.told`, `quiet.done.woke`, `join.exp.days`) are now `{ "other": ... }` objects.
- "Going quiet" is now しばらく離れる / 離席 everywhere (was 静かにする).
- Fixed wrong meaning: `dispatch.help` (said the opposite: "unless you name someone or the card is a test"), `inbox.t.waiting` (`{when}` is a bare duration, so "3時間から" became "3時間待機中"), `standup.answered` (teams, not items), `dms.newmsg` (新着 means received), `runin.help` and `runin.blind` (▶ 起こす read as "when waking").
- Fixed stale translations where English had changed: `wz.adv.roles.h`, `wz.adv.roles.sub`, `wz.adv.row.roles` (starter team).
- Restored the missing 👥 in `board.team`; removed an extra 🔄 in `budget.usage.help`.
- Natural wording: まだ判断できないとき (was まだ分かりません。), いちばん安い (was 最安), ほぼゼロ / 減ってきた (usage gauges), 外部の協力, 人間 (People filter), カードの山 (Tidy my pile), テスト待ち chips, 「」 around button names.

Still worth a human native speaker's look:
- しばらく離れる for "Going quiet" (overnight): 離席 may feel office-like; おやすみモード is an alternative.
- Friends' names are bare ({name}が). さん could be added if testers find it curt.
- `scale.*` slider labels are long; check they fit at narrow widths.
- `pt.*` demo replies and `srv.*` night-watch messages are written as the AI speaking; check the tone.
