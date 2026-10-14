# AI-gile in Thai (th)

First pass written by Babel for AIG-490; native-speaker review below (AIG-490).

## Register
- Friendly, neutral-polite Thai, matching LocoRadio's Thai: no ครับ/ค่ะ particles, no heavy pronouns. "คุณ" for "you", dropped where Thai reads better without it.
- Questions end in ไหม ("Archive it?" = "...ไหม"); imperatives are plain verbs ("คลิก", "พิมพ์", "เลือก").
- Thai script, no spaces between words; "ๆ" written as " ๆ" with a space before it ("สบาย ๆ") for readability.
- UI names quoted inside running text use straight double quotes ('ย้ายไปที่ "ต้องทำ"'), so a label never melts into the sentence around it.
- Latin digits. Durations: นาที, ชม., วัน. Dates follow th-TH (Intl); the board may show Buddhist-era years.
- Plurals: Thai has none. Plural objects (`{count}`) use only the `other` category, as Intl.PluralRules gives for Thai. Counts take a classifier where Thai needs one (การ์ด 3 ใบ, 5 รายการ, 2 คน).
- `{{dev:...}}` markers kept around the dev word in Thai transliteration (e.g. `{{dev:สปรินต์}}`, `{{dev:บั๊ก}}`, `{{dev:ทดสอบ}}`, `{{dev:คอมมิต}}`, `{{dev:Backlog}}`). The `gloss.*.also` lists carry both the Thai spelling and the English word so hovers can match either.

## Glossary
| English | Thai | Note |
|---|---|---|
| card | การ์ด | classifier ใบ |
| board | บอร์ด | |
| project | โปรเจกต์ | |
| team | ทีม | |
| lead | หัวหน้า / หัวหน้าทีม | "Lead" kept for the label |
| Lead Scrum Master | Lead Scrum Master | kept |
| Scrum Master | Scrum Master | kept |
| For you | ถึงคุณ | |
| To do | ต้องทำ | |
| In progress / Doing | กำลังทำ | |
| Team checking | ทีมกำลังตรวจ | |
| For the team | ถึงทีม | |
| Verify column ("For you to test") | รอคุณทดสอบ | |
| Done | เสร็จแล้ว | "เสร็จ" for dialog buttons |
| Backlog | Backlog | kept in Latin; glossary word แบ็กล็อก |
| sprint | สปรินต์ | |
| stand-up | สแตนด์อัป | |
| inbox | กล่องข้อความ | |
| Setup | ตั้งค่า | |
| Usage | การใช้งาน | |
| test / test steps | ทดสอบ / ขั้นตอนทดสอบ | |
| Send back | ส่งกลับ | |
| Accept | ยอมรับ | |
| Wake (team) | ปลุก | |
| Poke | สะกิด | |
| night watch | เวรกลางคืน | "Night watchman" and "Watchman" kept in Latin |
| Going quiet | ขอเงียบสักพัก | |
| Not now (friend's question) | ไว้ทีหลัง | was ไม่ตอนนี้, a calque |
| assumption | ข้อสมมุติ | |
| Plug this (assumption) | ขอแก้อันนี้ | |
| No Token Mode | โหมดไม่ใช้โทเคน | |
| token | โทเคน | |
| agent | เอเจนต์ | classifier ตัว |
| role | บทบาท | |
| helper | ผู้ช่วย | |
| brief | บรีฟ | |
| starter team / main team | ทีมเริ่มต้น / ทีมหลัก | |
| Look (🎨) | ลุค | |
| Permissions | สิทธิ์ | |
| Views | มุมมอง | |
| DM | DM | |
| Pop out / its own window | แยกหน้าต่าง / หน้าต่างแยก | was หน้าต่างของมันเอง, a calque |
| Roomy / Compact | กว้าง / กะทัดรัด | |
| Group (cards) | กลุ่ม | |
| Space | สเปซ | |
| Life board | บอร์ดชีวิต | |
| Focus | โฟกัส | |
| Checklist | เช็กลิสต์ | |
| branch | แบรนช์ | was บรานช์ |
| commit | คอมมิต | |
| Hook | hook / ฮุก (glossary) | kept Latin in UI |
| Blocked / blocker | ติดขัด | |
| Stuck | ติดอยู่ | |
| By hand (usage checks) | กดเอง | |
| Heard from (last contact) | ติดต่อมา | was ได้ยิน, a calque |

## Answers to the first pass's questions
- Blocked ติดขัด vs stuck ติดอยู่: they read as distinct enough (blocked = held up by something, stuck = the team keeps stopping). Kept, and used consistently.
- "Plug this": in the assumptions list it means "patch / correct this guess". ขอแก้อันนี้ (ask to change it) is right; the confirmation stays แก้แล้ว.
- Scrum Master diligence jokes: "Keep the plates spinning" was a literal calque (จานหมุน means nothing in Thai); now แค่ประคองให้งานเดินไป. "Crack the whip" เร่งสุดแรง keeps the tone.
- Glossary hover matching: transliterations such as ทดสอบ or บั๊ก can match inside longer words because Thai has no spaces. Not fixable in the translation; noted below for a human check in the UI.
- 5h / 7d as "5 ชม." / "7 วัน": that is what Thai users expect. A space now follows ชม. in "{n} ชม. ก่อน".
- Mixed Latin terms (Backlog, Review, Frontend, Backend, DevOps, Kanban) are fine; Thai software teams say them in English.

## Review
Native-speaker pass over all 1,929 keys (AIG-490). 281 values changed: 181 keys that were missing (en.json gained them after the first pass) and 100 edits.
- Added the 181 missing keys: night-watch poke reasons (`poke.*`), demo projects and the pretend team's canned replies (`demo.*`, `pt.*`, `pf.*`), server messages (`srv.*`), the "How agents work with you" sliders (`scale.*`), the Team dialog (`tm.*`, `pe.*`, `mt.*`), `lang.fun`.
- Plural keys (`inbox.g.count`, `dlg.find.commits`, `dlg.find.sessions`, `queue.bump.title`, `tidy.toast`, `quiet.done.told`, `quiet.done.woke`, `join.exp.days`) are now `{ "other": ... }` objects.
- Stale translations where English had changed: `wz.adv.roles.h`, `wz.adv.roles.sub`, `wz.adv.row.roles` (starter team); restored the 👥 in `board.team`.
- Wrong meaning fixed: `lead.watchAll` and `sm.night.title` ("ticks every project" is a tick box, not "checks"), `filter.anyone` (ใครก็ได้ = "whoever", now ทุกคน), `home.quiet.title` (ปิดเครื่อง = shut the computer down), `runin.help`, `usage.th.session` / `usage.th.week` ("sessions used" → "used (session)"), `tour.done.text` ("raise a card" is create, not report), `quiz.help` (sliders, not switches).
- Calques replaced: หน้าต่างของมันเอง → หน้าต่างแยก everywhere, ได้ยิน → ติดต่อมา, ไม่ตอนนี้ → ไว้ทีหลัง, ไม่ใช่วันนี้ → วันนี้ไม่ต้อง, "หาทางรอบ ๆ" in the tour, ในฐาน → ในนาม / ในฐานะ.
- Classifiers added where counts read bare: การ์ด {n} ใบ, {n} รายการ, เอเจนต์ {total} ตัว, {n} โปรเจกต์ข้างใน.
- Consistency: เก็บถาวรโปรเจกต์ (archive), กว้าง for Roomy, กองงาน for "pile", กดเอง for "By hand", อินพุต / เอาต์พุต for token In / Out, แบรนช์ for branch.

Still worth a human native speaker's look:
- Glossary hovers on Thai transliterations (ทดสอบ, บั๊ก, สปรินต์) may light up inside longer words; check in the UI with dev-word hints on.
- `scale.*` slider labels and `scale.push.help` are long; check they fit at narrow widths.
- `pt.*` demo replies and `srv.*` night-watch messages speak as the AI ("จัดให้!", "เดี๋ยวจะทำ..."); check the tone feels right.
- `srv.assume.refill` puts `{priority}` in brackets because the server may pass the English word (high, low).
- เวรกลางคืน next to Latin "Watchman" / "Night watchman": a fully Thai name (คนเฝ้ากะดึก) could replace the Latin if testers prefer.
