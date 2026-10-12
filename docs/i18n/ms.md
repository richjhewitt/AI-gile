# Malay (ms) - first pass

Source of rules: LocoRadio docs/i18n.md (no special Malay rule beyond the language list) and LocoRadio's ms.json for tone: plain, friendly standard Malay (Malaysia), "anda" for you, "kita"/"saya" only where English is first person. Spelling follows Dewan Bahasa (e.g. "pelayar", "pelayan", "tetingkap", "apl").

## Register
- "anda", never "kamu", as in LocoRadio's ms.json. Warm but not slangy.
- Developer words stay as loanwords, wrapped in `{{dev:...}}` where English has them: `{{dev:sprint}}`, `{{dev:bug}}`, `{{dev:Backlog}}`, `{{dev:commit}}`. Test is Malay inside the marker (`{{dev:uji}}` verb, `{{dev:ujian}}` noun); glossary aliases list both plus "test".
- Short forms: "{n} min lalu", "{n} j lalu", "{n} h lalu" (bare: m / j / h). "h" = hari, "j" = jam.
- Percent written without a space ("50%").

## Glossary
| English | Malay |
|---|---|
| card | kad |
| board | papan |
| project | projek |
| team | pasukan |
| lead | ketua |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Untuk anda |
| For the team | Untuk pasukan |
| To do | Untuk dibuat |
| In progress / Doing | Sedang dibuat |
| Team checking | Pasukan menyemak |
| Done | Selesai |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | peti masuk |
| Setup | Persediaan |
| Usage | Penggunaan |
| test steps | langkah ujian |
| test (verb / noun) | uji / ujian |
| bug | bug |
| Accept | Terima |
| Send back | Hantar balik |
| Wait and see | Tunggu dan lihat |
| poke | cuit |
| wake (a team) | bangunkan |
| assumption | andaian |
| night watch | jaga malam (watchman: penjaga malam) |
| going quiet | senyap |
| No Token Mode | Mod Tanpa Token |
| token | token |
| Verbose | Terperinci |
| Look (project colour/emoji) | Rupa |
| Permissions | Kebenaran |
| Views | Paparan |
| Docs | Dokumen |
| Agent | ejen |
| helper | pembantu |
| Pop out | Keluarkan |
| Space | Ruang |
| Life board | Papan kehidupan |

## For the reviewer
- "Wake / poke" metaphors (bangunkan, cuit) and the Scrum Master "diligence" levels (Hayun cemeti, Pastikan pinggan terus berputar) are fairly literal; check they feel natural.
- `board` = "papan" (Malaysian tech teams often say "board"; consider keeping the loanword).
- `dms.go` button and the typed word GO stay in English; "Terima" / "Hantar balik" for Accept / Send back.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` uses "Davy" and neutral wording where English says "his".
- Check the formal-leaning "anda" does not feel stiff in the playful strings (wizard, tour, night watch).
