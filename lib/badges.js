// 🎨 Badge maker (AIG-396): a free round profile picture drawn by code from three parts: an animal, a colour and an accessory.
// Stored on the roster entry as m.avatar = "badge:fox/teal/glasses", served as SVG at /api/avatars/badge/fox/teal/glasses.
const circ = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const ell = (x, y, rx, ry, f) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"/>`;
const path = (d, f) => `<path d="${d}" fill="${f}"/>`;
const eyes = (y = 52, dx = 9, r = 3.2) => circ(50 - dx, y, r, '#2b2b33') + circ(50 + dx, y, r, '#2b2b33') + circ(50 - dx + 1, y - 1, 1, '#fff') + circ(50 + dx + 1, y - 1, 1, '#fff');
const nose = (y = 60, f = '#2b2b33') => ell(50, y, 3.6, 2.6, f);
const smile = (y = 65) => `<path d="M43 ${y} Q50 ${y + 6} 57 ${y}" fill="none" stroke="#2b2b33" stroke-width="2" stroke-linecap="round"/>`;
const head = (f, rx = 26, ry = 24, y = 56) => ell(50, y, rx, ry, f);
const face = (extra = '') => eyes() + extra + nose() + smile();
const twoEars = (f, inner, y = 34, dx = 19, r = 9) => circ(50 - dx, y, r, f) + circ(50 + dx, y, r, f) + (inner ? circ(50 - dx, y, r * .55, inner) + circ(50 + dx, y, r * .55, inner) : '');
const tall = (f, inner, h = 26) => ell(38, 28, 7, h / 1.6, f) + ell(62, 28, 7, h / 1.6, f) + ell(38, 28, 3.5, h / 2.4, inner) + ell(62, 28, 3.5, h / 2.4, inner);
const tri = (f, inner) => path('M26 44 L30 18 L45 34 Z', f) + path('M74 44 L70 18 L55 34 Z', f) + path('M31 38 L32 25 L40 34 Z', inner) + path('M69 38 L68 25 L60 34 Z', inner);

// Each animal draws behind-the-head parts, the head, then the face. All on a 100x100 board.
const ANIMALS = {
  fox: () => tri('#e8772e', '#3b2a22') + head('#e8772e') + path('M24 58 Q50 80 76 58 Q60 70 50 72 Q40 70 24 58Z', '#fff') + face(),
  cat: () => tri('#b8b0a6', '#f0a8b8') + head('#b8b0a6') + face('<path d="M30 60h-9M30 64h-8M70 60h9M70 64h8" stroke="#2b2b33" stroke-width="1.2" stroke-linecap="round"/>'),
  dog: () => ell(27, 50, 8, 16, '#7a5a3c') + ell(73, 50, 8, 16, '#7a5a3c') + head('#d9b48a') + ell(50, 64, 12, 9, '#f2dcc0') + eyes() + nose(60) + smile(66),
  bear: () => twoEars('#8a5a3a', '#d9b48a') + head('#8a5a3a') + ell(50, 63, 11, 8, '#d9b48a') + face(),
  panda: () => circ(31, 33, 9, '#2b2b33') + circ(69, 33, 9, '#2b2b33') + head('#fff') + ell(40, 52, 6.5, 8, '#2b2b33') + ell(60, 52, 6.5, 8, '#2b2b33') + circ(41, 51, 2.2, '#fff') + circ(59, 51, 2.2, '#fff') + nose(61) + smile(66),
  rabbit: () => tall('#f2eee6', '#f2a8b8', 40) + head('#f2eee6', 24, 22, 58) + eyes(55) + nose(62, '#f08aa0') + smile(67) + '<path d="M44 68 L44 73 L50 73 L50 68M50 68 L50 73 L56 73 L56 68" fill="#fff" stroke="#bbb" stroke-width=".8"/>',
  mouse: () => circ(27, 36, 12, '#a8a39a') + circ(73, 36, 12, '#a8a39a') + circ(27, 36, 7, '#f2a8b8') + circ(73, 36, 7, '#f2a8b8') + head('#a8a39a', 24, 22, 58) + eyes(55) + nose(62, '#f08aa0') + smile(67),
  frog: () => circ(34, 36, 11, '#6bbf59') + circ(66, 36, 11, '#6bbf59') + circ(34, 36, 6, '#fff') + circ(66, 36, 6, '#fff') + circ(34, 37, 3, '#2b2b33') + circ(66, 37, 3, '#2b2b33') + head('#6bbf59', 28, 20, 58) + '<path d="M32 62 Q50 78 68 62" fill="none" stroke="#2b2b33" stroke-width="2" stroke-linecap="round"/>' + circ(45, 55, 1.2, '#2b6a2b') + circ(55, 55, 1.2, '#2b6a2b'),
  owl: () => path('M26 40 L28 20 L42 32Z', '#8a6a4a') + path('M74 40 L72 20 L58 32Z', '#8a6a4a') + head('#8a6a4a', 27, 26) + circ(39, 50, 10, '#fff') + circ(61, 50, 10, '#fff') + circ(39, 50, 5, '#2b2b33') + circ(61, 50, 5, '#2b2b33') + path('M44 58 L56 58 L50 68Z', '#f0b429') + '<path d="M36 72 Q50 80 64 72" fill="none" stroke="#6b4e32" stroke-width="2" stroke-dasharray="3 3"/>',
  penguin: () => head('#2b3446', 25, 27, 54) + ell(50, 60, 17, 19, '#fff') + eyes(48, 8) + path('M44 54 L56 54 L50 61Z', '#f0a030') + ell(25, 70, 5, 12, '#2b3446'),
  pig: () => path('M28 40 L30 22 L44 32Z', '#f2a0b4') + path('M72 40 L70 22 L56 32Z', '#f2a0b4') + head('#f6b3c3') + ell(50, 62, 11, 8, '#f08aa0') + circ(46, 62, 1.8, '#a04a60') + circ(54, 62, 1.8, '#a04a60') + eyes(50),
  lion: () => circ(50, 54, 36, '#c9822e') + head('#f0c070', 23, 22) + twoEars('#c9822e', '#f0c070', 30, 20, 7) + face(),
  tiger: () => tri('#f09a3a', '#fff') + head('#f09a3a') + '<path d="M30 46 L38 48M28 54 L37 54M70 46 L62 48M72 54 L63 54M50 32 L50 40" stroke="#2b2b33" stroke-width="2.4" stroke-linecap="round"/>' + ell(50, 63, 11, 8, '#fff') + face(),
  koala: () => circ(24, 40, 13, '#9a9aa6') + circ(76, 40, 13, '#9a9aa6') + circ(24, 40, 7, '#e8e0e0') + circ(76, 40, 7, '#e8e0e0') + head('#9a9aa6') + eyes() + ell(50, 60, 6, 8, '#2b2b33') + smile(70),
  monkey: () => circ(23, 52, 9, '#8a5a3a') + circ(77, 52, 9, '#8a5a3a') + circ(23, 52, 5, '#f0c9a0') + circ(77, 52, 5, '#f0c9a0') + head('#8a5a3a') + ell(50, 60, 17, 14, '#f0c9a0') + circ(40, 50, 7, '#f0c9a0') + circ(60, 50, 7, '#f0c9a0') + eyes(51, 9, 2.8) + circ(47, 60, 1.3, '#2b2b33') + circ(53, 60, 1.3, '#2b2b33') + smile(65),
  elephant: () => ell(22, 52, 14, 18, '#9fb0bf') + ell(78, 52, 14, 18, '#9fb0bf') + head('#b9c8d6') + path('M43 60 Q43 84 52 84 Q60 84 57 76 Q54 78 53 70 L57 60Z', '#b9c8d6') + eyes(48, 10),
  sheep: () => circ(30, 36, 12, '#f4f1ea') + circ(50, 28, 13, '#f4f1ea') + circ(70, 36, 12, '#f4f1ea') + circ(24, 52, 9, '#f4f1ea') + circ(76, 52, 9, '#f4f1ea') + ell(50, 58, 20, 22, '#3a3a44') + eyes(54, 8) + nose(63, '#f08aa0'),
  duck: () => circ(50, 54, 27, '#ffd84a') + ell(50, 63, 15, 8, '#f08a2a') + eyes(48, 10) + '<path d="M40 66 Q50 71 60 66" fill="none" stroke="#c46a18" stroke-width="1.6" stroke-linecap="round"/>' + path('M50 22 Q44 14 52 14 Q48 20 54 22Z', '#ffd84a'),
  octopus: () => '<path d="M24 66 Q20 88 30 84 Q34 78 36 86 Q42 92 46 84 Q50 92 54 84 Q58 92 64 86 Q66 78 70 84 Q80 88 76 66Z" fill="#b068d8"/>' + ell(50, 48, 28, 28, '#b068d8') + eyes(52, 10, 4) + smile(62),
  dragon: () => path('M32 38 L28 16 L44 30Z', '#f2c14a') + path('M68 38 L72 16 L56 30Z', '#f2c14a') + head('#4caf6a', 26, 23) + ell(50, 64, 15, 10, '#8ad89a') + eyes(50, 10) + circ(45, 63, 1.6, '#2b5a3a') + circ(55, 63, 1.6, '#2b5a3a') + '<path d="M46 40 L50 33 L54 40Z" fill="#f2c14a"/>',
  ghost: () => '<path d="M24 82 L24 50 Q24 22 50 22 Q76 22 76 50 L76 82 L67 74 L58 82 L50 74 L42 82 L33 74Z" fill="#f6f6fb"/>' + eyes(48, 9, 4) + ell(50, 62, 4, 5, '#2b2b33'),
  robot: () => '<rect x="48" y="16" width="4" height="10" fill="#8a94a6"/>' + circ(50, 16, 4, '#e8484a') + '<rect x="24" y="28" width="52" height="46" rx="10" fill="#c3cad6"/><rect x="32" y="40" width="36" height="14" rx="7" fill="#2b3446"/>' + circ(42, 47, 4, '#5ce0ff') + circ(58, 47, 4, '#5ce0ff') + '<path d="M38 64 L62 64" stroke="#2b3446" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 3"/>',
};

const COLOURS = { red: '#e9726e', orange: '#f2a24a', yellow: '#f4d35e', lime: '#a6d96a', green: '#5cb98a', teal: '#3bb3b0', sky: '#6bb8f0', blue: '#5b86e5', purple: '#9b7be0', pink: '#f08ab8', brown: '#b58a64', grey: '#a3acb8' };

// Accessories sit on the head (hat, cap, crown, bow, flower, star, headphones), the face (glasses) or the neck (scarf).
const ACCESSORIES = {
  none: () => '',
  hat: () => path('M32 34 L68 34 L50 6Z', '#e9486a') + ell(50, 34, 24, 4.5, '#b8304e') + circ(50, 7, 3.5, '#ffd84a'),
  glasses: () => '<g fill="rgba(180,220,255,.35)" stroke="#2b2b33" stroke-width="2.4"><circle cx="41" cy="52" r="8.5"/><circle cx="59" cy="52" r="8.5"/></g><path d="M49.5 51 Q50 49 50.5 51M32.5 51 L27 48M67.5 51 L73 48" fill="none" stroke="#2b2b33" stroke-width="2.4" stroke-linecap="round"/>',
  scarf: () => '<path d="M22 74 Q50 90 78 74 L82 86 Q50 102 18 86Z" fill="#e9486a"/><path d="M60 82 L68 100 L78 98 L70 80Z" fill="#c23556"/><path d="M30 80 L34 90M42 85 L46 94M54 86 L58 95" stroke="#fff" stroke-width="2" opacity=".6"/>',
  headphones: () => '<path d="M24 54 Q24 24 50 24 Q76 24 76 54" fill="none" stroke="#2b3446" stroke-width="5" stroke-linecap="round"/><rect x="18" y="46" width="11" height="20" rx="5" fill="#e9486a"/><rect x="71" y="46" width="11" height="20" rx="5" fill="#e9486a"/>',
  crown: () => path('M30 36 L28 14 L40 24 L50 10 L60 24 L72 14 L70 36Z', '#ffcf2e') + '<rect x="30" y="33" width="40" height="5" fill="#e0a800"/>' + circ(50, 22, 2.5, '#e9486a') + circ(35, 28, 2, '#5b86e5') + circ(65, 28, 2, '#5b86e5'),
  bow: () => path('M62 28 L80 18 L80 40Z', '#e9486a') + path('M62 28 L44 18 L44 40Z', '#e9486a') + circ(62, 29, 4.5, '#c23556'),
  cap: () => path('M26 40 Q26 14 52 14 Q72 14 74 40Z', '#3b7de0') + path('M60 38 L90 40 Q90 46 60 44Z', '#2b5fb0') + circ(52, 12, 3, '#2b5fb0'),
  flower: () => [0, 72, 144, 216, 288].map(a => circ((70 + 7 * Math.cos(a * Math.PI / 180)).toFixed(1), (28 + 7 * Math.sin(a * Math.PI / 180)).toFixed(1), 5, '#fff')).join('') + circ(70, 28, 4, '#ffcf2e'),
  star: () => '<path d="M50 4 L55 18 L70 18 L58 27 L62 41 L50 33 L38 41 L42 27 L30 18 L45 18Z" fill="#ffcf2e" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/>',
};

const animals = () => Object.keys(ANIMALS), colours = () => Object.keys(COLOURS), accessories = () => Object.keys(ACCESSORIES);
const PREFIX = 'badge:';
// "badge:fox/teal/glasses" -> { animal, colour, accessory }, or null when it is not a valid badge.
function parse(s) {
  const m = /^badge:([a-z]+)\/([a-z]+)\/([a-z]+)$/.exec(String(s || '').toLowerCase());
  return m && ANIMALS[m[1]] && COLOURS[m[2]] && ACCESSORIES[m[3]] ? { animal: m[1], colour: m[2], accessory: m[3] } : null;
}
const spec = (animal, colour, accessory) => PREFIX + [animal, colour, accessory].join('/').toLowerCase();
const isBadge = s => !!parse(s);
const svg = b => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><defs><clipPath id="c"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#c)">${circ(50, 50, 50, COLOURS[b.colour])}${ANIMALS[b.animal]()}${ACCESSORIES[b.accessory]()}</g></svg>`;
const random = () => { const pick = a => a[Math.floor(Math.random() * a.length)]; return spec(pick(animals()), pick(colours()), pick(accessories())); };
const parts = () => ({ animals: animals(), colours: colours().map(n => ({ name: n, hex: COLOURS[n] })), accessories: accessories() });

module.exports = { parse, spec, isBadge, svg, random, parts, animals, colours, accessories };
