# فارسی (fa): first pass

First pass by a model (Babel, AIG-493), awaiting native-speaker review. File: `public/lang/fa.json`, 1932 keys, same keys and order as `en.json`. Right to left (`"dir": "rtl"` in `languages.json`).

## Register
- Casual, friendly **تو** (informal singular) to match AI-gile's friendly English and LocoRadio's Persian, which also uses "بتوانی". Instructions use the informal imperative ("بنویس", "انتخاب کن", "بزن"); button labels are mostly nouns or infinitive-style ("ذخیره", "لغو", "بستن", "ارسال").
- Persian has no grammatical gender, so nothing needs avoiding. Davy, friends and agents are never gendered ("او" is used only for a person `{name}` where the English says "they").
- Script and punctuation: Persian letters (ک ی, not Arabic ك ي), Persian question mark ؟ and comma ، ; ZWNJ (نیم‌فاصله) in compounds ("می‌کند", "به‌روزرسانی", "هم‌رسانی"). Digits stay Latin (0-9) to match the numbers the page fills in (`fa-IR-u-nu-latn`, as LocoRadio does for dates).
- Plurals: `Intl.PluralRules('fa')` gives `one` / `other`; both are filled in with the same wording because a Persian noun stays singular after a number.
- Loanwords: developer and agile words are written in Persian script as Persian teams say them (بک‌لاگ, اسپرینت, استندآپ, باگ, تست, کامیت, توکن, هوک, ریپو, پوش, مرج). `{{dev:...}}` markers wrap the Persian-script word and every marker word is in its gloss entry's `.also` list (with Latin forms too).
- Kept as is: AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Giphy, Lead Scrum Master, keyboard keys (Enter, Shift, Esc, Escape), `aigile avatar`, `npm install`, `git push`, file names, the keyword **GO**.
- Quotes: «…». Arrows: forward arrows point left (←), back arrows point right (→) for right-to-left layout.

## Glossary
| English | فارسی | Note |
|---|---|---|
| card | کارت | |
| board | بورد | loanword, as software teams say it |
| project | پروژه | |
| team | تیم | |
| lead | لید | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| helper | دستیار | |
| agent | عامل | |
| For you | برای تو | |
| To do | برای انجام | |
| In progress / Doing | در حال انجام | |
| Team checking | بررسی تیم | |
| For you to test | برای تست تو | |
| For the team | برای تیم | |
| Done | انجام‌شده | |
| Backlog | بک‌لاگ | |
| sprint | اسپرینت | |
| stand-up | استندآپ | |
| Kanban / Scrum | کانبان / اسکرام | |
| inbox | صندوق ورودی | |
| Home | خانه | |
| Setup | تنظیمات | |
| Usage | مصرف | |
| test / test steps | تست / مراحل تست | |
| bug | باگ | |
| commit | کامیت | |
| assumption | فرض | "Plug this" = "درستش کن" |
| night watch | نگهبان شب / نگهبانی شب | |
| No Token Mode | حالت بدون توکن | |
| poke | تلنگر | button "👉 تلنگر" |
| Accept / Send back | قبول / پس فرستادن | |
| Wait and see | فعلاً صبر کن | |
| Going quiet | ساکت می‌شوم | button, first person is gender-free in Persian |
| Look (settings) | ظاهر | |
| Permissions | دسترسی‌ها | |
| Views | نماها | |
| Pop out | جدا کردن | |
| friends / DMs | دوستان / پیام‌های مستقیم | |
| relay | رله | |
| pretend friend | دوست نمایشی | |

## For the reviewer
- Register: informal تو throughout; check it is not too casual for the setup/permission and security text (`perm.*`, `share.*`).
- Wording of "Keep the plates spinning" / "Crack the whip" (`sm.push.*`) and "Plug this" (`assume.*`), which are English idioms; "Housework / Errand" (`life.*`) category names.
- Quality of ZWNJ use and whether "بورد" should be "تابلو" for some readers (loanword chosen as teams say it).
- "Team checking" is shortened to "بررسی تیم" to fit the column header.
- Glossary entries and `.also` forms: Persian plural suffix forms (‌ها) are listed for the dev words.
- Titles of the sample demo projects (`demo.*`) and the pretend AI's canned replies were translated rather than kept in English.
