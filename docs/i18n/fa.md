# فارسی (fa): first pass, reviewed

First pass by a model (Babel, AIG-493), then a second, native-speaker-style review by a model (see Review below); a human native speaker has not checked it yet. File: `public/lang/fa.json`, 1939 keys, same keys and order as `en.json`. Right to left (`"dir": "rtl"` in `languages.json`).

## Register
- Polite, friendly **شما**, as in LocoRadio's Persian ("بتوانید", "دستگاهتان", "شماست"; the first pass said LocoRadio uses تو, but it does not). Instructions use the plural imperative ("بنویسید", "انتخاب کنید", "بزنید"); button labels are mostly nouns or infinitive-style ("ذخیره", "لغو", "بستن", "ارسال"). Persian software (Windows, Telegram, Persian apps) speaks to the user with شما; تو in a UI reads as talking to a child or overly familiar, especially in permission, sharing and security text.
- Lines the user says to an agent (quiz answers such as "قبل از هر ساخت از من بپرس", `scale.*` levels, `steps.*`, the quoted request in `usage.off.chat.html`, comments the board posts to the team such as `assume.plug.comment`, `srv.restart.*`) keep the informal imperative: they are instructions to the AI, not the UI speaking to the user.
- Persian has no grammatical gender, so nothing needs avoiding. Davy, friends and agents are never gendered ("او" is used only for a person `{name}` where the English says "they"). First-person lines of the lead and the watchman ("متوقفش کردم") are fine as they are.
- Script and punctuation: Persian letters (ک ی, not Arabic ك ي), Persian question mark ؟ and comma ، ; ZWNJ (نیم‌فاصله) in compounds ("می‌کند", "به‌روزرسانی", "اشتراک‌گذاری"). Digits stay Latin (0-9) to match the numbers the page fills in (`fa-IR-u-nu-latn`, as LocoRadio does for dates).
- Plurals: `Intl.PluralRules('fa')` gives `one` / `other`; both are filled in with the same wording because a Persian noun stays singular after a number.
- Loanwords: developer and agile words are written in Persian script as Persian teams say them (بک‌لاگ, اسپرینت, استندآپ, باگ, تست, کامیت, توکن, هوک, ریپو, پوش, مرج, تسک, پلن, ویزارد). `{{dev:...}}` markers wrap the Persian-script word and every marker word is in its gloss entry's `.also` list (with Latin forms too).
- Kept as is: AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Giphy, Lead Scrum Master, keyboard keys (Enter, Shift, Esc, Escape), `aigile avatar`, `npm install`, `git push`, file names, the keyword **GO**.
- Quotes: «…» (column names inside sentences are quoted: «برای انجام»). Arrows: forward arrows point left (←), back arrows point right (→) for right-to-left layout; key help (`decide.keys`, `inbox.ai.keys`) names the real keyboard key.

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
| task (card type, to-do) | تسک | not کار, which is too vague next to "work" |
| plan (subscription) | پلن | not طرح |
| session | نشست | not جلسه (a meeting) |
| For you | برای شما | |
| To do | برای انجام | |
| In progress / Doing | در حال انجام | |
| Team checking | بررسی تیم | |
| For you to test | برای تست شما | |
| For the team | برای تیم | |
| Done | انجام‌شده | column; a Done button is "تمام" or "انجام شد" |
| Backlog | بک‌لاگ | |
| sprint | اسپرینت | |
| stand-up | استندآپ | |
| Kanban / Scrum | کانبان / اسکرام | |
| inbox | صندوق ورودی | |
| Home | خانه | |
| Setup | تنظیمات | |
| Usage | مصرف | |
| test / test steps | تست / مراحل تست | |
| passed / failed (AI tester) | موفق / ناموفق | not قبول / رد |
| bug | باگ | |
| commit | کامیت | |
| assumption | فرض | "Fine" = "درست است", "Plug this" = "اصلاحش کنید" |
| night watch | نگهبان شب / نگهبانی شب | |
| No Token Mode | حالت بدون توکن | |
| poke | تلنگر | button "👉 تلنگر" |
| Accept / Send back | قبول / برگرداندن | |
| Wait and see | فعلاً صبر کنید | |
| Going quiet | فعلاً نیستم | button and heading; sentences say "در دسترس نیستید"; Go quiet = "🌙 فعلاً می‌روم" |
| Look (settings) | ظاهر | |
| Permissions | دسترسی‌ها | |
| Views | نماها | |
| Pop out | جدا کردن | |
| Share / shared | اشتراک‌گذاری / اشتراکی | not هم‌رسانی (Academy word, rarely used) |
| secret | اطلاعات محرمانه | not راز |
| untrusted | غیرقابل‌اعتماد | not نامعتبر (invalid) |
| paste | جای‌گذاری | as in Windows |
| wizard | ویزارد | not جادوگر (literal) |
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

### Answers (review)
- **Register**: تو does not suit permission, sharing and security text, and it does not suit a Persian UI in general; LocoRadio's Persian uses شما too. The whole file now uses شما (see Register).
- **Idioms**: "چرخ همه‌چیز را بچرخان" and "شلاق بزن" were literal; now "🍽️ همه‌چیز در جریان باشد" and "🏇 با تمام قوا"; "مشتاق" (Keen) is now "پرانرژی". "Plug this" is "اصلاحش کنید", "Fine" is "درست است". `life.*`: "کارهای خانه", "کارهای بیرون".
- **ZWNJ**: correct throughout. **"بورد"**: keep it; software teams say بورد (or برد), "تابلو" reads as a physical noticeboard.
- **"بررسی تیم"**: fine for the column header.
- **Glossary `.also`**: fine.
- **Demo titles**: translating them is right.

## Review
Second pass by a model reading as a native Persian speaker (Babel, AIG-493). Every value was read next to the English. 631 values changed (most of them the تو → شما switch) and the 7 missing keys were added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- **Register**: every UI line that addresses the user moved from تو to شما (imperatives, possessive suffixes ‌ـت → ‌ـتان, "منتظر توست" → "منتظر شماست").
- **Right to left**: "left to right" in `gloss.kanban.text` and `dlg.np.tpl.own.help` now says right to left / in order; `cols.left` / `cols.right` (the ↑ ↓ buttons) say before / after; `tour.rail.short` says the side rail; "top right" in `board.empty.path` is now "بالای صفحه"; `decide.keys` showed ← for the → key.
- **Wrong meaning**: `share.role.theirs` "تو را ساخت" (made you, as in built you) is now "نقش شما را تعیین کرد"; `lead.smRole.help` "wakes teams with To do"; `leave.confirm` had no verb; `ai.chip.*` and `tester.title` used قبول / رد / ردشده, so "skipped" and "failed" looked alike.
- **Terms**: plan = پلن (was طرح), session = نشست (one جلسه), task = تسک, share = اشتراک‌گذاری (was هم‌رسانی), secret = اطلاعات محرمانه (was راز), untrusted = غیرقابل‌اعتماد (was نامعتبر), wizard = ویزارد (was جادوگر), news = خبرها (was اخبار), Age = عمر (was قدمت), accessory = اکسسوری (was ابزار), smoke check = بررسی سریع (smoke) (was بررسی دود), Done buttons = تمام / انجام شد.
- **Natural wording**: "ساکت می‌شوم / ساکت شو" → "فعلاً نیستم / فعلاً می‌روم"; "باشه؟" → "موافقید؟"; "انبار" (warehouse) for "pile" → "کارت‌ها / فهرست کارها"; "هیچ کارتی جور نیست" → "هیچ کارتی پیدا نشد"; "زیادی بزرگ" → "بیش از حد بزرگ"; priority "کم / زیاد" → "پایین / بالا".
- **Still for a human native speaker**:
  - The شما switch itself: if Rich wants AI-gile's Persian deliberately casual like its English, the first pass's تو can be restored from git history (one commit).
  - "فعلاً نیستم" for Going quiet and "تلنگر" for poke.
  - "عامل" for agent: correct, but many Persian developers just say "ایجنت".
  - "پیوند" for a project link between friends; "اتصال" may read better.
  - In right-to-left the → key still means "next" (`inbox.ai.keys`, `decide.keys`, the tour): a code question, not a wording one.
