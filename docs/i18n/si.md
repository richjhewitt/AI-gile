# AI-gile in Sinhala (si)

First pass written by Babel for AIG-495; a native-speaker review is still to come.

## Register
- Casual, friendly written Sinhala, matching LocoRadio's si.json: spoken-leaning verb endings (-නවා, -න්න, "තියෙනවා", "බැහැ") rather than stiff literary forms (-යි/-ති). Buttons are short imperatives (සුරකින්න, අවලංගු කරන්න).
- "You" is ඔබ (neutral, polite). The reader, agents and friends are never gendered: Sinhala verbs do not mark gender, and "ඔහු/ඇය" slash forms are avoided (the stand-up gloss says "වැඩේ නවත්වන දේ" instead).
- Sinhala script throughout. English dev loanwords the way Sri Lankan software teams say them: written in Latin inside `{{dev:...}}` markers and in glossary words (Backlog, Sprint, Commit, Push, Branch, Merge, Repo, Refactor, Deploy, Kanban, WIP, Pull request, Hook, Token, Agent), while running text uses the Sinhala transliteration (ස්ප්‍රින්ට්, ස්ටෑන්ඩ්-අප්, ඒජන්ට්, ටෝකන්, බග්).
- Latin digits. Durations: විනාඩි (minutes), පැය (hours), දින (days). Dates follow Intl for si.
- Plurals: Sinhala has `one` and `other`. Plural objects give both, with the same wording because the noun carries "ක්" (e.g. කාඩ් {count}ක්).
- `gloss.*.also` lists carry both the English plural and the Sinhala transliteration so hovers match either.

## Glossary
| English | Sinhala | Note |
|---|---|---|
| card | කාඩ් / කාඩ්පත | කාඩ් in running text, classifier -ක් |
| board | බෝඩ් | |
| project | ව්‍යාපෘති | |
| team | කණ්ඩායම | |
| lead | ලීඩ් | loanword, as developers say it |
| Lead Scrum Master | Lead Scrum Master | kept |
| For you | ඔබට | |
| To do | කළ යුතු | |
| Doing / In progress | කරමින් | |
| Team checking | කණ්ඩායම පරීක්ෂා කරමින් | |
| For you to test (Verify) | ඔබට {{dev:test}} කිරීමට | |
| For the team | කණ්ඩායමට | |
| Done | අවසන් | |
| Backlog | Backlog | kept in Latin |
| sprint | ස්ප්‍රින්ට් | Latin inside dev markers |
| stand-up | ස්ටෑන්ඩ්-අප් | |
| inbox | ඉන්බොක්ස් | |
| Setup | සැකසුම් | |
| Usage | භාවිතය | |
| test / test steps | පරීක්ෂා / පරීක්ෂණ පියවර | |
| Accept / Send back | පිළිගන්න / ආපහු යවන්න | |
| Wake (team) | අවදි කරන්න | |
| Poke | තල්ලු කරන්න | "nudge"; poke itself has no good Sinhala word |
| night watch | රාත්‍රී මුරය | "watchman" = රාත්‍රී මුරකරු |
| Going quiet | නිහඬ වෙනවා | |
| assumption | උපකල්පන | |
| Plug this | නිවැරදි කරන්න | patch / correct the guess |
| No Token Mode | No Token Mode | kept in Latin (it is a named mode) |
| token | ටෝකන් | |
| agent | ඒජන්ට් | |
| role | භූමිකාව | |
| helper | උදව්කරු | |
| brief | brief | kept in Latin |
| Look (🎨) | Look | kept as the tab name |
| Permissions | අවසර | |
| Views | දර්ශන | |
| Pop out | වෙන් කරන්න | |
| Roomy / Compact | ඉඩකඩ සහිත / සංක්ෂිප්ත | |
| Space | අවකාශය | |
| Life board | ජීවිත බෝඩ් | |
| Focus | අවධානය | |
| friend | මිතුරා | |

## For the reviewer
- Poke is rendered as "තල්ලු කරන්න / තල්ලුවක්" (a nudge). Check it reads naturally for "needs a poke".
- Mixed Latin and Sinhala for dev terms is deliberate; tell me if the team prefers all-Sinhala or all-Latin.
- Some quite formal words (ව්‍යාපෘති, සංක්ෂිප්ත, භූමිකා) were used for clarity; replace with more spoken ones if they feel stiff.
- Long help texts (`scale.*`, `usage.*`, `perm.*`) may wrap; check at narrow widths.
- The pretend-AI replies (`pt.*`) and server messages (`srv.*`) speak as "I" (මම); check tone.
- Button strings with "ක්ලික්/ඔබන්න/තට්ටු කරන්න" were mixed by context (mouse vs phone); review.
