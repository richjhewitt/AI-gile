# اردو (ur): first pass

First pass by a model (Babel, AIG-493), awaiting native-speaker review. File: `public/lang/ur.json`, 1932 keys, same keys and order as `en.json`. Right to left (`"dir": "rtl"` in `languages.json`).

## Register
- Polite **آپ** throughout (never تم or تو), matching LocoRadio's Urdu ("محفوظ کریں", "بند کریں"). Buttons and instructions use the آپ imperative ("کریں", "چنیں", "لکھیں"), which carries no gender.
- Script: Urdu Nastaliq-style Arabic script, Urdu punctuation (۔ full stop, ، comma, ؟ question mark). Digits stay Latin (0-9) so they match the numbers the page fills in; Urdu dates use `ur-PK`.
- Plurals: `Intl.PluralRules('ur')` gives `one` / `other`. Both are filled in; nouns after a number rarely change in Urdu, so the two forms are often identical.
- Gender (per the brief): no slash forms and no masculine default. The reader, friends and the speaking lead are never gendered: present tense, passive ("روک دیا گیا"), nouns or the آپ imperative are used instead. First-person lines of the Scrum Master and the lead ("I stopped restarting it") are written in the passive ("دوبارہ چلانا بند کر دیا گیا"). Grammatical masculine remains only where it agrees with a masculine noun (ایجنٹ, لیڈ, ٹیم رکن, بورڈ) and for the plural-honorific "وہ / ان" for a friend `{name}`.
- Loanwords: agile and developer words are written in Urdu script the way Urdu-speaking software teams say them (بیک لاگ, اسپرنٹ, اسٹینڈ اپ, بگ, ٹیسٹ, کمٹ, ٹوکن, ایجنٹ). `{{dev:...}}` markers wrap the Urdu-script word and every marker word is in its gloss entry's `.also` list.
- Kept as is: AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Giphy, Lead Scrum Master, Scrum Master roles, keyboard keys (Enter, Shift, Esc, Escape), `aigile avatar`, `npm install`, `git push`, file names, the keyword **GO**.
- Arrows: forward arrows point left (←), back arrows point right (→) in the translated strings, so they read correctly in right-to-left layout.

## Glossary
| English | اردو | Note |
|---|---|---|
| card | کارڈ | |
| board | بورڈ | |
| project | پروجیکٹ | |
| team | ٹیم | |
| lead | لیڈ | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| helper / agent | مددگار / ایجنٹ | |
| For you | آپ کے لیے | `col.verify.short` |
| To do | کرنا ہے | |
| In progress / Doing | جاری | |
| Team checking | ٹیم جانچ رہی ہے | |
| For you to test | آپ کے ٹیسٹ کے لیے | |
| For the team | ٹیم کے لیے | |
| Done | مکمل | |
| Backlog | بیک لاگ | |
| sprint | اسپرنٹ | |
| stand-up | اسٹینڈ اپ | |
| Kanban / Scrum | کانبان / اسکرم | |
| inbox | ان باکس | |
| Home | ہوم | |
| Setup | سیٹ اپ | |
| Usage | استعمال | |
| test / test steps | ٹیسٹ / ٹیسٹ کے مراحل | |
| bug | بگ | |
| commit | کمٹ | |
| assumption | مفروضہ | "Plug this" = "اسے درست کریں" |
| night watch | رات کی نگرانی | the watchman = رات کا نگران |
| No Token Mode | نو ٹوکن موڈ | |
| poke | ٹہوکا | button "👉 ٹہوکا" |
| Accept / Send back | قبول کریں / واپس بھیجیں | |
| Wait and see | ابھی انتظار کریں | |
| Going quiet | خاموش ہونا | |
| Look (settings) | ظاہری شکل | |
| Permissions | اجازتیں | |
| Views | ویوز | |
| Pop out | الگ کریں | |
| friends / DMs | دوست / ڈائریکٹ میسجز | |
| relay | ریلے | |
| pretend friend | فرضی دوست | |

## For the reviewer
- Check the register of the first-person lead/Scrum Master lines (`srv.*`, `sm.*`): they are in the passive to avoid gender; a native speaker may prefer a different neutral phrasing.
- Wording of "Plug this" (`assume.*`) and "Crack the whip" / "Keep the plates spinning" (`sm.push.*`), which are English idioms.
- Short labels that must fit buttons: the relative-time keys (`ago.*`, "{n} منٹ پہلے") and `usage.unit.*` (دن / گھ / منٹ). `گھ` is an abbreviation for گھنٹہ; confirm it reads naturally.
- The glossary `.also` lists include both Urdu-script and Latin forms so the hover explanation matches either.
- Titles of the sample demo projects (`demo.*`) and the pretend AI's canned replies were translated rather than kept in English.
