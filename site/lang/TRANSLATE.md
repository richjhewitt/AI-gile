# Translating the website (aigile.lol)

The site speaks every language the app has. The list is `public/lang/languages.json`: use its `code` for file names.
Each language needs three files in `site/lang/`, and one script made from them:

| File | What it is |
|---|---|
| `<code>.json` | Every text on the pages (index, interest, licence, status, privacy), flat keys, as in `en.json` |
| `<code>.lines.json` | The "AI-gile in as many words as you like" slider: its own texts for every length |
| `<code>.timeline.json` | Stage names and one-liners of the timeline, by stage id (dates and card counts stay in `site/timeline.json`) |
| `<code>.js` | Made by the generator from the three files: never edit it by hand |

A missing key or file is not an error on the live site: that text shows in English. But a finished language has all three.

Never edit `en.*`, `languages.js`, `en.timeline.json` (made from `site/timeline.json`) or the pages. Only your own language's files.

## 1. Texts: `<code>.json`

Copy `en.json` and translate every value. Keep:

- **Every key**, unchanged. Do not add keys (except plural forms, below).
- **Placeholders** exactly: `{n}`, `{name}`, `{ago}`. Move them where your grammar wants them.
- **HTML** in keys ending in `.html` (or `.html.one` / `.html.other`): the same tags (`<b>…</b>`), translate the words around and inside them. `&nbsp;` keeps two words together on one line: keep it or move it.
- **Emoji** at the start of a text (🔔 🐣 📜 🎲): keep them.
- **Names**: AI-gile, Discord and Windows stay as they are. Language names in `f.lang.p` (Dutch, Welsh, Japanese, pirate, Yoda, Klingon) go into your language.
- **The board's own words**: "For you" is a column in the app. Use the app's word for it: `col.verify.short` in `public/lang/<code>.json`. Same for card, project, lead, agent, comment: look them up in the app's file so the site and the app agree.

**Plurals**: `pitch.words.one` / `pitch.words.other` and the like. The site picks the form with `Intl.PluralRules` for your language's `locale`, then falls back to `.other`. Add the forms your language uses (`.zero`, `.two`, `.few`, `.many`), and drop `.one` if it has none (Japanese, Chinese, Korean...). `.other` is always needed. `.one` may leave out `{n}` ("a card").

**Tone**: friendly, plain and short, a bit cheeky, like the English. Jokes (stand-up coffee, purple diamonds) can be swapped for one that works in your language, as long as it says the same thing. Do not translate word for word.

## 2. Slider lines: `<code>.lines.json`

Copy the shape of `en.lines.json`: `"unit"`, `"sizes"` (the same `n` values: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144), `"quips"`. Leave `_note` out or copy it (keys starting with `_` are ignored).

**Write every length fresh, in your language.** Each length is its own complete description of AI-gile, written for that size. Never shorten a longer text, and never translate the English text for that length word for word: it will not land on the right length, and it will not read naturally. Read the English texts of all lengths to know what can be said, then write your own.

- 3 versions per length, as English has (at least 2). Each one reads naturally and stands on its own: the 5-word one is a real five-word sentence, not a cut-off one.
- 1 word: one strong word (a noun or verb with a full stop is fine). 2 to 3 words: a tiny slogan.
- The long ones (55 to 144) can tell the story differently from the English: what it does, a day with it, what it is not.
- Facts must stay true: free, runs on your own computer, no accounts or trackers, closed pre-alpha, about 120 languages, an AI tester, the night watch, only you move a card to Done.

**Length**:

- `"unit": "words"` (most languages): every text has `n` words. A word is anything between spaces that is not only punctuation (so `—` alone does not count; `end-to-end` counts once).
- `"unit": "chars"`: **only** for languages written without spaces: `zh`, `zh-tw`, `ja`, `th`, `lo`, `km`, `my`. The length is in characters: **2 characters per word**, so `n: 5` means about 10 characters, `n: 144` about 288. Only letters count (kanji, kana, hanzi, Thai letters...); spaces, digits, punctuation and combining marks do not.
- Within **±20%** of the target: exact for 1 and 2 words, ±1 at 3 to 5 words, ±29 at 144 words; at least ±1 character.

**Quips** (optional): the little joke under the text, by length. Translate or replace them; spell out numbers the way your language does.

Fun languages: `emoji` writes space-separated emoji groups as words. `morse`, `runes` and `egy` may skip the lines file (the slider then stays English).

## 3. Timeline: `<code>.timeline.json`

Copy `en.timeline.json` and translate each `<id>.name` (short, like a chapter title) and `<id>.line` (one short sentence). Keep the keys.

## 4. Build and check

From the repo root:

    node tools/gen/site-lang.mjs <code>        # makes site/lang/<code>.js from your three files
    node tools/site-i18n-check.mjs <code>      # every key, placeholders, HTML tags, slider lengths, script up to date

The check must say `0 error(s)`. Fix every warning you can (for example "text is still the English one").

A quick self-check without the tool (same keys, slider lengths within 20%), here for `de`:

    node -e "const c=process.argv[1],E=require('./site/lang/en.json'),T=require('./site/lang/'+c+'.json'),L=require('./site/lang/'+c+'.lines.json');const miss=Object.keys(E).filter(k=>!k.endsWith('.one')&&!(k in T));console.log('missing keys:',miss.join(' ')||'none');let bad=0;for(const z of L.sizes)for(const t of z.texts){const ch=L.unit==='chars',got=ch?(t.match(/\p{L}/gu)||[]).length:t.trim().split(/\s+/).filter(w=>/[^\s\p{P}]/u.test(w)).length,want=ch?2*z.n:z.n,tol=ch?Math.max(1,Math.round(want*.2)):Math.round(want*.2);if(Math.abs(got-want)>tol){bad++;console.log('length',z.n,'got',got,'want',want+'±'+tol,t.slice(0,50))}}console.log(bad?bad+' slider texts out of range':'slider lengths ok')" de

Then open `site/index.html` in a browser (double-click works), pick your language with the 🌐 button top right, and read every page: the slider at every length, the timeline, the interest and licence forms, the status page. Right-to-left languages (ar, he, fa, ur, ps, sd, yi, ckb) flip the page by themselves.

Commit only your files: `site/lang/<code>.json`, `<code>.lines.json`, `<code>.timeline.json`, `<code>.js`.
