# AI-gile in Bengali (bn), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Polite-casual **আপনি** with "-ন/-ুন" imperatives ("ক্লিক করুন", "বাছুন"), as in LocoRadio's Bengali. No তুই/তুমি. Friendly, short, conversational.
- Bengali script. Software words are written in Bengali script, as Bangla tech writing does: ব্যাকলগ, স্প্রিন্ট, স্ট্যান্ড-আপ, বাগ, টেস্ট, কমিট, ব্রাঞ্চ, মার্জ, রেপো, হুক, টোকেন, এজেন্ট. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Bengali form ("{{dev:টেস্ট}}", "{{dev:বাগ}}", "{{dev:স্প্রিন্ট}}", "{{dev:ব্যাকলগ}}", "{{dev:কমিট}}"). The `gloss.*.also` keys list the Bengali plural/alt spelling plus the Latin one.
- Digits are Latin (0-9) everywhere, matching the numbers the app fills in. Counts take the classifier "-টি" ("{n}টি কার্ড").
- Plurals: `{ one, other }`; Bengali has no grammatical plural on counted nouns, so both forms carry the same text (Intl.PluralRules gives one/other, 0 and 1 are `one`).
- Dates/times follow bn-BD / bn-IN via Intl. Short relative times: "মি." (মিনিট), "ঘ." (ঘণ্টা), "দি." (দিন).

## Glossary
| English | Bengali | Note |
|---|---|---|
| card | কার্ড | |
| board | বোর্ড | |
| project | প্রজেক্ট | |
| team | টিম | |
| lead / team lead | লিড | "লিড স্ক্রাম মাস্টার" |
| For you | আপনার জন্য | |
| To do | করতে হবে | |
| In progress / Doing | চলছে | |
| Team checking | টিম যাচাই করছে | |
| For the team | টিমের জন্য | |
| For you to test | আপনার টেস্ট করার জন্য | |
| Done | হয়ে গেছে | |
| Backlog | ব্যাকলগ | |
| sprint | স্প্রিন্ট | |
| stand-up | স্ট্যান্ড-আপ | |
| inbox | ইনবক্স | |
| Setup | সেটআপ | |
| Usage | ব্যবহার | |
| test | টেস্ট | |
| test steps | টেস্টের ধাপ | |
| Accept | মঞ্জুর | |
| Send back | ফেরত পাঠান | |
| Wake (team) | জাগান | |
| Poke | ঠেলা | "ঠেলা দেওয়া" |
| night watch | নাইট ওয়াচ | watchman = "ওয়াচম্যান" |
| Going quiet | চুপ থাকছি | |
| assumption | অনুমান | |
| No Token Mode | নো টোকেন মোড | |
| token | টোকেন | |
| agent | এজেন্ট | |
| blocked | আটকে আছে | |
| blockers | বাধা | |
| Permissions | অনুমতি | |
| Views | ভিউ | |
| DM | DM | kept in Latin |
| Look (🎨) | লুক | |
| Space | স্পেস | |
| Checklist | চেকলিস্ট | |
| Hook | হুক | |

## For the reviewer
- "আটকে আছে" is used both for "blocked" and "stuck"; check it reads right in the home pills and night-watch lines.
- "ঠেলা" for poke: check it is not too rough for the friendly tone (alternative: "মনে করান").
- `leave.confirm` ("তবুও {what} করে সেটা হারাবেন?") takes আপডেট/রিফ্রেশ/রিস্টার্ট as `{what}`: verify it parses.
- Gendered or formal forms: the Lead/AI voice (`pt.*`, `srv.*`) uses neutral first person ("আমি ... পারছি না"); Bengali verbs are not gendered, so this should be fine.
- "ভারবোজ" for Verbose, and the many Bengali-script loanwords (লুক, ভিউ, স্পেস): confirm they match real usage.
- Pirate-style jokes in `sm.push.*` ("প্লেট ঘুরতে থাকুক", "চাবুক চালাও") are idiomatic renderings; confirm tone.
- Long labels to check for fit: "✅ এআই-পাস করা সব মঞ্জুর করুন ({n})", "🧭 আমার টিমে লিড স্ক্রাম মাস্টার".
- Abbreviated gloss `.also` values (e.g. "বাগস,bug,bugs") are guesses at what shows up in running text.
