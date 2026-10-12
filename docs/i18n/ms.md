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
| going quiet | berehat / rehat (was "senyap"; changed in review) |
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
| Life (card kind) | Kehidupan (not "Hidup", which reads as "on") |
| tour | jelajah (was "lawatan") |
| plug (an assumption) | betulkan |
| starter team / main team | pasukan permulaan / pasukan utama |
| level (role, plan) | tahap |
| brief (lead's) | taklimat |
| On / Off (switches) | Hidup / Mati |

## For the reviewer
- "Wake / poke" metaphors (bangunkan, cuit) and the Scrum Master "diligence" levels (Hayun cemeti, Pastikan pinggan terus berputar) are fairly literal; check they feel natural.
- `board` = "papan" (Malaysian tech teams often say "board"; consider keeping the loanword).
- `dms.go` button and the typed word GO stay in English; "Terima" / "Hantar balik" for Accept / Send back.
- `prof.*` role labels, `gloss.*.also` search aliases and `*.word` terms are partly kept in English on purpose (real usage).
- `pretend.*` uses "Davy" and neutral wording where English says "his".
- Check the formal-leaning "anda" does not feel stiff in the playful strings (wizard, tour, night watch).

## Answers to the translator's questions
- Wake / poke (bangunkan, cuit): natural enough and kept. The diligence levels were not: "Pastikan pinggan terus berputar" and "Hayun cemeti" are English idioms in Malay words. Now 🍽️ "Asalkan semua berjalan", "Santai sahaja", ⚖️ "Stabil", "Bersemangat", 🏇 "Desak habis-habisan".
- board: kept "papan". Malaysian devs say "board" out loud, but the UI reads more evenly with the Malay word, and it matches kad / lajur / pasukan.
- GO, Terima / Hantar balik: fine as they are.
- prof.*, gloss.*.also, *.word: fine; the aliases already list both Malay and English.
- "anda" in the playful strings: it suits standard Malaysian UI. Kept everywhere; the playful feel now comes from the wording ("Ayuh mulakan", "Asalkan semua berjalan").

## Review (native-speaker pass, AIG-490)
- Added the 102 strings that were missing (lang.fun, poke.held.*, the whole scale.* / tm.* / pe.* / mt.* team and agent-style dialogs).
- Plural keys are now `{"other": ...}` objects, as English has them (Malay has no plural form).
- Updated three strings English had changed since the first pass: wz.adv.roles.h, wz.adv.roles.sub, wz.adv.row.roles (now "starter team", not "roles for new projects").
- "Going quiet" is now berehat / rehat everywhere ("senyap" sounded like "mute").
- Tour is "jelajah", not "lawatan" (a lawatan is a physical visit).
- "Life" card kind: "Kehidupan" (bare "Hidup" read as "On").
- "Plug this assumption": "Betulkan" instead of the literal "Sumbat".
- Fixed typos "Nyahkarkib" / "menyahkarkibkannya" (now nyaharkib).
- Fixed the missing 👥 in board.team.
- Grammar: "Tidak dapat bangunkan" > "Tidak dapat membangunkan"; "perlukan sebab" > "memerlukan sebab"; "Ujikan" > "Uji"; "Henti" buttons > "Hentikan"; "Dikemas kini terakhir" > "Kemas kini terakhir".
- Colloquial or calqued lines rewritten: "Saya dah balik", "Lihat berapa banyak lagi yang anda ada", "Setakat mana ia mendesak", "berkos", "mendarat" (cards now "masuk"), "pergi kepada" (now "dihantar kepada"), "Tidak sekali-kali" (now "Dilarang"), "Kembali ke rupa…", "Pada 100% anda habis".
- Usage table headers In / Out are now Input / Output.
- Uncertain, worth a human look: "cuit" for poke in the night-watch lines; "longgokan" for "your pile"; "geganti" for the DM relay (devs may just say "relay"); "Untuk dibuat" vs "Perlu dibuat" for To do; "kerja rumah" (housework) can also read as homework; "ditetapkan semula" vs "diset semula" for reset.
