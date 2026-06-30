param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (!(Test-Path -LiteralPath $chrome)) { throw "Chrome not found at $chrome" }

$config = Get-Content -LiteralPath (Join-Path $Root 'config\play-locales.json') -Raw | ConvertFrom-Json
$html = Join-Path $Root 'store-listing\render-assets.html'
$assetRoot = Join-Path $Root 'store-listing'

function New-Dir([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Render-Asset([string]$Url, [string]$Out, [int]$Width, [int]$Height) {
  if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Force }
  $args = @(
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    "--window-size=$Width,$Height",
    "--screenshot=$Out",
    $Url
  )
  $p = Start-Process -FilePath $chrome -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
  if ($p.ExitCode -ne 0 -or !(Test-Path -LiteralPath $Out)) {
    throw "Chrome render failed: $Out"
  }
}

$fileUri = ([System.Uri]$html).AbsoluteUri
foreach ($locale in $config.locales) {
  $base = Join-Path $Root $locale.storeListingSource
  $shotDir = Join-Path $base 'phone-screenshots'
  New-Dir $base
  New-Dir $shotDir
  Render-Asset "$fileUri`?type=feature&locale=$($locale.playLocale)" (Join-Path $base 'feature-graphic-1024x500.png') 1024 500
  for ($i = 0; $i -lt 8; $i++) {
    Render-Asset "$fileUri`?type=shot&locale=$($locale.playLocale)&shot=$i" (Join-Path $shotDir ("screenshot-{0:D2}.png" -f ($i + 1))) 1080 1920
  }
}

$default = Join-Path $Root 'store-listing\locales\ko-KR'
Copy-Item -LiteralPath (Join-Path $default 'feature-graphic-1024x500.png') -Destination (Join-Path $assetRoot 'feature-graphic-1024x500.png') -Force
$names = @('home','analyze','calendar','stats','report','profiles','privacy','routine')
for ($i = 1; $i -le 8; $i++) {
  Copy-Item -LiteralPath (Join-Path $default ("phone-screenshots\screenshot-{0:D2}.png" -f $i)) -Destination (Join-Path $assetRoot ("screenshot-{0}-{1}.png" -f $i, $names[$i - 1])) -Force
}

Write-Host "Rendered Chrome-based store assets for $($config.locales.Count) locales."
