# اردو (ur): first pass

First pass by a model (Babel, AIG-493), then a second, native-speaker-style review by a model (see Review below); a human native speaker has not checked it yet. File: `public/lang/ur.json`, 1939 keys, same keys and order as `en.json`. Right to left (`"dir": "rtl"` in `languages.json`).

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
| Going quiet | کچھ دیر آف لائن | button and heading; sentences say "اگلے چند گھنٹے آپ دستیاب نہیں" or "آپ کی خاموشی کے دوران" |
| Go quiet (button) | آف لائن ہو جائیں | |
| Status (column, field) | صورتحال | not حیثیت (that means standing) |
| key (API / secret) | کلید | چابی only in the metaphor "لنک ہی واحد چابی ہے" |
| secret (in a card) | خفیہ معلومات | not راز |
| Send to (label) | کسے بھیجیں | |
| Crack the whip / Keep the plates spinning | پوری رفتار / سب کچھ چلتا رکھیں | `sm.push.*` |
| They match (safety words) | ایک جیسے ہیں | |
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

### Answers (review)
- **Passive first-person lines** (`srv.*`, `sm.*`, `pt.*`): they read naturally. "دوبارہ چلانا بند کر دیا گیا", "رن روک دیا گیا", "ٹھیک کر دیا گیا، معذرت!" and "سائن اپ فارم پر کام جاری رہے گا" are what an Urdu UI would say; kept. "شروع نہیں ہو سکا" for "I couldn't start" is fine.
- **The reader was still gendered in a few places** (masculine "آپ … رہے ہیں / چاہتے ہیں / تھے"): `quiet.confirm`, `home.quiet.title`, `sm.night.what`, `quiet.until.help`, `lead.watchAll.help`, `dlg.find.keychanged`, `tour.welcome.text`, `tour.foryou.why`, `tour.chat.short`, `tour.intro`, `tour.lvl.new`, `quiz.h`, `quiz.steps`, `fx.sum.h`, `budget.pace`, `tester.title`, `fy.tester.title`, `gloss.standup.text`. All rewritten with nouns or the passive.
- **"Plug this"**: "اسے درست کریں" is right. **"Crack the whip"**: "چابک چلائیں" was too literal; now "🏇 پوری رفتار". "Keep the plates spinning" = "سب کچھ چلتا رکھیں" kept.
- **`گھ`** is not an Urdu abbreviation; `usage.unit.h` is now "گھنٹے". `ago.*` with full words is fine.
- **Glossary `.also`**: correct as is.
- **Demo titles**: translating them is right.

## Review
Second pass by a model reading as a native Urdu speaker (Babel, AIG-493). Every value was read next to the English. 187 values changed and the 7 missing keys were added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- **Gender**: see Answers above; the reader is now never gendered except in the generic "آپ … سکتے ہیں" help lines (`sb.can.*`, `quiz.sub`, `wz.*`), which is the normal UI form.
- **Register**: two تم-forms removed ("شامل کر دو" in `usage.off.chat.html`, "کام شروع کرو" in `wz.style.fast`).
- **Right to left**: "left to right" in `gloss.kanban.text` and `dlg.np.tpl.own.help` now says right to left / in order; `cols.left` / `cols.right` (the ↑ ↓ buttons) say earlier / later instead of left / right; `tour.rail.short` says the side rail instead of "on the left"; "top right" in `board.empty.path` is now just "اوپر". `decide.keys` showed ← for the → key: the key help now names the real key.
- **Calques and wrong words**: "تھپتھپائیں" (tap), "میل کھاتا ہے" for search results, "حیثیت" for status, "بند الفا", "کی قدر" for a value, "اِن / آؤٹ" for input/output, "ننھا" (cute tiny), "چابیاں" for keys, "راز" for secrets, "پیشگوئی" spelling, "{i} از {n}" (Persian "از") → "{n} میں سے {i}", "کے ساتھ شیئر کریں..." starting with a postposition, labels starting with a postposition ("سے جوڑیں", "کے لیے", "میں منتقل کریں…").
- **Meaning**: "{name} نے ابھی نہیں کہا" read as "hasn't said yet"; now "{name} نے کہا: ابھی نہیں". `share.role.theirs` "نے آپ کو بنایا" (made you) is now "نے آپ کو یہ کردار دیا". "Waits for" labels now ask "کس کا انتظار".
- **Column names in sentences** are now in quotes ("آپ کے لیے", "مکمل", "کرنا ہے", "جاری").
- **Still for a human native speaker**:
  - "🌙 کچھ دیر آف لائن" for Going quiet, and "شب بخیر / آرام سے سوئیں" in the quiet dialog.
  - "ٹہوکا" for poke: understood, a bit playful; "یاد دہانی" is the sober alternative.
  - "پیش گوئی" for the usage forecast; "اندازہ" may read better.
  - Masculine agreement for the lead, agents and the AI tester ("لیڈ … کرتا ہے") is grammatical, not gendering; the friend `{name}` takes the honorific plural.
  - In right-to-left the → key still means "next" (`inbox.ai.keys`, `decide.keys`, the tour): a code question, not a wording one.
