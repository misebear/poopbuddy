param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Add-Type -AssemblyName System.Drawing

$config = Get-Content -LiteralPath (Join-Path $Root 'config\play-locales.json') -Raw | ConvertFrom-Json
$failures = New-Object System.Collections.Generic.List[string]

foreach ($locale in $config.locales) {
  $base = Join-Path $Root $locale.storeListingSource
  $feature = Join-Path $base 'feature-graphic-1024x500.png'
  if (!(Test-Path -LiteralPath $feature)) {
    $failures.Add("Missing feature graphic: $($locale.playLocale)")
  } else {
    $img = [System.Drawing.Image]::FromFile($feature)
    if ($img.Width -ne 1024 -or $img.Height -ne 500) { $failures.Add("Bad feature size $($locale.playLocale): $($img.Width)x$($img.Height)") }
    $img.Dispose()
  }

  $shots = Get-ChildItem -LiteralPath (Join-Path $base 'phone-screenshots') -Filter '*.png' -ErrorAction SilentlyContinue | Sort-Object Name
  if ($shots.Count -ne 8) { $failures.Add("Expected 8 phone screenshots for $($locale.playLocale), found $($shots.Count)") }
  foreach ($shot in $shots) {
    $img = [System.Drawing.Image]::FromFile($shot.FullName)
    if ($img.Width -ne 1080 -or $img.Height -ne 1920) { $failures.Add("Bad screenshot size $($locale.playLocale)/$($shot.Name): $($img.Width)x$($img.Height)") }
    if ($shot.Length -lt 50000) { $failures.Add("Screenshot suspiciously small $($locale.playLocale)/$($shot.Name): $($shot.Length)") }
    $img.Dispose()
  }

  if (!(Test-Path -LiteralPath (Join-Path $base 'STORE_LISTING.md'))) { $failures.Add("Missing listing markdown: $($locale.playLocale)") }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Host "Store asset verification passed for $($config.locales.Count) locales."
