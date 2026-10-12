# Malayalam (ml) - first pass

Source of rules: LocoRadio docs/i18n.md (Malayalam is one of its languages; no special plural or script notes) and LocoRadio's ml.json for tone. Dates use `ml-IN`. Malayalam script, Arabic digits.

## Register
- Polite imperative `-ുക` for buttons and instructions (`സേവ് ചെയ്യുക`, `തുറക്കുക`), and polite "ningal" for you. Friendly but plain, like the English.
- Malayalam verbs carry no gender, so the reader, agents and friends need no workaround; pronouns are the neutral `അവർ`. Gendered role nouns are avoided (`കാഴ്ചക്കാരൻ` became `കാണാൻ മാത്രം`, `മനുഷ്യൻ` became `ഒരാൾ`).
- Developer words are written in Malayalam script as loanwords (`ബാക്ക്‌ലോഗ്`, `സ്പ്രിന്റ്`, `ബഗ്`, `കമ്മിറ്റ്`), inside `{{dev:...}}` exactly where the English has them. Case endings attach with a hyphen after Latin names and numbers (`{name}-ന്`, `Davy-യുടെ`, `AI-യുടെ`, `VS Code-ൽ`).
- Brand and product names, CLI commands, file names, keys and URLs stay in Latin script.
- Plurals: Malayalam only needs one/other. Both categories carry the same text where the noun does not change.
- Short forms: `{n} മിനിറ്റ് മുമ്പ്`, `{n} മണിക്കൂർ മുമ്പ്`, `{n} ദിവസം മുമ്പ്`; compact units `ദി` / `മ` / `മി`.

## Glossary
| English | Malayalam |
|---|---|
| card | കാർഡ് |
| board | ബോർഡ് |
| project | പ്രോജക്റ്റ് |
| team | ടീം |
| lead | ലീഡ് |
| Lead Scrum Master | Lead Scrum Master (kept in Latin) |
| For you | നിങ്ങൾക്ക് |
| For the team | ടീമിന് |
| To do | ചെയ്യാനുള്ളത് |
| In progress / Doing | പുരോഗമിക്കുന്നു |
| Team checking | ടീം പരിശോധിക്കുന്നു |
| Done | പൂർത്തിയായി |
| Backlog | ബാക്ക്‌ലോഗ് |
| sprint | സ്പ്രിന്റ് |
| stand-up | സ്റ്റാൻഡ്-അപ്പ് |
| inbox | ഇൻബോക്സ് |
| Setup | സെറ്റപ്പ് |
| Usage | ഉപയോഗം |
| test (noun/verb) | ടെസ്റ്റ് / ടെസ്റ്റ് ചെയ്യുക |
| test steps | ടെസ്റ്റ് ഘട്ടങ്ങൾ |
| AI tester | AI ടെസ്റ്റർ |
| bug | ബഗ് |
| Accept | സ്വീകരിക്കുക |
| Send back | തിരിച്ചയയ്ക്കുക |
| Wait and see | കാത്തിരുന്ന് കാണുക |
| poke | തട്ടി വിളിക്കുക |
| wake (a team) | ഉണർത്തുക |
| assumption | അനുമാനം |
| night watch | രാത്രി കാവൽ |
| going quiet | നിശ്ശബ്ദമാകുന്നു |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | ടോക്കൺ |
| Verbose | വെർബോസ് |
| Look (colour/emoji) | ലുക്ക് |
| Permissions | അനുമതികൾ |
| Views | കാഴ്ചകൾ |
| Docs | ഡോക്സ് |
| Agent / helper | ഏജന്റ് / സഹായി |
| Pop out | പുറത്തേക്ക് തുറക്കുക |
| Space (🪐) | സ്ഥലം |
| Life board | ജീവിത ബോർഡ് |
| pretend friend | സങ്കല്പ സുഹൃത്ത് |

## For the native reviewer
- `gloss.*.word` / `.also` hold Malayalam-script spellings; the hover glossary matches whole words, so inflected forms are listed in `.also` (sprints, standups, tests, bugs). Check they match what appears on screen.
- Malayalam is agglutinative: several `{{dev:...}}` terms and labels carry case endings (`{{dev:സ്പ്രിന്റിനും}}`); check they read naturally.
- "poke" is `തട്ടി വിളിക്കുക` (tap to call) and "wake" is `ഉണർത്തുക`: check the tone is right for a casual board.
- Chillu letters and spacing before `-ൽ`, `-ന്`, `-ഉം` after Latin words (`VS Code-ൽ`): confirm the hyphen convention is what readers expect.
- `സുഹൃത്ത്` is used for friend (neutral); `അംഗം` for member; `ടെസ്റ്റർ`, `ഡെവലപ്പർ` are loanwords with no gender marker.
- A few long help paragraphs (usage, scale.push.help, budget.help) were translated closely; a native reader may want to shorten them.
- "Davy" (the pretend friend's name) stays in Latin script.
