# Turkish (tr)

Written by Babel for AIG-491, then reviewed by a native-speaker pass (see Review). LocoRadio's docs/i18n.md has no Turkish-specific rules; its tr.json sets the tone (casual "sen", short, friendly). Dates use tr-TR.

## Register
- Casual "sen" (never "siz"), imperatives for buttons ("Kaydet", "Geri gönder").
- Apostrophe suffixes on names and loanwords follow Turkish orthography ("Stand-up'lar", "Bug'larım", "Kurulum'a"). Vowel harmony on English words follows pronunciation ("Backlog'a", "git'e").
- Never attach a suffix to a `{placeholder}` (no "{name}'sin", "%{pct}'de", "{when} beri"): the filled-in value decides the vowel harmony. Instead:
  - put the name after a colon or in brackets: "Gönder: {name}", "Gelen: {name}", "Gönderilmedi ({name})", "karşı tarafa ({name})";
  - or let a separate word carry the case: "{name} tarafından", "{name} adlı arkadaşın", "{name} projesinin", "{col} sütununa".
  - Do not use "{name} kişisine / kişisinden / kişisinin": it reads like an official form.
  - Times from `ago()` ("5 dk önce") take "başladı", "kontrol edildi"; bare durations ("5 dk") take "süredir" ("{when} süredir bekliyor"); clock times take "itibarıyla" or "saatinde".
- Developer words: the English term stays inside `{{dev:...}}` markers ("{{dev:test}} etmen", "{{dev:Sprint}}", "{{dev:bug}}", "{{dev:commit}}"). `gloss.*.word` keeps the English term; `gloss.*.also` lists English and Turkish search aliases.
- Plurals: one / other (Intl.PluralRules `tr`); both forms are the same text, because Turkish does not pluralise after a number.
- Percent is written before the number ("%50"), as in Turkish.

## Glossary
| English | Turkish |
|---|---|
| card | kart |
| board | pano |
| project | proje |
| team | ekip |
| lead | lider |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Senin için |
| For the team | Ekip için |
| To do | Yapılacak |
| In progress / Doing | Sürüyor (In flight: Devam eden) |
| Team checking | Ekip kontrol ediyor |
| Done | Bitti |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | gelen kutusu |
| Home | Ana sayfa |
| Setup | Kurulum |
| Usage | Kullanım |
| test (verb / noun) | test etmek / test |
| test steps | test adımları |
| bug | bug |
| hook | hook (hook'lar) |
| blocked | bloke (never "engelli", which means disabled) |
| stuck | takıldı |
| Accept | Kabul et |
| Send back | Geri gönder |
| Wait and see | Bekleyip görelim |
| Not sure yet | Henüz emin değil misin? |
| poke | dürtmek |
| wake (a team) | uyandırmak |
| assumption | varsayım |
| plug (an assumption) | düzelt |
| night watch / watchman | gece nöbeti / gece nöbetçisi |
| going quiet | mola vermek (buttons: 🌙 Mola veriyorum / 🌙 Mola ver) |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | token |
| Verbose | Ayrıntılı (mod) |
| Look (project colour/emoji) | Stil |
| Views | Görünümler |
| Permissions | İzinler |
| Docs | Belgeler |
| Agent | ajan |
| helper | yardımcı |
| build (verb) | geliştirmek |
| developer words | geliştirici terimleri |
| Compact / Roomy | Kompakt / Ferah |
| Pop out | Ayrı pencere |
| Stand-up report | Stand-up raporu |
| Life board | Hayat panosu |
| pretend friend | hayali arkadaş |
| primer (pack) | ön bilgi |
| the other side (a friend) | karşı taraf |

## Questions from the first pass, answered
- **"Dürtmek" / "uyandırmak":** natural and playful; kept. "Sessize geçmek" was not: going quiet is now "mola vermek".
- **"Senin için" for both "For you" and "for you":** fine, context makes it clear.
- **"Görünüm" for both Look and Views:** they clashed. Look is now "🎨 Stil"; Views stay "Görünümler".
- **"Lider" / Lead Scrum Master in English:** fine.
- **"Ekip" vs "takım":** ekip kept; it is the usual word in software teams.
- **"{name} kişisine" and similar:** reworded everywhere (see Register).
- **English left on purpose (gloss words, prof.level.*, prof.role.*, Product/Sprint backlog, Review):** fine; Turkish developers use these as is.

## Review
Native-speaker pass for AIG-491: every value read next to English; 297 values changed (294 edits, 3 new `boot.*` keys).
- Removed every "kişisine / kişisinden / kişisinin" construction and every suffix glued to a placeholder ("Sen {name}'sin", "%{pct}'de", "{when} beri", "son 30 günün %{pct}'i").
- "engelli" (means disabled person) replaced by "bloke" for blocked cards; "(engellendi)" for blocked friends.
- "Sahte arkadaş" (fake) → "hayali arkadaş" (pretend).
- "Sorun" (also means "problem") avoided for "your question": "Soru", "Bir soru yaz".
- Going quiet → "mola"; Look → "Stil"; "kancalar" → "hook'lar"; "kelime" → "terim" for developer words; "Sıkı" → "Kompakt"; "yapım" (build) → "geliştirme"; "tıka" (plug) → "düzelt".
- Smoothed stilted lines: "Tabaklar dönmeye devam etsin" → "Çark dönsün yeter", "Bekle, görelim" → "Bekleyip görelim", "Yine de {what} ve onu kaybet?" rewritten as a proper question, trial/pretend/help texts reworded.
- Fixed small slips: "panonden" typo, "Yalnızca yapılacaklarım" (my) → "senin yapacakların", "Başlıyor…" → "Başlatılıyor…" for things the board starts.

Still for a human native speaker to look at:
- "hayali arkadaş" for the pretend friend and "Çark dönsün yeter" / "Kamçıyı şaklat" for the push levels: playful choices worth a second opinion.
- The colon/bracket pattern for names ("Gönder: {name}", "Gelen: {name}") is safe but a little terse; a native speaker may find smoother wording for single cases.
- "ajan" for agent: some Turkish developers simply say "agent".
