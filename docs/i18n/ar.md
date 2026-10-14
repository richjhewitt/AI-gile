# العربية (ar): first pass

First pass by a model (AIG-493), for a native-speaker check. File: `public/lang/ar.json`, 1932 keys, same keys and order as `en.json`. Modern Standard Arabic, right to left (`"dir": "rtl"` is already in `languages.json`). Dates use `ar-u-nu-latn` (Latin digits); numbers in the text are written with Latin digits too.

## Register
- Modern Standard Arabic, friendly and plain, as in LocoRadio's Arabic. Buttons and labels use the verbal noun (masdar: "حفظ", "إلغاء", "إرسال", "إعادة التحميل"), which carries no gender. Sentences address the reader with "ك" (possessive/object, written the same for all genders: "لك", "قرارك", "بانتظارك") or with passives and nouns, never with gendered 2nd-person verbs or adjectives.
- Roles in the team lists are written as activities ("اختبار", "تطوير", "إدارة", "مشاهدة") instead of person nouns, to avoid a masculine default. Level words (`prof.level.*`) are plain adjectives and may need a look.
- Plurals: all six categories `zero`, `one`, `two`, `few`, `many`, `other` for the 8 plural objects. `zero`, `one` and `two` use the word forms ("بطاقتان", "جلسة واحدة") and may omit `{count}`; `few` is 3 to 10, `many` is 11 to 99 (accusative singular noun), `other` is 100 and up. Simple `{n}` strings elsewhere use a neutral order ("{n} بطاقات") without number agreement, so check the few spots flagged below.
- Arrows are mirrored by hand where English uses ← or → to mean back/next (for example `docs.back` "→ المستندات", `decide.skip` "تخطّي ←").
- Quotes: «…». Keyboard keys, `aigile` commands, URLs, product and model names stay in Latin script.

## Glossary
| English | العربية | Note |
|---|---|---|
| card | بطاقة | |
| board | لوحة | |
| project | مشروع | |
| lead | قائد | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | فريق | |
| helpers | مساعدون | |
| agent | وكيل (وكلاء) | |
| For you | لك | `col.verify.short` |
| To do | للتنفيذ | |
| In progress | قيد التنفيذ | |
| Team checking | الفريق يراجع | |
| For you to test | بانتظار اختبارك | |
| For the team | للفريق | |
| Done | منجزة | |
| Backlog | باكلوج | transliterated loanword |
| Sprint | سبرنت | transliterated, plural "سبرنتات" |
| Stand-up | ستاند أب | transliterated |
| Kanban / Scrum | كانبان / Scrum | |
| Inbox | الوارد | |
| Setup | الإعداد | |
| Usage | الاستخدام | |
| Home | الرئيسية | |
| test steps | خطوات الاختبار | |
| bug | خلل | "باغ" accepted in the glossary list |
| commit | كوميت | |
| branch / merge / push | فرع / دمج / دفع | |
| repo | مستودع | |
| assumption | افتراض | |
| night watch | المناوبة الليلية | the watchman is "المراقب الليلي" |
| No Token Mode | وضع بلا توكن | |
| token | توكن | |
| poke | تنبيه | button "👉 تنبيه" |
| Accept / Send back | قبول / إرجاع | |
| Views | العروض | |
| Stand-up report | تقرير ستاند أب | |
| Look (settings) | المظهر | |
| Permissions | الأذونات | |
| Going quiet | فترة هدوء | |
| Friends (DMs) | الأصدقاء | |
| Tour | جولة | |
| Go (answer) | موافق | `dms.go`, `act.go` |
| refresh (page) | إعادة التحميل | not "إنعاش" |
| plug (an assumption) | تصحيح | not "سدّ" |
| code block | مقطع | not "كتلة" |
| AI tester | مختبِر الذكاء الاصطناعي | an AI, so the masculine noun is fine |

## For the reviewer
- **Gender**: check there is no leftover masculine default. Spots to look at: `prof.level.*` (مبتدئ، متوسط، متقدم، رئيسي), "القائد" / "الوكيل" as role nouns, and the first-person bot lines in `srv.*`, which are written with forms that carry no gender where possible.
- `{{dev:...}}` markers carry the displayed Arabic word and must match `gloss.*.word` or `.also`. Check that the inflected forms (with ال, ك, ل prefixes) highlight as intended: for example "اختبارك", "للاختبار", "السبرنتات", "كوميتًا".
- Plural `many` forms use "{count} بطاقة" (11 to 99): check each object reads naturally (`inbox.g.count`, `dlg.find.commits`, `dlg.find.sessions`, `queue.bump.title`, `tidy.toast`, `quiet.done.told`, `quiet.done.woke`, `join.exp.days`).
- Some labels have the English "n of N" style with no noun agreement (for example `poke.many` "{n} فرق", `dms.count.many` "{n} رسائل", `inbox.sum.*.many`). The wording is correct for 3 to 10 but not exact for larger counts.
- RTL: strings that mix Latin words (AI-gile, Claude, `aigile avatar`, keys) rely on bidi; check punctuation placement next to them.
- "Poke" as "تنبيه" and "night watch" as "المناوبة الليلية" are choices to confirm.
- The pretend friend's name Davy is kept; the friend is addressed by name only.

## Review (AIG-493)
Second pass by a model reviewing as a native speaker: every value read next to the English. 289 values changed.

Answers to the questions above:
- **Gender**: the first pass still had many masculine forms aimed at the reader: imperatives (اكتب، انقر، اضغط، اختر، أضف، افتح، الصق، حدّد، اسأل، راسل، ابدأ، فعّل، جرّب)، present-tense "you" verbs (تريد، ترى، تكتب، تشاركها، تحدد، تنقر، توافق) and adjectives (متأكدًا، غائبًا، جاهزًا، متصل). All are now gender-free: a masdar ("بدء الجولة"، "إضافة عنصر")، a passive ("لم يُكتب شيء بعد"، "يُلصق هنا")، "يلزم / يمكن + masdar"، "النقر يغيّره"، or past tense and "ك" forms, which are written the same for both genders. Lines the reader says to the app or to an agent ("رتّبها لي"، "استأذنني"، "أرني على أي حال") keep the imperative, as they are spoken to the lead.
- `prof.level.*` (مبتدئ، متوسط، متقدم، رئيسي) describe an agent's role level, not the reader: kept. The lead, agents and the pretend friend Davy stay masculine; a real friend {name} also takes masculine verbs ("أنهى {name}"، "رفض {name}"), the usual Arabic default; "اسمه" in the add-friend form is now "الاسم".
- Markers: all `{{dev:...}}` words are in `gloss.*.word` / `.also`; the inflected forms already listed there (اختبارك، للاختبار، السبرنتات، كوميتًا، كوميتان) cover every marker.
- Counts outside plural objects now use "Label: {n}" ("أسئلة: {n}"، "للتنفيذ: {n}"، "الردود: {n}"، "بانتظارك: {n}"، "البطاقات: {cards}، التعليقات: {comments}…"), so no noun has to agree with the number. The eight plural objects were right and are unchanged.
- "Poke" as "تنبيه" and the night watch as "المناوبة الليلية" / "المراقب الليلي": kept.

Other changes:
- RTL meaning: "left to right" for typed column names is now "من اليمين إلى اليسار" (the board mirrors), and the projects rail is "على اليمين".
- Wrong or odd words: "إنعاش" for refresh, "كتلة" for a code block, "سدّ" for plug, "الأقدم (الأحدث أولًا)" for Earlier, "خلل" in an error message (it is the glossary word for bug), "ثم hooks" for "plus hooks".
- Tour, wizard, usage, sharing and pack texts reworded around the gender rule; "تصبحون على خير" kept as a polite plural.

For a human native speaker to check:
- Whether the masdar and passive style reads naturally in long help texts, or a "يمكنك …" style would sound friendlier.
- The day abbreviation "ي" in `ago.d` / `usage.unit.d` (د and س are common; ي is less so).
- Transliterations (باكلوج، سبرنت، ستاند أب، كوميت، توكن) against the Arabic terms developers in your region use.
