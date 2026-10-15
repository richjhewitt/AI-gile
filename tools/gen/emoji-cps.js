// Prints the emoji code points (JSON) that tools/gen/emoji-data.py names. Skips flags and skin-tone modifiers.
const out = [];
for (let c = 0x203C; c <= 0x1FAFF; c++) {
  const ch = String.fromCodePoint(c);
  if (c >= 0x1F1E6 && c <= 0x1F1FF) continue;
  if (c >= 0x1F3FB && c <= 0x1F3FF) continue;
  if (c >= 0x1F100 && c <= 0x1F1FF && c !== 0x1F170 && c !== 0x1F171 && c !== 0x1F17E && c !== 0x1F17F && c !== 0x1F18E && !(c >= 0x1F191 && c <= 0x1F19A)) continue;
  if (/\p{Emoji_Presentation}/u.test(ch) || (/\p{Extended_Pictographic}/u.test(ch) && /\p{Emoji}/u.test(ch))) out.push(c);
}
console.log(JSON.stringify(out));
