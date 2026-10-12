# AI-gile in Spanish (es, Spain)

Written by Babel for AIG-489, then checked value by value by a native-speaker reviewer (model).

## Register
- Casual **tú** throughout (no usted). `vosotros` only where two people act together ("leeos", "podéis", "permitís"), as Spain Spanish does.
- Spain Spanish: móvil, ordenador, app, wifi. Present perfect for recent events ("ha respondido", "has elegido", "no se ha podido"), not the preterite ("respondió", "elegiste").
- Keyboard keys as printed on Spanish keyboards: **Intro** (not Enter), **Mayús** (not Shift), **Esc**.
- Tooltips that start with "Click to..." use "Haz clic para...", never a bare "Clic para...".
- Short forms for buttons and labels; "Hecho", "Por hacer", "En curso".
- Plurals with `{n}`/`{count}`: neutral forms such as "equipo(s)" where English has a fixed form.
- `{{dev:...}}` markers kept around the whole Spanish word where it is a dev word ("{{dev:probar}}", "{{dev:prueba}}"); English loanwords backlog, sprint, bug, commit are kept as is, also inside the marker.
- Avoid gendered words about the user where a neutral form is natural ("¡Te damos la bienvenida!", "Es mi primera vez", "Aún no lo tengo claro").

## Glossary
| English | Spanish | Note |
|---|---|---|
| card | tarjeta | feminine: "bloqueada", "atascada", "aprobada" |
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
| Done | Hecho | column, buttons and "pasa a Hecho" |
| Backlog | Backlog | loanword, as software teams say |
| sprint | sprint | loanword |
| stand-up | stand-up | loanword |
| inbox | bandeja | "Bandeja de entrada" shortened |
| Setup | Ajustes | the page is a settings page |
| Usage | Uso | |
| test | prueba / probar | |
| AI tester | probador de IA | |
| passed / failed (AI tester) | aprobada / suspendida | exam metaphor, as in Spain |
| test steps | pasos de prueba | |
| Send back | Devolver | |
| Accept | Aceptar | |
| Go (button) | Adelante | "dar el visto bueno" in running text |
| build (verb, "ask before every build") | construir | "antes de construir nada" |
| Wake (team) | Despertar | |
| Poke | dar un toque | button "👉 Dar un toque" |
| Watch (👁) | Observar | |
| night watch / night watchman | vigilancia nocturna / vigilante nocturno | setting: "El vigilante revisa todos los proyectos" |
| Going quiet / Go quiet | Me desconecto / Desconectar | was "Silencio" |
| assumption | suposición | "Plug this" = "Tapar el hueco" |
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
| terminal | el terminal | masculine everywhere |
| Reporter (share role) | Informador | |
| level / step (budget plan) | nivel | |
| Wait and see / Later | Ya lo veré / Luego | |
| Timed ("Come back at") | Que vuelva… / Que vuelva a las | |

## Questions from the first pass, answered
- **"MD" for DMs:** keep "MD". In Spain "mandar un MD" is what people say on social networks; it reads naturally in `dms.*` and the left rail. Fixed `dms.rail.label` to "los líderes de tus equipos" (one lead per team).
- **"Ajustes" vs "Configuración":** keep "Ajustes": shorter, and it is what phones in Spain call the settings page. It is used consistently, next to 🎨 Aspecto and ⚙️ Columnas.
- **Gender with "tarjeta":** the feminine agreement is right. Fixed the few strings where the subject is not the card (`check.chip.title` items are "marcados"; `card.earlier` refers to messages, "los más recientes").
- **"Hecho" for the column and for buttons:** fine, and short enough. The help text now writes "pasa a Hecho" with a capital when it means the column.
- **`sm.push.*` jokes:** "Que no caigan los platos", "Con calma", "Constante", "Con ganas" (was "Atento", which means attentive, not keen), "A latigazos". Tone is right.
- **`gloss.*.also` aliases:** fine; "error", "reunión diaria", "rama", "repositorio" all match words used elsewhere.

## Review
What changed (242 values):
- Preterite replaced by the present perfect for recent events across toasts and status lines ("ha aceptado", "has dicho que ahora no", "no se ha podido despertar", "se ha guardado").
- Keyboard hints now use Intro / Mayús (`dms.placeholder`, `card.reply.ph`, `inbox.q.ph`, `inbox.k.ph`, `decide.*`, `quiz.other.ph`, `emoji.hint`).
- "Clic para..." tooltips became "Haz clic para...".
- Going quiet: "Silencio" / "Pasar a silencio" became "Me desconecto" / "Desconectar", matching the "te desconectas" already used in the help texts.
- Watch: "Vigilar" became "Observar" (vigilar is for the night watchman).
- AI tester results: "Fallida" became "Suspendida" (with "Aprobada"); "No se pudo comprobar" shortened to "Sin comprobar".
- Calques fixed: "Esperar y ver" (now "Ya lo veré"), "Construida y esperando" ("Lista y esperando"), "Un paso, una sola vez" ("Solo una vez"), "en cristiano" ("en lenguaje llano"), "Suelta imágenes" ("Pon imágenes"), "Leed estas 6 palabras a tu amigo" (wrong person, now "Léele"), "Se descargan AI-gile con él" (now "tu amigo descarga").
- "build" questions in the quiz and wizard reworded ("antes de construir nada", "haz las cosas pequeñas sin preguntar") instead of "cada construcción".
- "Shift", "mensajito", "preguntita", "ventanita", "casi sin nada" replaced with neutral forms ("pregunta mínima", "casi agotado").
- Terminal is masculine everywhere ("el terminal"), matching `pres.terminal`.
- The Setup switch name quoted in `sm.night.title` now matches `lead.watchAll` exactly.
- Gendered words about the user removed where natural (`setup.welcome`, `tour.lvl.new`, `fx.sum.h`, `inbox.*.wait.title`, `pretend.auto`).
- Share role "Informante" (sounds like a police informer) became "Informador"; mid level "semi-senior" (Latin American) became "intermedio".

Still worth a human native speaker's eye:
- "Que no caigan los platos" and "A latigazos" for the Scrum Master levels: playful; check they don't read as odd.
- "Tablero de vida" for the Life board: understandable, though "Tablero personal" might be more natural.
- "Que vuelva…" / "Que vuelva a las" for the timed picker: depends on the layout of the picker.
- Long buttons: "✅ Aceptar todas las aprobadas por la IA ({n})", "🔄 Comprobar el uso ahora", "📋 Enseñar a {name} todo mi tablero (…)".
- "Equipo(s)", "líder(es)" plurals are neutral but a little stiff.
