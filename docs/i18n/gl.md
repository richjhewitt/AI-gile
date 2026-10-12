# Galician (gl) - first pass, native-speaker reviewed

Source of rules: LocoRadio docs/i18n.md and gl.json (casual "ti"; reintegrationist-free standard RAG/ILG norm; plurals one / other; dates use gl-ES). Tone: warm, plain, short.

## Register
- Casual "ti", never "vostede". Imperatives in the tu form ("Engade", "Abre"); buttons use the infinitive where short ("Gardar", "Cancelar").
- Developer words stay as loanwords where Galician teams say them (backlog, sprint, stand-up, bug, commit, push, branch, merge, token, hook). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Galician forms where needed (`{{dev:probar}}`, `{{dev:proba}}`, `{{dev:probas}}`, `{{dev:probes}}` is not used).
- Plurals: one / other (Intl.PluralRules gives these for gl).
- Short forms: "hai {n} min / h / d"; bare "{n} min / h / d".
- Gender: never "o/a" or masculine default. Used activity nouns and neutral phrasing: "Observación", "Informes", "Probas", "Desenvolvemento" for roles; "amizade" for friend, "persoa" where needed; "Boas vindas", "Pensado para Pro", "Con coidado" instead of gendered adjectives; "Bloqueo de {name}" instead of "{name} está bloqueado".

## Glossary
| English | Galician |
|---|---|
| card | tarxeta |
| board | taboleiro |
| project | proxecto |
| team | equipo |
| lead | líder |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Para ti |
| For the team | Para o equipo |
| For you to test (Verify) | Por {{dev:probar}} |
| To do | Por facer |
| In progress / Doing | En curso |
| Team checking | O equipo revisa |
| Done | Feito |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | caixa de entrada |
| Setup | Configuración |
| Usage | Uso |
| test (verb / noun) | probar / proba |
| test steps | pasos da proba |
| bug | bug |
| Accept | Aceptar |
| Send back | Devolver |
| Wait and see | Esperar e ver |
| poke | toque (verb: dar un toque) |
| wake (a team) | espertar |
| assumption | suposición |
| night watch | vixilancia nocturna (watchman: vixilancia, never "o vixía") |
| going quiet | pasar a modo silencio |
| No Token Mode | No Token Mode (feature name kept) |
| token | token |
| Verbose | Verbose (kept, as in the English setting name) |
| Look (project colour/emoji) | Aspecto |
| Permissions | Permisos |
| Views | Vistas |
| Docs | Documentos |
| Agent | axente |
| Pop out | Sacar nunha xanela |
| Space (🪐) | Espazo |
| Life board | Taboleiro de vida |
| friend | amizade |
| pretend friend | amizade de proba |
| GO (answer button) | Go (kept; GO in quoted replies) |
| Team news | Novas do equipo |
| AI tester | IA de probas (passed / failed = aprobada / suspensa) |
| click | premer ("Preme…"; "Fai clic" only where "preme" would clash with a key: "Fai clic ou preme Escape") |
| plug (an assumption) | corrixir |
| by itself (automatic) | automaticamente (never "soo"; "soa" only after a feminine noun) |
| raise (a bug) | informar dun / enviar (never "levantar") |

## For the reviewer (answered in the review)
- "taboleiro" for board: kept. It is the usual Galician word for a kanban board and reads naturally.
- "Por facer / En curso / Feito", "Para ti" and "Por {{dev:probar}}": kept. In running text the column is capitalised ("pasan a Feito").
- "Devolver" next to "Aceptar": kept; it is short and clear on a button.
- "dar un toque": kept. 🏇 "Chimpar o látego" (chimpar = throw / jump) is now "Estalar o látego"; "Manter os pratos xirando" kept.
- "Amizade" for a friend: kept for gender neutrality; "MD" for DM is fine. Fixed one leftover "dun amigo" (`inbox.sum.f.one`).
- Articles before epicene nouns ("o líder", "os axentes"): fine, grammatical gender.
- `{name}` after prepositions: "de {name}", "a {name}", "con {name}" never contract with a name, so all are fine.
- "ti" verb forms in long help texts: read through; fixed "cando preme" → "cando premes" and a few infinitives where the English is an instruction.

## Review
Native-speaker review, every value read next to the English (AIG-494).
- Filled in the 7 keys that were missing (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- Gender neutrality: removed masculine or feminine adjectives aimed at the reader or a friend ("se non estás seguro" → "se tes dúbidas", "xa ligados a ti", "Calado", "volves do silencio soa", "Coller tarxetas deles", "A súa copia queda con eles", "dun amigo").
- Glossary: `runin.blind` and `sm.night.title` still said "o vixía"; now "a vixilancia nocturna", and `sm.night.title` quotes the real setting label (`lead.watchAll`).
- `assignee.you.task` had lost its leading ": " that the code appends after "Ti".
- "soo" (not a word) → "automaticamente" (`gloss.hook.text`, `nt.title.limit`, `srv.limit`, `usage.check.auto`, `wz.plan.generous.help`, `wz.adv.usage.auto`).
- Calques: "Tapar isto" (plug) → "Corrixir isto"; "fóra do teu camiño" → "sen molestar"; "levanta bugs" → "envía bugs"; "Por facer quedou seco" → "quedou baleiro"; "Faladoiría" → "Conversa"; "retén {n}" → "bloquea {n}"; "Informar de {{dev:bug}}" → "Informar dun {{dev:bug}}"; "Aceptas?" → "De acordo?".
- Grammar: "cando che o lembra" → "cando te avisa"; "Instalala" on a button → "Instalar"; "poñeremos en contacto" → "poñerémonos en contacto"; "atascado" → "atascadas" where it lists cards; "páraos ao 60%" → "para ao 60%".
- "Ola!" on the welcome line → "Boas vindas!" as the register notes ask.
- Consistency: "pasar a modo silencio" everywhere for going quiet.

Still worth a human native check:
- "Persoa nova" for a new user (`trial.h`, `help.m.demo`) reads a little odd; there is no neutral short form that is clearly better.
- "Líder con conversa" for a chatty lead, and "Ao grao" for "Get on with it".
- Percent signs stay "{n}%" without a space, as in the first pass; RAG style prefers "50 %".
