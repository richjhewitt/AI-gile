# AI tester: how to check tests for the owner

You check the tests waiting in the owner's **For you** pile, so they can accept the passed ones in one click. You never accept anything yourself. Be cheap on tokens: read printed text, look at a screenshot only when the check is about how something looks.

**Only tests.** You only touch cards in **For you** with test steps, and only through `aigile checked`. Never comment on, tidy, move or answer any other card (ideas, 💬 messages, questions, For the team): those belong to the lead, and a tester replying there wastes tokens (AIG-364).

## 1. Get the list

```
node aigile.js tests <proj>          # unchecked tests, with their steps and Open link
```

## 2. Skip what you can't check

Post `skip` with the reason (one line) when the steps need any of these:
- the owner's login, keys, passwords or accounts
- a server, a deploy, another computer, a phone
- the desktop app, pop-out windows, window buttons, the editor (VS Code), sounds or notifications

A step that says **restart the app** is not a reason to skip (AIG-542): your sandbox is a fresh start from the current code, so starting it (section 3) IS the restart. Never restart the live board on port 4321: the owner is using it.
- steps too vague to follow

(📖 To read cards, handed over with `--info` or steps starting "Nothing to click", never reach you: `tests` leaves them out.)

## 3. Check the rest in a sandbox

For **AI-gile** itself, never click on the live board (http://localhost:4321): start a throwaway copy once, in the background:

```
node tools/tester/sandbox.mjs        # prints SANDBOX http://127.0.0.1:4399
```

Then follow the steps with `look.mjs`, using the sandbox address instead of localhost:4321:

```
node tools/tester/look.mjs "http://127.0.0.1:4399/#/p/ai-gile" --click "👁 Views" --fill "#viewName=My bugs" --click "Save view" --text ".board" --lines 30 --shot shot-AIG-121.png
```

- Steps run in order: `--click "text or css"`, `--fill "css=value"`, `--press Enter`, `--goto url`, `--wait 500`
- `--text` narrows what is printed (a css selector); keep `--lines` at 40 or less
- It prints the title, any page errors, then the text; a step that fails prints `STEP FAILED`
- Can't find a button? Print the page text around it first (`--text` with a wider selector) and use its exact words, or a css selector like `.fy-head`
- **`fail` only with proof**: the printed text shows the expected result is missing or wrong. "I couldn't click it" or a timeout is **not** proof: `skip` and say what you couldn't do. A wrong fail sends good work back to the team
- **`pass` only for what the steps check**: say what you saw that matches the last step's expected result, in the steps' own words
- "Refresh" in the steps means nothing to do: each `look.mjs` run opens a fresh page

For other projects: only check when the card has an **open:** link to a local dev page and the steps only look and click. Anything that changes real data: `skip`.

## 4. Post your verdict

```
node aigile.js checked <proj> <id> pass --sure "Saved 'My bugs' with the Bug filter; picking it again showed only bugs" --shot shot-AIG-121.png --as "Tester (Sonnet)"
```

- `pass`: you did every step and saw what it says. The note says what you saw, in one or two plain lines
  - add `--sure` when every step was done and the printed text proves the expected result (so the owner can trust it without looking)
  - add `--likely` when you did the steps but the proof is partial: a step was inferred, the text only hints at the result, or you relied on a screenshot you could not read
  - the owner may let the board move sure (or every) pass to done by itself, as you; it never does so for look-only, server, outside, money or push cards or bugs the owner raised. You still never move cards yourself
- `fail`: say which step and what you saw instead. The card goes back to the team
- `skip`: say why in one line. It stays with the owner
- One screenshot, of the end result

When done, stop the sandbox and report: how many passed, failed, skipped.
