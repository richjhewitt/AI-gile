; AI-gile Windows installer (AIG-1231): keep the installer's own file name next to the app.
; The join page names the download "AI-gile Setup (XXXX-XXXX).exe"; the board reads the claim code from this file on
; its first start (lib/join.js, AIGILE_SETUP_NAME set by desktop/main.js) and fetches the friend's invite with it.
!macro customInstall
  FileOpen $0 "$INSTDIR\setup-name.txt" w
  FileWrite $0 "$EXEFILE"
  FileClose $0
!macroend
