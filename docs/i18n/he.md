# עברית (he): first pass

First pass by a model (AIG-493), then a native-speaker review by a model (see Review below). File: `public/lang/he.json`, 1939 keys, same keys and order as `en.json`. Right to left (`"dir": "rtl"` in `languages.json`).

## Register
- Casual, addressing the reader in the **plural imperative** ("לחצו", "נסו", "שמרו"), as in LocoRadio's Hebrew. It avoids masculine/feminine singular forms. Buttons and labels are nouns or verbal nouns ("שמירה", "ביטול", "הגדרות").
- No slashed forms. Where a verb would be gendered (agents, a friend, the reader) a noun, passive or "על ידי {name}" is used ("הבדיקה אושרה על ידי {name}"). Present-tense masculine remains only for role nouns (ראש הצוות, בודק, מפתח) and for Davy, the pretend friend.
- Plurals: `one` / `two` / `other` (Intl `he`). `one` may drop `{count}` ("כרטיס אחד").
- Arrows: forward and back arrows are flipped for RTL (`← ` after the text for "next", `→ ` before for "back"). Keys and key hints (Enter, Shift+Enter, Esc, ← →) stay as in English.
- Keys, `aigile` commands, URLs, names (AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows) and `.aigile` untouched. The keyword stays **GO**. Latin terms inside Hebrew text are joined with a hyphen ("ב-GitHub", "ל-AI").
- Wake: the verb is "להעיר" ("העירו את הצוות", "הוער", "הוערו"), the noun and the ▶ button "השכמה". "להשכים" means to get up early and is not transitive, so it was dropped. Context keeps "להעיר" apart from "הערה" (comment); a comment is "תגובה" anyway.

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
| wake | להעיר (verb), השכמה (noun) | not להשכים |
| checklist | רשימת תיוג | |
| Being checked / Being tested (shared board) | בבקרה / בבדיקה | |
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

### Answers (review)
- Plural-you imperative: right for a casual work tool, and it avoids gender. Kept. Future-as-imperative ("תכתבו", "תגידו", "תסתכלו") became a real imperative ("כתבו", "אמרו", "הסתכלו").
- Loanwords: fine as they are; Israeli teams say בקלוג, ספרינט, באג, קומיט, פוש, דיפלוי. The Scrum column names left in English (Product backlog, Sprint backlog, Review) now follow the glossary: בקלוג מוצר, בקלוג ספרינט, סקירה.
- "ראש הצוות" next to "Lead Scrum Master": reads well; the SM keeps its English name.
- RTL: the board mirrors, so "left to right" in the column help and the Kanban gloss now says "מימין לשמאל", and the column dialog's Move left / Move right (earlier / later column) are "הזזה ימינה" / "הזזה שמאלה". Back arrows "→" before the text and forward "←" are right.
- `{n}%` without a space: correct for Hebrew.

## Review
Native-speaker pass (AIG-493): 112 values, 105 changed and 7 new keys added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- Wake: "להשכים" (not transitive in Hebrew) replaced by "להעיר" in about 20 strings; "השכמה" stays as the noun and on the ▶ button.
- Gendered first person removed: "שאני מסמן" → "שסימנתי", "מה אני אמור לראות" → "מה אמור להופיע"; a friend's answer no longer says "{name} אומר"; "איתם" for one friend reworded.
- Inbox is always "דואר נכנס" (no more "התיבה הנכנסת" / "תיבת הדואר").
- A placeholder glued to a Hebrew prefix ("ב{col}") reworded ("בעמודה {col}") so a Latin column name still reads right; typos "ממה-git" and "בכל היותר" fixed.
- Clumsy lines rewritten, e.g. `poke.many`, `home.unanswered`, `trial.help`, `usage.bars.explain`, `dmf.words.help`, `share.lane.note`, `wz.4.h`, `help.offer.h`, `fx.sum.l2`, `prof.level.*`, checklist (רשימת תיוג), `wait.h`, and the night-watch switch name (now "שומר הלילה על כל הפרויקטים", matched in `sm.night.title`).
- Still for a human: `cols.left` / `cols.right` assume the mirrored board (the dialog itself shows ↑ ↓); `dms.count.one` is "{n} הודעה" because the key must keep `{n}` (Hebrew would say "הודעה אחת"); `usage.kind.pack` ("עוזר ההעתקה ל-AI אחר") is a guess at the pack helper's name; look at the `srv.*` markdown lines on screen.
