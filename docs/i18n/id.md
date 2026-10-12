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
| poke | colek |
| wake (a team) | bangunkan |
| assumption | asumsi |
| night watch | jaga malam (watchman: penjaga malam) |
| going quiet | diam / mode diam |
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

## For the reviewer
- "Wake / poke" metaphors (bangunkan, colek) and the Scrum Master "diligence" levels (Cambuk tim, Jaga piring tetap berputar) are fairly literal; check they feel natural.
- Many dev words stay English on purpose (board, lead, helper, sprint, bug, commit, hook, merge); check the balance against what Indonesian teams really say.
- "To do" as "Akan dikerjakan" is long for a column header; "Tugas" or "To do" may suit better.
- `dms.go` button and the typed word GO stay in English; "Terima" / "Kembalikan" for Accept / Send back.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` uses "Davy" and neutral wording where English says "his".
