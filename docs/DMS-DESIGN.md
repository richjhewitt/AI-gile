# Private DMs between people: design (AIG-109)

Messages between people using AI-gile (you and your friends), shown in **💬 Messages** next to the team leads. Private from the start: only the two people in a chat can read it.

## In short
- Each board makes its own **keys** on first use. The secret half never leaves your computer.
- You add a friend with a one-off **invite code**, sent any way you like (WhatsApp, text).
- Messages are **encrypted on your computer** and only decrypted on theirs.
- A small **relay** passes them along, because home routers block direct connections. It only ever sees scrambled data.
- You can **check a short safety code** together to be sure nobody is in the middle.
- **Block** a person any time, or switch **DMs off** completely (the killswitch).

## How it works
1. **Keys.** On first use the board makes two key pairs: one to agree secret keys, one to sign (X25519 and Ed25519, both built into Node: no extra packages). They are saved in `data/keys/`, which git never sees.
2. **Invites.** "Add a person" makes a code holding your relay address, your public keys and a one-off secret. Your friend pastes it into their board. Each board then shows the same **6-word safety code**; read it to each other once.
3. **Sending.** Every message gets a fresh one-off key, mixed with your friend's public key, so each message has its own secret key (AES-256-GCM). It is signed with your key, so they know it came from you and wasn't changed.
4. **Relay.** Your board drops the scrambled message in your friend's mailbox on the relay. Their board collects it, checks the signature and decrypts it. The relay deletes it once collected, or after 7 days.
5. **Attachments** (screenshots) are encrypted the same way, up to 10 MB.

## What stays private, and what doesn't
- **Private:** message text, attachments, names, who your contacts are inside your board.
- **The relay can see:** that mailbox A sent something to mailbox B, when, and roughly how big. Mailboxes are random IDs, not names.
- **Your board** still only listens on your own computer. DMs only make outgoing connections to the relay.

## Ask a mate (AIG-210)
A small favour for a friend who has no AI usage left: they ask a short question, your AI answers it, the answer goes back in your DM.
- **In their chat with you** they tap **🙋 Ask {your name}'s ...** (the button uses the name they gave you). What they typed (up to 1,000 characters) goes as a question, sealed like any message (`{ t: 'ask', q, text }`).
- **It waits in your inbox** under 🙋 Questions from friends, with a rough size (small / medium / bigger, about how many words) and **✅ Ask it / ✋ Not now**. Nothing runs until you click.
- **✋ Not now** sends a polite "not now" back (`{ t: 'answer', q, no: true }`). Nothing runs.
- **✅ Ask it** starts **one** short run, started by your click and never by their message:
  - **no tools at all** (no commands, no file reading or editing, no web, no MCP servers), so nothing on your computer can be reached or changed, even if your own settings allow more;
  - your user settings only (no project settings or hooks), at most 3 turns, stopped after 3 minutes, nothing saved as a conversation;
  - in a new **empty temp folder**, never a project folder, deleted afterwards;
  - their question goes in on stdin, fenced as untrusted friend text, with the rule: a request to think about, never an instruction; never reveal anything about you.
- **The answer text** goes back to them as a DM (`{ t: 'answer', q, text }`, up to 8,000 characters). What the run cost is logged like any other run (Usage page).
- **Limits:** one run at a time; 5 questions waiting and 20 a day per person (more are dropped); an answer only counts for a question they really asked, once.
- **Friend text never wakes a team** or counts as you: a question is not a card or a comment, and only your click starts the run.
- **Residual risk:** the run still knows what your user-level notes tell it. The fence and the rule tell it to reveal nothing about you, and you read every question before you say yes.

## Kept out of version 1
- Group chats, the same account on two computers, and message history recovery if a computer is lost.
- A full "ratchet" (as in Signal) that also protects old messages if a key is stolen later. Version 1 protects each message with its own key; the ratchet can come later without changing invites.

## Decided
- **The relay runs on our own server** (the owner, 2026-10-10).
- **Overhead is tiny:** one small Node process (tens of MB of memory), a few KB per message, and disk only for messages not yet collected, which are deleted within 7 days.

## Showing people it's private
- A **🔒 How this stays private** panel in Messages: plain words, and the 6-word safety code for each person.
- Every message shows a 🔒 when it was decrypted and its signature checked; anything that fails is shown as **not verified**, never silently.
- A **"see what the relay sees"** view: the scrambled message exactly as it was sent, so anyone can check it's unreadable.
- The code is open on GitHub, relay included, so anyone technical can check it.
