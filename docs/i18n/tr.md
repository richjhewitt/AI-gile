# Turkish (tr) - first pass

Written by Babel for AIG-491, to be checked by a native-speaker reviewer. LocoRadio's docs/i18n.md has no Turkish-specific rules; its tr.json sets the tone (casual "sen", short, friendly). Dates use tr-TR.

## Register
- Casual "sen" (never "siz"), imperatives for buttons ("Kaydet", "Geri gönder").
- Apostrophe suffixes on names and loanwords follow Turkish orthography ("Stand-up'lar", "Bug'larım", "Kurulum'a"). Vowel harmony on English words follows pronunciation ("Backlog'a", "git'e").
- Developer words: the English term stays inside `{{dev:...}}` markers ("{{dev:test}} etmen", "{{dev:Sprint}}", "{{dev:bug}}", "{{dev:commit}}"). `gloss.*.word` keeps the English term; `gloss.*.also` lists English and Turkish search aliases.
- Plurals: one / other (Intl.PluralRules `tr`); both forms are the same text, because Turkish does not pluralise after a number.
- Percent is written before the number ("%50"), as in Turkish.
- Names inside a sentence are placed where the suffix does not need to attach to them ("{name} kişisine", "{name} kişisinin").

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
| In progress / Doing | Sürüyor |
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
| Accept | Kabul et |
| Send back | Geri gönder |
| Wait and see | Bekle, görelim |
| poke | dürtmek |
| wake (a team) | uyandırmak |
| assumption | varsayım |
| night watch / watchman | gece nöbeti / gece nöbetçisi |
| going quiet | sessize geçmek (button: 🌙 Sessize geç) |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | token |
| Verbose | Ayrıntılı (mod) |
| Look (project colour/emoji) | Görünüm |
| Permissions | İzinler |
| Views | Görünümler |
| Docs | Belgeler |
| Agent | ajan |
| helper | yardımcı |
| Pop out | Ayrı pencere |
| Stand-up report | Stand-up raporu |
| Life board | Hayat panosu |
| pretend friend | sahte arkadaş |

## For the reviewer
- "Dürtmek" (poke) and "uyandırmak" (wake) are literal; check they feel natural. "Sessize geçmek" for going quiet may want a better phrase.
- "Senin için" is used for both "For you" and general "for you"; "Görünüm" is used for both Look and Views ("Görünümler") which could clash.
- "Lead" is "lider"; "Lead Scrum Master" kept in English as in the source.
- "Ekip" (team) vs "takım": ekip chosen as more common in software.
- Some strings with names and suffixes (`{name} kişisine`) are stilted; reword if you know a smoother form.
- Left English on purpose: gloss words, prof.level.* and prof.role.* (junior, mid, Frontend, Backend...), Product/Sprint backlog, Review.
