# AI-gile in Thai (th), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Friendly, neutral-polite Thai, matching LocoRadio's Thai: no ครับ/ค่ะ particles, no heavy pronouns. "คุณ" for "you", dropped where Thai reads better without it.
- Questions end in ไหม ("Archive it?" = "...ไหม"); imperatives are plain verbs ("คลิก", "พิมพ์", "เลือก").
- Thai script, no spaces between words; "ๆ" written as " ๆ" with a space before it ("สบาย ๆ") for readability.
- Latin digits. Durations: นาที, ชม., วัน. Dates follow th-TH (Intl); the board may show Buddhist-era years.
- Plurals: Thai has none, so one form everywhere.
- `{{dev:...}}` markers kept around the dev word in Thai transliteration (e.g. `{{dev:สปรินต์}}`, `{{dev:บั๊ก}}`, `{{dev:ทดสอบ}}`, `{{dev:Backlog}}`). The `gloss.*.also` lists carry both the Thai spelling and the English word so hovers can match either.

## Glossary
| English | Thai | Note |
|---|---|---|
| card | การ์ด | |
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
| Backlog | Backlog | kept in Latin |
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
| assumption | ข้อสมมุติ | |
| No Token Mode | โหมดไม่ใช้โทเคน | |
| token | โทเคน | |
| agent | เอเจนต์ | |
| Look (🎨) | ลุค | |
| Permissions | สิทธิ์ | |
| Views | มุมมอง | |
| DM | DM | |
| Pop out | แยกหน้าต่าง | |
| Group (cards) | กลุ่ม | |
| Space | สเปซ | |
| Life board | บอร์ดชีวิต | |
| Focus | โฟกัส | |
| Checklist | เช็กลิสต์ | |
| Hook | hook / ฮุก (glossary) | kept Latin in UI |
| Stuck | ติดอยู่ / ติดขัด | "Blocked" is ติดขัด too |

## For the reviewer
- "Blocked" and "stuck" both land on ติดขัด / ติดอยู่; check they still read as distinct states.
- "Plug this" (assumptions) is translated as "ขอแก้อันนี้" (ask to change it); the English is idiomatic and unclear.
- The jokes in the Scrum Master diligence labels ("Keep the plates spinning", "Crack the whip") are loose: check tone.
- Glossary hover matching: Thai has no word spaces, so the transliteration may match inside longer words. Check `gloss.*.also` behaviour in the UI.
- 5h / 7d windows read "5 ชม." and "7 วัน"; confirm that is what Thai users expect.
- Mixed Latin terms (Backlog, Review, Frontend, Backend, DevOps, Kanban in the template names) were left as software teams say them.
