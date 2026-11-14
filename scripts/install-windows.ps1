$ErrorActionPreference = 'Stop'
$version = 'v0.5.0'
$base = "https://github.com/kishann-19/Aster-System_Assistant/releases/download/$version"
$destination = Join-Path $env:LOCALAPPDATA 'Programs\Aster-0.5.0'
$executable = Join-Path $destination 'Aster.exe'
if (-not [Environment]::Is64BitOperatingSystem) { throw 'This build requires 64-bit Windows.' }
if (Test-Path $executable) {
  Write-Host "Aster is already installed at $executable"
  Start-Process $executable
  return
}
$temp = Join-Path ([IO.Path]::GetTempPath()) ("aster-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $zip = Join-Path $temp 'Aster-Windows.zip'
  $checksum = Join-Path $temp 'Aster-Windows.sha256'
  Invoke-WebRequest "$base/Aster-Windows.zip" -OutFile $zip
  Invoke-WebRequest "$base/Aster-Windows.sha256" -OutFile $checksum
  $expected = ((Get-Content $checksum -Raw).Trim() -split '\s+')[0]
  if ((Get-FileHash -Algorithm SHA256 $zip).Hash -ne $expected) { throw 'Download checksum mismatch.' }
  Expand-Archive $zip (Join-Path $temp 'unpacked')
  $source = Join-Path $temp 'unpacked\Aster-win32-x64'
  if (-not (Test-Path (Join-Path $source 'Aster.exe'))) { throw 'Aster executable is missing from the download.' }
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Move-Item $source $destination
  $programs = [Environment]::GetFolderPath('Programs')
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $programs 'Aster.lnk'))
  $shortcut.TargetPath = $executable
  $shortcut.WorkingDirectory = $destination
  $shortcut.Save()
  Write-Host "Installed at $executable"
  Start-Process $executable
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
