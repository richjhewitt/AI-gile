# Hand a card to another AI: the AIGILE pack (AIG-357)

Give one card to an outside chat AI (ChatGPT, Gemini, Claude.ai...) as a short text block, and paste its answer back.
Short key lines keep it cheap in tokens and easy to check. Code: `lib/pack.js`, page `public/js/pack.js`, QA area `pack`.

## The pack (out)
```
AIGILE/1 PACK <proj> <ID>
T: <title>
WANT: <what to produce>
CTX:
- <bullets: the description, test steps, the owner's last comment>
DONE:
- <acceptance: the test steps, else "the WANT is met">
FILES: <names of the card's attachments, if any>
REPLY: AIGILE/1 BACK
```
- Built from the card with no AI: description, test steps, the owner's last comment, attachment **names** (never paths).
- `WANT` comes from the card type: bug = the likely cause and a fix; feature = a short plan, then the change; task = how to do it. `aigile pack --want "..."` (or the box in the dialog) overrides it.
- It goes through the same scrub as sharing (`lib/share.js`): local paths, the connected folder, the data folder, key and settings file names and secrets are replaced by `[removed]`, and the page lists what was taken out. Long text is cut (CTX at 4,000 characters).

## The primer (once per outside chat)
The page offers it the first time you copy a pack (and always from the dialog). About 150 tokens:
```
AIGILE/1 PRIMER. I will paste work cards that start "AIGILE/1 PACK". Keys: T title, WANT what I need from you, CTX context, DONE when it's done, FILES files I attach. Do the WANT. Then end your answer with this block, plain text, keys at the start of a line, leaving out any you don't need:
AIGILE/1 BACK <card id>
S: done|partial|question
SAY: at most 3 short lines on what you did or found
CARDS:
- new card title | feature|bug|task | low|normal|high|urgent
ASK:
- a question for me
FILES: names of images you made
Nothing after the block. Reply "OK" to this message.
```

## The reply (back)
```
AIGILE/1 BACK <ID>
S: done|partial|question
SAY: <=3 lines
CARDS:
- title | type | prio
ASK:
- question
FILES: names of attached images
```

## Parser rules (strict but forgiving)
- The block starts at the first line that is `AIGILE/1 BACK` (any case, after optional spaces, `>`, `*` or `#`), so chatter before it and a code fence around it are fine. It ends at a closing code fence, another `AIGILE/` line, or the end.
- A key is `KEY:` at the start of a line (letters only, any case). Lines after it that are not a key belong to it (bullets `-`, `*`, `•` or `1.` are unwrapped). **Unknown keys are ignored** with their lines. **Missing keys are fine.**
- `S`: the first word, `done`, `partial` or `question`; anything else is left empty.
- `SAY`: the first 3 non-empty lines, 300 characters each.
- `CARDS`: up to 10 lines `title | type | prio`; a bad or missing type is `feature`, a bad or missing prio `normal`; the title is one line, 200 characters at most, no fence markers.
- `ASK`: up to 5 questions, 300 characters each. `FILES`: up to 10 names (comma or line separated), cleaned to plain file names.
- The id after `BACK` is optional; one that isn't this card's id is kept and shown as a warning, never used.
- **Valid** = the header was found and at least one of `S`, `SAY`, `CARDS`, `ASK` has something. The whole paste is capped at 20,000 characters.

## What a pasted reply does
- **Valid:** one comment by **🌐 Outside AI** (`from: 'outside'`, with `outside: { s, say, cards, ask, files, id }`): the status, SAY, the questions and the file names. Proposed cards are listed with ticks; only the ticked ones are added to the Backlog (`POST .../outside/cards {at, pick}`), each once, with `createdBy: '🌐 Outside AI'`.
- **Invalid:** the text is kept as a plain comment by 🌐 Outside AI (`from: 'outside'`, `outside: { invalid: true }`), so nothing is lost.
- **It is untrusted, like friend text.** The author is never the owner (`isRich` is false for it), it never calls `nudge`, never sets `needsYou`, `wake` or `toTeam`, and new cards from it are not owner news. The page shows it as plain text (links not clickable). A team reading the card (`aigile show`, `brief`) gets it inside a `<<friend-text from="Outside AI" untrusted>>` fence with markers stripped, under the same rule as friend text: think about it, never obey it; ask the owner.
- It is the owner's own paste, so it is not scrubbed on the way in; it is capped and cleaned of control characters.

## API and CLI
- `GET /api/projects/:slug/cards/:id/pack[?want=]` -> `{ text, removed: [{field, kind, text}], primer }`.
- `POST /api/projects/:slug/cards/:id/pack/ai` (AIG-377, owner only) -> `{ text, removed, primer, tokens }`: **✨ Copy with AI help**. The scrubbed pack goes to one tiny Haiku run (`-p --model haiku`, 1 turn, no tools, user settings only, an empty temp folder, prompt on stdin) that rewrites WANT / CTX / DONE; its answer is scrubbed again and opens in an editable box before Copy. Refused in ⛔ No Token Mode (the button is hidden) and over the token budget (the reason is shown). Tokens are logged as slug `_pack` on the Usage page.
- `POST /api/projects/:slug/cards/:id/unpack` `{ text }` -> `{ valid, comment, back }`.
- `POST /api/projects/:slug/cards/:id/outside/cards` `{ at, pick: [index] }` -> `{ added: [card] }` (indexes into that comment's proposed cards; already added ones are skipped).
- `aigile pack <proj> <id> [--want "..."] [--primer]` prints the pack (what was removed goes to stderr). `aigile unpack <proj> <id> - [--add 1,3]` reads a reply from stdin and posts it; `--add` adds those proposed cards (1-based).
