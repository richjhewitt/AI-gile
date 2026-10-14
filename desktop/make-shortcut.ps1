# Puts an "AI-gile" shortcut on the Desktop and in the Start menu that opens the desktop app (AIG-76).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $exe)) { Write-Host 'Run npm install in this folder first.'; exit 1 }
$ico = Join-Path $here 'icon.ico'
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'AI-gile.lnk'))
  $lnk.TargetPath = $exe
  $lnk.Arguments = '"' + $here + '"'
  $lnk.WorkingDirectory = $here
  if (Test-Path $ico) { $lnk.IconLocation = $ico }
  $lnk.Description = 'AI-gile board'
  $lnk.Save()
  Write-Host "Shortcut made: $dir\AI-gile.lnk"
}
