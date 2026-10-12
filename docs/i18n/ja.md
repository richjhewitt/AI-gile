# AI-gile in Japanese (ja), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Friendly polite です/ます style throughout, matching LocoRadio's Japanese and the casual English. No だ/である plain style, no heavy keigo.
- Imperatives as ください / ましょう; "あなた" is used only where a label needs a subject ("あなたの番", "あなたの返事待ち").
- Kanji, hiragana and katakana mixed; software loanwords in katakana (スプリント, バックログ, バグ, テスト). Full-width punctuation: 、。（） ！ ？ and a full-width colon avoided in favour of ": " with an ASCII colon plus space, as LocoRadio does in labels.
- No spaces between Japanese and placeholders unless the English needed them.
- Durations: 分, 時間, 日. Plurals not marked; counters 件, 枚, 個, チーム.
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
| For you | あなたの番 | |
| For you to test | あなたが テストする番 | "あなたが{{dev:テスト}}する番" |
| To do | やること | |
| In progress / Doing | 進行中 | |
| Team checking | チーム確認中 | |
| For the team | チームの番 | |
| Done | 完了 | |
| Backlog | バックログ | |
| sprint | スプリント | |
| stand-up | スタンドアップ | |
| inbox | 受信箱 | |
| Setup | セットアップ | |
| Usage | 使用量 | |
| test | テスト | |
| test steps | テスト手順 | |
| Accept | 承認 | |
| Send back | 差し戻す | |
| Wake (the team) | 起こす | |
| poke | つつく | |
| assumption | 仮定 | |
| night watch | 夜間の見張り | |
| No Token Mode | トークンなしモード | |
| Stuck / blocked | 停止中 / ブロック中 | |
| Look (🎨) | 見た目 | |
| Permissions | 権限 | |
| Views | ビュー | |
| DM | DM | |
| Message | メッセージ | |
| Glossary | 用語集 | |
| Tour | ツアー | |
| agent | エージェント | |
| token | トークン | |

## For the reviewer
- "For you" as あなたの番 and "For the team" as チームの番: check they read well as column names and in running text.
- Colon style: many labels keep the English-style ": " (ASCII colon and space) to match the rest of the app; a native may prefer a full-width colon.
- "Poke" つつく is playful; 催促 may be more common but less friendly.
- `leave.confirm` uses `{what}して` with `update.what.*` (アップデート, 再読み込み, 再起動); all three accept して.
- Katakana long vowels follow the common JIS style (ユーザー, サーバー, ブラウザー, コンピューター); check for consistency (a few places use エディター, ブラウザー).
- `act.*.say` and `card.looksright.say` are sent as comments to the AI team; they were translated, not left in English.
- Kept identical to English on purpose: Lead Scrum Master, VS Code, the ssh and path placeholders, GIPHY credit, emoji-only keys.
