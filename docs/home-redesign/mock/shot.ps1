param(
  [Parameter(Mandatory = $true)][string]$Name,
  [int]$Width = 390,
  [int]$Height = 844
)

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$dir = $PSScriptRoot
$outDir = Join-Path $dir 'shots'
New-Item -ItemType Directory -Force $outDir | Out-Null

$src = 'file:///' + ((Join-Path $dir "$Name.html") -replace '\\', '/')
$out = Join-Path $outDir "$Name.png"
if (Test-Path $out) { Remove-Item $out -Force }

& $chrome `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --force-device-scale-factor=2 `
  --window-size="$Width,$Height" `
  --virtual-time-budget=4000 `
  --user-data-dir="$env:TEMP\wx-home-shot" `
  --screenshot="$out" `
  $src | Out-Null

if (-not (Test-Path $out)) { throw "screenshot failed: $out" }
Write-Output ("{0}  {1}" -f $out, (Get-Item $out).Length)
