# Regenerates public/js/emoji-data.js:  node tools/gen/emoji-cps.js > cps.json ; python tools/gen/emoji-data.py cps.json
import json, sys, unicodedata
cps = json.load(open(sys.argv[1]))
ALIAS = {'smile':'😄','grin':'😁','grinning':'😀','joy':'😂','rofl':'🤣','sob':'😭','cry':'😢','thumbsup':'👍','+1':'👍','thumbsdown':'👎','-1':'👎','heart':'❤️','broken_heart':'💔','fire':'🔥','tada':'🎉','rocket':'🚀','eyes':'👀','pray':'🙏','clap':'👏','wave':'👋','ok_hand':'👌','muscle':'💪','100':'💯','thinking':'🤔','white_check_mark':'✅','check':'✔️','x':'❌','warning':'⚠️','star':'⭐','sparkles':'✨','bug':'🐛','zap':'⚡','boom':'💥','bulb':'💡','memo':'📝','pushpin':'📌','lock':'🔒','key':'🔑','coffee':'☕','beer':'🍺','pizza':'🍕','cake':'🍰','sunglasses':'😎','wink':'😉','blush':'😊','heart_eyes':'😍','kissing_heart':'😘','sweat_smile':'😅','laughing':'😆','neutral_face':'😐','rage':'😡','angry':'😠','scream':'😱','sleeping':'😴','sweat':'😓','hugs':'🤗','shrug':'🤷','facepalm':'🤦','skull':'💀','ghost':'👻','robot':'🤖','poop':'💩','see_no_evil':'🙈','hear_no_evil':'🙉','speak_no_evil':'🙊','point_up':'☝️','point_down':'👇','point_left':'👈','point_right':'👉','raised_hands':'🙌','handshake':'🤝','v':'✌️','fist':'✊','punch':'👊','crossed_fingers':'🤞','computer':'💻','email':'📧','phone':'☎️','calendar':'📅','chart':'📈','package':'📦','hourglass':'⏳','alarm_clock':'⏰','bell':'🔔','mag':'🔍','link':'🔗','trophy':'🏆','medal':'🏅','gift':'🎁','balloon':'🎈','sunny':'☀️','cloud':'☁️','rainbow':'🌈','snowflake':'❄️','umbrella':'☔','dog':'🐶','cat':'🐱','unicorn':'🦄','turtle':'🐢','snail':'🐌','rose':'🌹','tulip':'🌷','seedling':'🌱','apple':'🍎','pineapple':'🍍','taco':'🌮','hamburger':'🍔','fries':'🍟','wrench':'🔧','hammer':'🔨','gear':'⚙️','construction':'🚧','stop_sign':'🛑','no_entry':'⛔','arrow_right':'➡️','arrow_left':'⬅️','arrow_up':'⬆️','arrow_down':'⬇️','recycle':'♻️','question':'❓','exclamation':'❗','red_circle':'🔴','green_circle':'🟢','blue_circle':'🔵','yellow_circle':'🟡','white_circle':'⚪','black_circle':'⚫','smiley':'😃','slight_smile':'🙂','upside_down':'🙃','pensive':'😔','worried':'😟','confused':'😕','disappointed':'😞','tired_face':'😫','yum':'😋','stuck_out_tongue':'😛','smirk':'😏','relieved':'😌','innocent':'😇','nerd':'🤓','partying_face':'🥳','pleading':'🥺','cold_sweat':'😰','flushed':'😳','mask':'😷','zzz':'💤','dizzy':'💫','thumbs_up':'👍','thumbs_down':'👎'}
seen = {}
def add(n, g):
    if n not in seen: seen[n] = g
for n, g in ALIAS.items(): add(n, g)
for c in cps:
    try: n = unicodedata.name(chr(c))
    except ValueError: continue
    n = n.lower().replace(' ', '_').replace('-', '_')
    g = chr(c)
    if c < 0x1F000: g += '️'
    add(n, g)
rows = ',\n'.join(json.dumps([n, g], ensure_ascii=False, separators=(',', ':')) for n, g in seen.items())
open('public/js/emoji-data.js', 'w', encoding='utf-8').write(
"// Emoji shortcode list for the :name: popup (AIG-342). Generated once by tools/gen/emoji-data.py.\n"
"// Names: Discord/GitHub-style aliases typed by hand (smile, thumbsup, +1, tada...), then the Unicode character name\n"
"// in lower case with underscores (grinning_face). No network. Each row is [shortcode, glyph].\nconst EMOJI_DATA = [\n" + rows + "\n];\n")
print(len(seen))
