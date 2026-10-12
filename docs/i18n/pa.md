# AI-gile in Punjabi (pa, Gurmukhi), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Friendly-polite **ਤੁਸੀਂ** with "-ੋ" imperatives ("ਕਲਿੱਕ ਕਰੋ", "ਚੁਣੋ"), as in LocoRadio's Punjabi. No ਤੂੰ. Short and conversational.
- **Gurmukhi** script (Indian Punjabi), not Shahmukhi. Software words are written in Gurmukhi, as Punjabi tech writing does: ਬੈਕਲੌਗ, ਸਪ੍ਰਿੰਟ, ਸਟੈਂਡ-ਅੱਪ, ਬੱਗ, ਟੈਸਟ, ਕਮਿਟ, ਬ੍ਰਾਂਚ, ਮਰਜ, ਰੀਪੋ, ਹੁੱਕ, ਟੋਕਨ, ਏਜੰਟ. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Gurmukhi form ("{{dev:ਟੈਸਟ}}", "{{dev:ਬੱਗ}}", "{{dev:ਸਪ੍ਰਿੰਟ}}", "{{dev:ਬੈਕਲੌਗ}}", "{{dev:ਕਮਿਟ}}"). The `gloss.*.also` keys list the Gurmukhi plural/alt spelling plus the Latin one.
- Digits are Latin (0-9) everywhere, matching the numbers the app fills in.
- Plurals: `{ one, other }`; Intl.PluralRules gives `one` for 0 and 1. Nouns like ਕਾਰਡ, ਟੀਮ and ਸੁਨੇਹਾ differ by number only in a few keys (ਸੁਨੇਹਾ/ਸੁਨੇਹੇ, ਟੀਮ/ਟੀਮਾਂ, ਪੁਰਾਣਾ/ਪੁਰਾਣੇ); the rest are identical in both forms.
- Dates/times follow pa-IN via Intl. Short relative times: "ਮਿੰ." (ਮਿੰਟ), "ਘੰ." (ਘੰਟੇ), "ਦਿ." (ਦਿਨ).

## Glossary
| English | Punjabi | Note |
|---|---|---|
| card | ਕਾਰਡ | |
| board | ਬੋਰਡ | |
| project | ਪ੍ਰੋਜੈਕਟ | |
| team | ਟੀਮ | |
| lead / team lead | ਲੀਡ | "ਲੀਡ ਸਕ੍ਰਮ ਮਾਸਟਰ" |
| For you | ਤੁਹਾਡੇ ਲਈ | |
| To do | ਕਰਨਾ ਹੈ | |
| In progress / Doing | ਚੱਲ ਰਿਹਾ ਹੈ | |
| Team checking | ਟੀਮ ਜਾਂਚ ਰਹੀ ਹੈ | |
| For the team | ਟੀਮ ਲਈ | |
| For you to test | ਤੁਹਾਡੇ ਟੈਸਟ ਕਰਨ ਲਈ | |
| Done | ਹੋ ਗਿਆ | |
| Backlog | ਬੈਕਲੌਗ | |
| sprint | ਸਪ੍ਰਿੰਟ | |
| stand-up | ਸਟੈਂਡ-ਅੱਪ | |
| inbox | ਇਨਬਾਕਸ | |
| Setup | ਸੈੱਟਅੱਪ | |
| Usage | ਵਰਤੋਂ | |
| test | ਟੈਸਟ | |
| test steps | ਟੈਸਟ ਦੇ ਕਦਮ | |
| Accept | ਮਨਜ਼ੂਰ ਕਰੋ | |
| Send back | ਵਾਪਸ ਭੇਜੋ | |
| Wake (team) | ਜਗਾਓ | |
| Poke / nudge | ਹਲੂਣਾ | "ਹਲੂਣਾ ਦੇਣਾ"; button "👉 ਹਲੂਣਾ" (was ਟੋਕੋ, which reads as scolding) |
| Going quiet (state) | ਕੁਝ ਦੇਰ ਲਈ ਚੁੱਪ / ਚੁੱਪ ਮੋਡ | was "ਚੁੱਪ ਹੋ ਰਿਹਾ ਹਾਂ" (masculine) |
| Go quiet (button) | ਆਰਾਮ ਕਰੋ | "ਚੁੱਪ ਹੋ ਜਾਓ" = "be quiet!" |
| I'm back | ਮੈਂ ਵਾਪਸ ਹਾਂ | gender-neutral |
| Got it | ਸਮਝ ਆ ਗਿਆ | gender-neutral (not ਸਮਝ ਗਿਆ) |
| key (card prefix, AIG) | ਕੋਡ | other keys stay ਕੁੰਜੀ |
| Chatty (lead) | ਗਾਲੜੀ | was ਗੱਲਾਂ ਵਾਲਾ |
| Steady (push level 3) | ਇੱਕਸਾਰ | was ਸਥਿਰ |
| Done (tour, wizard) | ਹੋ ਗਿਆ | was ਮੁਕਾਇਆ |
| quoting a UI label in running text | '…' | e.g. 'ਕਰਨਾ ਹੈ' ਵਿੱਚ, 'ਤੁਹਾਡੇ ਲਈ' ਵਿੱਚ |
| night watch | ਨਾਈਟ ਵਾਚ | watchman = "ਚੌਕੀਦਾਰ" |
| assumption | ਅੰਦਾਜ਼ਾ | |
| No Token Mode | ਨੋ ਟੋਕਨ ਮੋਡ | |
| token | ਟੋਕਨ | |
| agent | ਏਜੰਟ | |
| blocked | ਅਟਕਿਆ ਹੈ | |
| blockers | ਰੁਕਾਵਟਾਂ | |
| Permissions | ਇਜਾਜ਼ਤਾਂ | |
| Views | ਵਿਊ | |
| DM | DM | kept in Latin |
| Look (🎨) | ਲੁੱਕ | |
| Space | ਸਪੇਸ | |
| Checklist | ਚੈੱਕਲਿਸਟ | |
| Hook | ਹੁੱਕ | |

## For the reviewer
- Gender of the Lead/AI voice (`pt.*`, `srv.*`): masculine first person ("ਮੈਂ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕਦਾ", "ਲੱਗਿਆ ਹੋਇਆ ਹਾਂ", "ਮੈਂ ਹੌਲੀ ਹੋ ਰਿਹਾ ਹਾਂ"); change if a neutral form is preferred. The team/lead as third person feminine ("ਟੀਮ ਜਾਂਚ ਰਹੀ ਹੈ", "ਟੀਮ ਸੁੱਤੀ ਹੈ").
- "ਟੋਕੋ/ਟੋਕਣਾ" for poke: check it does not read as scolding (alternative: "ਯਾਦ ਕਰਾਓ").
- `leave.confirm` ("ਫਿਰ ਵੀ {what} ਕਰ ਕੇ ਉਹ ਗੁਆ ਦੇਣਾ ਹੈ?") takes ਅੱਪਡੇਟ/ਰਿਫ੍ਰੈਸ਼/ਰੀਸਟਾਰਟ as `{what}`: verify it parses.
- `unit`-like counted forms ("{n} ਟੀਮ(ਾਂ)" in `quiet.sent`) mirror English's "team(s)"; a native may prefer another phrasing.
- Spelling of loanwords (ਮਰਜ, ਹੁੱਕ, ਬੱਗ, ਕਮਿਟ, ਡਿਪਲੌਏ, ਕਾਨਬਾਨ) follows common Gurmukhi tech usage but is not standardised.
- Pirate-style jokes in `sm.push.*` ("ਪਲੇਟਾਂ ਘੁੰਮਦੀਆਂ ਰਹਿਣ", "ਚਾਬਕ ਚਲਾਓ") are idiomatic renderings; confirm tone.
- Long labels to check for fit: "✅ AI-ਪਾਸ ਸਾਰੇ ਮਨਜ਼ੂਰ ਕਰੋ ({n})", "🧭 ਮੇਰੀ ਟੀਮ ਵਿੱਚ ਲੀਡ ਸਕ੍ਰਮ ਮਾਸਟਰ".

### Answers (native review)
- Lead/AI voice: now gender-neutral where it spoke in the first person. Masculine forms (ਮੈਂ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕਦਾ, ਲੱਗਿਆ ਹੋਇਆ ਹਾਂ, ਮੈਂ ਹੌਲੀ ਹੋ ਰਿਹਾ ਹਾਂ, ਜਾਰੀ ਰੱਖਾਂਗਾ, ਮੈਂ ਨਹੀਂ ਸਮਝ ਸਕਿਆ, ਮੈਂ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹਾਂ) became impersonal or noun phrases (ਸ਼ੁਰੂਆਤ ਨਹੀਂ ਹੋ ਸਕਦੀ, ਕੰਮ ਸ਼ੁਰੂ!, ਰਫ਼ਤਾਰ ਘਟਾਈ ਜਾ ਰਹੀ ਹੈ, ਕੰਮ ਜਾਰੀ ਰਹੇਗਾ, ਸਮਝ ਨਹੀਂ ਆਇਆ, ਮੇਰਾ ਕੰਮ ਕਰਨ ਦਾ ਢੰਗ). Ergative past forms (ਮੈਂ ... ਰੋਕ ਦਿੱਤਾ) agree with the object, so they are already neutral and stay.
- The reader: the user's own first-person buttons were masculine (ਮੈਂ ਵਾਪਸ ਆ ਗਿਆ, ਚੁੱਪ ਹੋ ਰਿਹਾ ਹਾਂ, ਸਮਝ ਗਿਆ, ਮੈਂ ਪੜ੍ਹ ਲਵਾਂਗਾ, ਮੈਂ ਆਪੇ ਸਮਝ ਲਵਾਂਗਾ, ਮੈਂ ਹਰ ਟੈਸਟ ਦੇਖਦਾ ਹਾਂ, ਜਿਵੇਂ ਮੈਂ ਨਵਾਂ ਹਾਂ); all rephrased neutrally. Sentences about the reader that needed ਤੁਸੀਂ + masculine future/progressive (ਰਹੋਗੇ, ਹੋ ਰਹੇ ਹੋ, ਜਾਂਦੇ ਹੋ, ਚਾਹੁੰਦੇ ਹੋ) were rephrased where it read naturally ("ਤੁਹਾਡੀ ਚੁੱਪ ਦੌਰਾਨ", "ਕਿੰਨਾ AI ਵਰਤਿਆ ਜਾ ਸਕਦਾ ਹੈ?"). The plain honorific "ਤੁਸੀਂ ... ਸਕਦੇ ਹੋ" stays: it is the standard polite form for everyone.
- Friends ({name}) are now honorific plural (ਕਹਿੰਦੇ ਹਨ, ਚਾਹੁੰਦੇ ਹਨ, ਦੇਖਦੇ ਹਨ) instead of masculine singular, matching English "they". Davy, the pretend friend, stays masculine (English says "his").
- ਟੋਕੋ/ਟੋਕਣਾ: yes, it reads as scolding. Now ਹਲੂਣਾ ("ਹਲੂਣਾ ਦੇਣਾ"), a gentle shake to wake someone, everywhere.
- `leave.confirm`: parses with ਅੱਪਡੇਟ/ਰਿਫ੍ਰੈਸ਼/ਰੀਸਟਾਰਟ. Kept.
- `quiet.sent`: "{n} ਟੀਮ(ਾਂ)" removed; now "📣 ਟੀਮਾਂ ਨੂੰ ਭੇਜਿਆ ({n}){names}".
- Loanword spellings (ਮਰਜ, ਹੁੱਕ, ਬੱਗ, ਕਮਿਟ, ਡਿਪਲੌਏ, ਕਾਨਬਾਨ): fine.
- `sm.push.*`: kept the plates and the whip; ਸਥਿਰ became ਇੱਕਸਾਰ.
- Long labels: the AI-pass one is now "✅ AI-ਪਾਸ ਵਾਲੇ ਸਾਰੇ ਮਨਜ਼ੂਰ ({n})".

## Review
Native-speaker pass, AIG-492. 223 values changed and 3 missing keys added (`boot.retry`, `boot.broke`, `boot.reload`).
- Gender: first-person AI and user strings made neutral (see Answers); friends in honorific plural.
- Poke: ਹਲੂਣਾ throughout (poke.*, card.poke, home.poke, sm.push.title, scale.push.help, look.chatty, quiz.chatty.chatty, wz.style.balanced.help, scale.chat.4).
- "Go quiet" was "ਚੁੱਪ ਹੋ ਜਾਓ" (be quiet!); now ਆਰਾਮ ਕਰੋ. `quiet.done.ok` ਸ਼ੁਭ ਰਾਤਰੀ (Hindi-ish) became ਸ਼ੁਭ ਰਾਤ.
- Ungrammatical "X ਕੰਮ ਨਹੀਂ ਕੀਤੀ" fixed (`ask.failed`, `pack.ai.fail`, `term.install.failed`).
- Card prefix key is ਕੋਡ (was ਕੁੰਜੀ); `join.help` ਚਾਬੀ became ਕੁੰਜੀ to match `join.key`.
- `sm.night.title` now names the real Setup switch; `verdict.steps` had two leading spaces, now one.
- Quoted UI labels in running text ('ਕਰਨਾ ਹੈ', 'ਤੁਹਾਡੇ ਲਈ', 'ਹੋ ਗਿਆ', 'ਦੋਸਤ ਜੋੜੋ', 'ਹੋਰ'...).
- Calques smoothed: help.offer.h (ਪੈਰ ਜਮਾਉਣ ਲਈ ਹੱਥ), eye.running, runin.help, scale.sub, edge cases, timed-card picker (ਕਦੋਂ ਵਾਪਸ ਆਵੇ…), priority high (ਉੱਚ), card.earlier, inbox.k.earlier (ਪਿਛਲੇ ਕਦਮ).

Still worth a human look:
- ਗਾਲੜੀ for "chatty": lively and common, but some may find it a little teasing.
- ਆਰਾਮ ਕਰੋ for "Go quiet" and ਕੁਝ ਦੇਰ ਲਈ ਚੁੱਪ for "Going quiet".
- Plain honorific "ਤੁਸੀਂ ... ਸਕਦੇ ਹੋ/ਕਰਦੇ ਹੋ" kept in many help texts; a reviewer who wants strictly neutral text could recast the rest impersonally.
