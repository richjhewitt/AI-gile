# AI-gile in Burmese (my)

First pass written by Babel for AIG-495; a native-speaker review is still to come.

## Register
- Casual, friendly spoken-style Burmese, matching LocoRadio's my.json: sentence endings -တယ် / -မယ် / -ပါ rather than -သည် / -မည်. Buttons use the -ရန် noun form or a short verb ("သိမ်းရန်", "ပိတ်ရန်"), "ပါ" for polite instructions.
- **Unicode Burmese, not Zawgyi.**
- "You" is သင် (neutral). The reader, the agents and friends are never gendered: no ကျွန်တော်/ကျွန်မ. Where the app speaks as "I" the pronoun is dropped, or the neutral formal ကျွန်ုပ် is used in wizard choices written from the user's side. သူ (third person) is neutral.
- Burmese digits (၀၁၂၃...) in written numbers (၅ နာရီ, ၇ ရက်); digits inside placeholders and code stay Latin. Durations: မိနစ် (min), နာရီ (hours), ရက် (days).
- Burmese has no plural inflection. Plural objects give only `other` (as Intl.PluralRules gives for my). Counts take a classifier: ခု (things), ဖွဲ့ (teams), ဦး (people), ကြိမ် (times), ကြောင်း (lines).
- Dev loanwords: Latin inside `{{dev:...}}` markers and glossary words, transliterated in running text (စပရင့်, စတန်းအပ်, ဘတ်ဂ် (bug), ဘတ်ဂျက် (budget), တိုကင်, အေးဂျင့်). `gloss.*.also` carries both Latin and Burmese forms.

## Glossary
| English | Burmese | Note |
|---|---|---|
| card | ကတ် | classifier ခု |
| board | ဘုတ် | |
| project | ပရောဂျက် | |
| team | အဖွဲ့ | classifier ဖွဲ့ |
| lead | ခေါင်းဆောင် | |
| Lead Scrum Master | Lead Scrum Master | kept |
| For you | သင့်အတွက် | |
| To do | လုပ်ရန် | |
| Doing / In progress | လုပ်နေဆဲ | |
| Team checking | အဖွဲ့ စစ်နေဆဲ | |
| For you to test (Verify) | သင်က {{dev:test}} လုပ်ရန် | |
| For the team | အဖွဲ့အတွက် | |
| Done | ပြီးပြီ | |
| Backlog | Backlog | kept in Latin |
| sprint | စပရင့် | Latin inside dev markers |
| stand-up | စတန်းအပ် | |
| inbox | ဝင်စာ | |
| Setup | ဆက်တင် | |
| Usage | အသုံးပြုမှု | |
| test / test steps | စမ်းသပ် / စမ်းသပ်အဆင့်များ | |
| Accept / Send back | လက်ခံရန် / ပြန်ပို့ရန် | |
| Wake (team) | နှိုးရန် | |
| Poke | တို့ရန် | "tap/nudge" |
| night watch | ညစောင့် | |
| Going quiet | တိတ်ဆိတ်တော့မယ် | |
| assumption | ခန့်မှန်းချက် | |
| Plug this | ဒါကို ပြင်ပါ | patch / correct the guess |
| No Token Mode | No Token Mode | kept in Latin (named mode) |
| token | တိုကင် | |
| agent | အေးဂျင့် | |
| role | ရိုးလ် | loanword |
| helper | ကူညီသူ | |
| brief | brief | kept in Latin |
| Look (🎨) | Look | kept as the tab name |
| Permissions | ခွင့်ပြုချက်များ | |
| Views | မြင်ကွင်းများ | |
| Pop out | သီးခြားထုတ်ရန် | |
| Roomy / Compact | ကျယ်ဝန်း / ကျစ်လစ် | |
| Space | Space | kept |
| Life board | ဘဝဘုတ် | |
| Focus | အာရုံစူးစိုက်မှု | |
| friend | သူငယ်ချင်း | |

## For the reviewer
- Check every term above, especially ကတ်, ဘုတ်, ရိုးလ်, "တို့ရန်" for poke, and "ဝင်စာ" for inbox (or the loanword အင်းဘောက်စ်).
- Burmese runs words together without spaces: glossary hover matching on short words (ကတ်, စမ်းသပ်) may fire inside longer words; check in the UI with dev-word hints on.
- Mixed Latin (Backlog, Sprint-like, Look, Edit) with Burmese is deliberate; confirm the team's preference.
- Zawgyi must not appear; all text is Unicode (Myanmar block).
- Long help texts (`scale.*`, `usage.*`, `perm.*`) are long in Burmese and may wrap badly on narrow widths.
- The pretend-AI replies (`pt.*`) and server messages (`srv.*`) drop the "I" pronoun; check they still read naturally.
- Wizard choices written from the user's side use ကျွန်ုပ် (neutral, a bit formal); replace if a more casual neutral form exists.
