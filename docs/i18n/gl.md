# Galician (gl) - first pass

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

## For the reviewer
- "taboleiro" for board (some teams say "board" or "panel"): check.
- "Por facer / En curso / Feito" for the columns and "Para ti" for For you; "Por {{dev:probar}}" for the Verify column.
- "Devolver" for Send back next to "Aceptar".
- "dar un toque" for poke and the playful `sm.push.*` / `scale.*` lines (🍽️ "Manter os pratos xirando", 🏇 "Chimpar o látego").
- "Amizade" for a single friend is correct but some readers may prefer "persoa amiga"; "MD" for DM (mensaxe directa).
- Articles before epicene nouns ("o líder", "os axentes") stay masculine by grammar.
- `{name}` stays in its basic form; prepositions that contract ("de {name}", "a {name}") should be checked before vowels.
- Verb forms with "tu" in long help texts (`trust.help`, `budget.*`, `scale.*`) for naturalness.
