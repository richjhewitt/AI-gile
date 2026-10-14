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
| Poke / nudge | তাগাদা | "তাগাদা দেওয়া"; button "👉 তাগাদা" (was ঠেলা, too physical/rough) |
| Going quiet / Go quiet | চুপ থাকছি / বিরতি নিন | "চুপ থাকুন" read as "shut up", so the button is বিরতি নিন; the state is চুপ মোড |
| key (API, join, settings key file) | চাবি | "কী" means "what", so it is never used for key |
| key (card prefix, AIG) | কোড | |
| Verbose | বিস্তারিত মোড | was ভারবোজ |
| Chatty (lead) | আড্ডাবাজ | was গল্পবাজ |
| Undo | আগের মতো করুন | was পূর্বাবস্থায় |
| Back (wizard, tour) | আগের | was পিছনে |
| Step/Slide {i} of {n} | ধাপ {i} / {n} | |
| quoting a UI label in running text | ‘…’ | e.g. ‘করতে হবে’-তে, ‘বুঝেছি’ |
| night watch | নাইট ওয়াচ | watchman = "ওয়াচম্যান" |
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

### Answers (native review)
- আটকে আছে for both blocked and stuck: fine. It reads naturally in the home pills ("{n}টি আটকে আছে") and in the night-watch lines.
- ঠেলা for poke: too rough (it is a physical shove). Changed everywhere to তাগাদা ("তাগাদা দেওয়া"), the normal word for a friendly reminder to get on with something. The lead's "light nudge" (খোঁচা, a jab) became তাগাদা too.
- `leave.confirm`: parses with আপডেট/রিফ্রেশ/রিস্টার্ট ("তবুও আপডেট করে সেটা হারাবেন?"). Kept.
- Lead/AI voice: Bengali verbs have no gender, nothing to change.
- ভারবোজ is not a word people use; now বিস্তারিত মোড. লুক, ভিউ, স্পেস are fine as loanwords.
- `sm.push.*`: প্লেট ঘুরতে থাকুক is fine. চাবুক চালাও used তুমি, out of register; now চাবুক হাতে. স্থির (motionless) became সমান তালে.
- Long labels: both fit; kept.
- `.also` values: Bengali plurals are -গুলো, not -s, so বাগস/টেস্টস are unlikely in running text. Harmless, so kept.

## Review
Native-speaker pass, AIG-492. 191 values changed and 3 missing keys added (`boot.retry`, `boot.broke`, `boot.reload`).
- Poke is now তাগাদা throughout (poke.*, card.poke, home.poke, sm.push.title, scale.push.help, look.chatty, quiz.chatty, wz.style.balanced.help, scale.chat.4).
- "কী" was used for key (card prefix, Giphy/API key, join key, key file, keyboard keys). It means "what". Card prefix is now কোড; other keys are চাবি; the keyboard hint lines start with কিবোর্ড:.
- Fixed `pt.first.sfx` / `pt.polish.sfx`, which used the visarga ঃ instead of a colon. Appended fragments (`srv.night.stuck`, `srv.sm.sorted*`) used ";" where English has ","; now ",".
- `verdict.steps` had two leading spaces; now one, as in English.
- Quoted UI labels used in running text (‘করতে হবে’, ‘আপনার জন্য’, ‘হয়ে গেছে’, ‘বুঝেছি’, ‘যাচাই করুন’, ‘বন্ধু যোগ করুন’...) so sentences like "করতে হবে-তে না যাওয়া পর্যন্ত" parse.
- `sm.night.title` now names the real Setup switch (‘ওয়াচম্যান প্রতিটি প্রজেক্টে টিক দেয়’); it named a different text before.
- "Go quiet" button: চুপ থাকুন sounded like "shut up"; now বিরতি নিন.
- Smoother wording: stand-up tooltips (কী হলো / এরপর কী / কী বাধা), card.looksright, tour intro, usage chart texts, dispatch help, pace, the ‘Advanced’ wizard texts, the timed-card picker (কখন ফিরবে…), pop-out buttons (আলাদা উইন্ডো), Undo (আগের মতো করুন), step counters (ধাপ {i} / {n}).

Still worth a human look:
- চাবি for software keys (API key, invite key). Some Bangla tech writers keep "key" in Latin; চাবি is clear but may feel homely.
- সমান তালে for "Steady" and চাবুক হাতে for "Crack the whip" in the Scrum Master push slider.
- আড্ডাবাজ for "chatty lead": friendly, but check it doesn't read as "idle gossip".
