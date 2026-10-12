# עברית (he): first pass

First pass by a model (AIG-493), native-speaker check still to do. File: `public/lang/he.json`, 1932 keys, same keys and order as `en.json`. Right to left (`"dir": "rtl"` in `languages.json`).

## Register
- Casual, addressing the reader in the **plural imperative** ("לחצו", "נסו", "שמרו"), as in LocoRadio's Hebrew. It avoids masculine/feminine singular forms. Buttons and labels are nouns or verbal nouns ("שמירה", "ביטול", "הגדרות").
- No slashed forms. Where a verb would be gendered (agents, a friend, the reader) a noun, passive or "על ידי {name}" is used ("הבדיקה אושרה על ידי {name}"). Present-tense masculine remains only for role nouns (ראש הצוות, בודק, מפתח) and for Davy, the pretend friend.
- Plurals: `one` / `two` / `other` (Intl `he`). `one` may drop `{count}` ("כרטיס אחד").
- Arrows: forward and back arrows are flipped for RTL (`← ` after the text for "next", `→ ` before for "back"). Keys and key hints (Enter, Shift+Enter, Esc, ← →) stay as in English.
- Keys, `aigile` commands, URLs, names (AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows) and `.aigile` untouched. The keyword stays **GO**. Latin terms inside Hebrew text are joined with a hyphen ("ב-GitHub", "ל-AI").
- Wake (the verb) is "להשכים / השכמה", not "להעיר" (which also means to comment).

## Glossary
| English | עברית | Note |
|---|---|---|
| card | כרטיס | |
| board | לוח | |
| project | פרויקט | |
| lead | ראש הצוות | role noun |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | צוות | |
| helpers | עוזרים | |
| agent | סוכן | |
| For you | בשבילכם | |
| To do | לביצוע | |
| In progress | בעבודה | |
| Team checking | הצוות בודק | |
| For you to test | ממתין לבדיקה שלכם | |
| For the team | בשביל הצוות | |
| Done | הושלם | |
| Backlog | בקלוג | `{{dev:בקלוג}}` |
| Sprint | ספרינט | |
| Stand-up | סטנדאפ | |
| Kanban / Scrum | קנבן / סקרם | |
| Inbox | דואר נכנס | |
| Setup | הגדרות | |
| Usage | שימוש | |
| Home | בית | |
| test steps | שלבי בדיקה | |
| bug / commit | באג / קומיט | |
| assumption | הנחה | |
| night watch | משמרת לילה | the watchman is "שומר הלילה" |
| No Token Mode | מצב ללא טוקנים | |
| poke | דחיפה | |
| wake | השכמה | |
| needs you | מחכה לכם | |
| Go (button) | קדימה | the keyword stays GO |
| Pop out | פתיחה בחלון | |
| Accept / Send back | אישור / שליחה חזרה | |
| Wait and see | לחכות ולראות | |
| Views | תצוגות | |
| Look (settings) | מראה | |
| Permissions | הרשאות | |
| Going quiet | הולכים לשקט | |
| pretend friend | חבר מדומה | |
| relay | ממסר | |

## For the reviewer
- Plural-you imperative throughout: check it is the right level of casual for a work tool.
- Hebrew terms vs loanwords: בקלוג, ספרינט, סטנדאפ, באג, קומיט, טוקן, פוש, ריפו, דיפלוי are transliterated, as Israeli teams usually say; "בדיקה" is used for test (also inside `{{dev:...}}`).
- "ראש הצוות" for lead, and the plural "ראשי צוותים", are role nouns; check they feel right next to "Lead Scrum Master".
- RTL: mixed strings with `{placeholders}`, English names and arrows should be looked at on screen, in particular `usage.*`, `srv.*` (markdown with backticks) and the arrows in `setup.next`, `home.usage.left`, `tour.*`.
- `{n}%` and `{pct}%` are written without a space, as LocoRadio does.
- `gloss.*.also` lists forms used in `{{dev:...}}` markers (checked by script).
