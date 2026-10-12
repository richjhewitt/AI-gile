# Azərbaycanca (az, Latin script): first pass

First pass by a model (AIG-495), native-speaker review still to do. File: `public/lang/az.json`, 1939 keys, same keys and order as `en.json`.

## Register
- Casual **sən** (as in LocoRadio's Azerbaijani: "cihazının səsindən istifadə et", "Səni gözləyir"). Buttons use the short imperative ("Yadda saxla", "Ləğv et"); sentences use the 2nd person singular ("Adını yaz").
- Script: Latin (Azerbaijani alphabet with ə, ı, ö, ü, ç, ş, ğ).
- Quotes: « » for names of things in sentences.
- Plurals: Azerbaijani has no plural after a number, so plural objects are `{one, other}` with the same text ("{count} kart"). Numbers are followed by the singular noun.
- No grammatical gender, so nothing to avoid; the pretend friend, agents and the reader are never gendered.
- Placeholders such as `{name}` stay in the nominative; the possessive/dative is avoided by wording ("{name} adlı şəxsə", "{name} layihəsi"). Check these.
- Keyboard keys, `aigile` commands, `npm install`, URLs and file names untouched. Foreign names take a hyphen before suffixes ("Claude-dan", "GitHub-da", "VS Code-da", "AI-nin"). The keyword the lead waits for stays **GO** / Go.
- Dev words inside `{{dev:...}}` markers stay as English loanwords (test, bug, sprint, backlog, commit), with Azerbaijani plural where it appears ("sprintlər").

## Glossary
| English | Azərbaycanca | Note |
|---|---|---|
| card | kart | |
| board | lövhə | |
| project | layihə | |
| lead | lider | "komanda lideri" |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | komanda | |
| helpers | köməkçilər | |
| agent | agent | plural "agentlər" |
| For you | Sənin üçün | `col.verify.short` |
| To do | Görüləcək | |
| In progress | İcrada | |
| Team checking | Komanda yoxlayır | |
| For you to test | Sənin {{dev:test}} etməyin üçün | |
| For the team | Komanda üçün | |
| Done | Hazırdır | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | loanword, plural "sprintlər" |
| Stand-up | Stand-up | loanword |
| inbox | Gələnlər | |
| Setup | Quraşdırma | |
| Usage | İstifadə | plan/token usage |
| test steps | test addımları | |
| Accept / Send back | Qəbul et / Geri qaytar | |
| assumption | fərziyyə | |
| night watch | gecə növbətçisi | `ng.h` "Gecə növbəsi" |
| No Token Mode | Tokensiz rejim | |
| going quiet | sakitləşmək | |
| poke | oyatmaq | "ilişmiş kartı oyatmaq" |
| wake (a team) | oyatmaq | |
| blocked / blocker | bloklanıb / bloker | |
| comment | şərh | |
| DM | şəxsi mesaj | |
| friend | dost | |
| glossary | lüğət | |
| tour | tur | |
| wizard | sehrbaz | |
| pretend friend | uydurma dost | |
| token | token | loanword, plural "tokenlər" |
| Views | Görünüşlər | saved filters |
| Look | Görünüş | project colour/emoji dialog |

## Reviewer should look at
- "lövhə" vs "board", "lider" vs "rəhbər", "oyatmaq" for both wake and poke (the poke contexts say "ilişmiş kartı oyat"), and "sehrbaz" for wizard.
- The `a`/`ı` vowel harmony after foreign names with hyphens (AI-gile-a, AI-gile-ı, AI-nin).
- Long help texts (usage, budget, scale.push.help) for natural flow; they are close to the English structure.
- `gloss.*.also` lists are Azerbaijani plural forms the glossary should match in the UI.
- Dates and durations such as "bu gün", "{n} dəq əvvəl" for natural word order.
