# AI-gile in Spanish (es, Spain), first pass

Written by Babel for AIG-489. A native-speaker model reviews it next.

## Register
- Casual **tú** throughout (no usted, no vosotros in UI text), matching LocoRadio's Spanish and AI-gile's friendly English.
- Spain Spanish: móvil, ordenador, present perfect where it reads naturally ("ha cambiado"). Dates and durations follow es-ES.
- Short forms for buttons and labels; "Hecho", "Por hacer", "En curso".
- Plurals with `{n}`/`{count}`: neutral forms such as "equipo(s)", "vez/veces" where English has a fixed form.
- `{{dev:...}}` markers kept around the whole Spanish word where it is a dev word ("{{dev:probar}}", "{{dev:prueba}}"); English loanwords backlog, sprint, bug, commit are kept as is, also inside the marker.

## Glossary
| English | Spanish | Note |
|---|---|---|
| card | tarjeta | |
| board | tablero | |
| project | proyecto | |
| team | equipo | |
| lead | líder | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Para ti | column and badges |
| To do | Por hacer | |
| In progress / Doing | En curso | |
| Team checking | El equipo revisa | |
| For the team | Para el equipo | |
| Verify column ("For you to test") | Para que lo pruebes | |
| Done | Hecho | |
| Backlog | Backlog | loanword, as software teams say |
| sprint | sprint | loanword |
| stand-up | stand-up | loanword |
| inbox | bandeja | "Bandeja de entrada" shortened |
| Setup | Ajustes | the page is a settings page |
| Usage | Uso | |
| test | prueba / probar | |
| test steps | pasos de prueba | |
| Send back | Devolver | |
| Accept | Aceptar | |
| Wake (team) | Despertar | |
| Poke | Toque / dar un toque | |
| night watch | vigilancia nocturna | "night watchman" = vigilante nocturno |
| Going quiet | Silencio | |
| assumption | suposición | |
| No Token Mode | Modo Sin Tokens | |
| token | token | |
| agent | agente | |
| Look (🎨) | Aspecto | |
| Permissions | Permisos | |
| Views | Vistas | |
| DM | MD (mensaje directo) | |
| Pop out | Separar / Sacar | |
| Group (cards) | Grupo | |
| Space | Espacio | |
| Life board | Tablero de vida | |
| Focus | Concentración | |
| Checklist | Lista de comprobación | |
| Hook | Hook | kept |
| Stuck | atascada | |

## For the reviewer
- "MD" for DMs is my choice (mensajes directos); Spanish speakers may prefer "DM". Check it reads naturally in `dms.*` and the left rail.
- "Setup" became "Ajustes" while "Configuración" is also possible; check consistency with the 🎨 Aspecto and ⚙️ Columnas buttons.
- Gender agreement in strings that refer to a card ("bloqueada", "atascada") assumes feminine "tarjeta"; strings with {what} or generic subjects may need a look.
- "Hecho" is used both for the Done column and for "Done" buttons; fine in context, check button widths.
- Pirate-style jokes in the English "sm.push.*" labels ("Crack the whip", "Keep the plates spinning") are rendered idiomatically; confirm tone.
- Glossary `gloss.*.also` lists include extra Spanish aliases (error, reunión diaria, despliegue); check they match words used elsewhere.
