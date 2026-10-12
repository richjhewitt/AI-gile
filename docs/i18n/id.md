# Indonesian (id) - first pass

Source of rules: LocoRadio docs/i18n.md (no special Indonesian rule beyond the language list) and LocoRadio's id.json for tone: casual, friendly Indonesian, "kamu" (written "-mu" on nouns), light particles like "ya" only occasionally. Spelling follows PUEBI/KBBI ("proyek", "aktif", "tes", "browser", "file").

## Register
- Casual "kamu" / "-mu", never "Anda", as in LocoRadio's id.json. "aku" for the AI's own voice in system messages.
- Developer words stay as loanwords, wrapped in `{{dev:...}}` where English has them: `{{dev:sprint}}`, `{{dev:bug}}`, `{{dev:Backlog}}`, `{{dev:commit}}`, `{{dev:tes}}`. The prefix "di-" is written outside the marker ("di{{dev:tes}}").
- Short forms: "{n} mnt lalu", "{n} j lalu", "{n} h lalu" (bare: m / j / h). "h" = hari, "j" = jam.
- Percent written without a space ("50%").

## Glossary
| English | Indonesian |
|---|---|
| card | kartu |
| board | board |
| project | proyek |
| team | tim |
| lead | lead |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Untukmu |
| For the team | Untuk tim |
| To do | Akan dikerjakan |
| In progress / Doing | Dikerjakan |
| Team checking | Tim memeriksa |
| Done | Selesai |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | kotak masuk |
| Setup | Pengaturan |
| Usage | Pemakaian |
| test steps | langkah tes |
| test (verb / noun) | tes |
| bug | bug |
| Accept | Terima |
| Send back | Kembalikan |
| Wait and see | Tunggu dulu |
| Not now | Nanti dulu (not "Jangan sekarang") |
| poke | colek |
| wake (a team) | bangunkan |
| assumption | asumsi |
| night watch | jaga malam (watchman: penjaga malam) |
| going quiet | rehat (was "diam"; changed in review) |
| No Token Mode | Mode Tanpa Token |
| token | token |
| Verbose | Rinci |
| Look (project colour/emoji) | Gaya |
| Permissions | Izin |
| Views | Tampilan |
| Docs | Dokumen |
| Agent | agen |
| helper | helper |
| Pop out | Pisahkan |
| Space | Ruang |
| Life board | Board kehidupan |
| Life (card kind) | Kehidupan (not "Hidup") |
| Compact (cards) | Padat |
| alerts | notifikasi |
| idle | idle |
| plug (an assumption) | koreksi |
| starter team / main team | tim awal / tim utama |
| level (role, plan) | tingkat |
| brief (lead's) | brief |
| On / Off (switches) | Aktif / Mati |

## For the reviewer
- "Wake / poke" metaphors (bangunkan, colek) and the Scrum Master "diligence" levels (Cambuk tim, Jaga piring tetap berputar) are fairly literal; check they feel natural.
- Many dev words stay English on purpose (board, lead, helper, sprint, bug, commit, hook, merge); check the balance against what Indonesian teams really say.
- "To do" as "Akan dikerjakan" is long for a column header; "Tugas" or "To do" may suit better.
- `dms.go` button and the typed word GO stay in English; "Terima" / "Kembalikan" for Accept / Send back.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` uses "Davy" and neutral wording where English says "his".

## Answers to the translator's questions
- Wake / poke (bangunkan, colek): natural and kept. The diligence levels were not: "Jaga piring tetap berputar" and "Cambuk tim" are literal. Now 🍽️ "Asal tetap jalan", "Santai saja", ⚖️ "Stabil", "Semangat", 🏇 "Gas pol".
- English dev words (board, lead, helper, sprint, bug, commit, hook, merge): this is how Indonesian dev teams talk; kept.
- "To do" as "Akan dikerjakan": kept. "Tugas" clashes with the task type, and "To do" in English would stand out among Indonesian column names. It fits the column header.
- GO, Terima / Kembalikan: fine.
- prof.*, gloss.*.also, *.word: fine.
- "kamu" register: right for this app, matches LocoRadio.

## Review (native-speaker pass, AIG-490)
- Added the 102 strings that were missing (lang.fun, poke.held.*, the whole scale.* / tm.* / pe.* / mt.* team and agent-style dialogs).
- Plural keys are now `{"other": ...}` objects, as English has them (Indonesian has no plural form).
- Updated three strings English had changed since the first pass: wz.adv.roles.h, wz.adv.roles.sub, wz.adv.row.roles (now "starter team").
- "Going quiet" is now "rehat" everywhere ("diam" sounded like "be silent").
- "Life" card kind: "Kehidupan" (bare "Hidup" read like "alive / on"); housework is "pekerjaan rumah tangga" ("pekerjaan rumah" means homework).
- srv.night.head: "Semalam" means yesterday in Indonesian; now "Tadi malam".
- "Not now" is "Nanti dulu" (polite), not "Jangan sekarang" (sounds like an order).
- Fixed the missing 👥 in board.team; "Perananmu" (a Malay form) is now "Peranmu".
- "Plug this assumption": "Koreksi" instead of the literal "Sumbat".
- Calques fixed: "Lead cerewet" (cerewet = nagging; now "suka ngobrol"), "menganggur" for idle, "Pembangunan tambahan" for extra wakes, "Dengan laju ini", "board melambat", "tercadangkan dan terbagi", "Menayangkan versi baru", "hapus" for clearing a filter (now "reset").
- Alerts are "notifikasi" (was "peringatan", which reads as a warning).
- Usage table headers In / Out are now Input / Output.
- Uncertain, worth a human look: "colek" for poke in the night-watch lines; "Gas pol" (casual) for the top Scrum Master level; "Royal" for the generous budget plan; "Intip malam" for Night glance; "Giliranmu tes" as the For-you-to-test column name.
