$ErrorActionPreference = "Stop"

$version = "v1.0.0-beta.1"
$root = Resolve-Path "."
$dist = Join-Path $root "dist"
$staging = Join-Path $dist "aircalc-pro-$version"
$zip = Join-Path $dist "aircalc-pro-$version.zip"

$excludedRoots = @(
  ".git",
  ".edge-profile",
  "ashreacalculator-stabilization-v1",
  "node_modules",
  "dist",
  "test-hap-unzip"
)

$excludedFiles = @(
  ".server.err",
  ".server.out",
  "test-hap.xlsx",
  "test-hap.zip",
  "test-zip.zip",
  "ui-check-mobile.png"
)

if (Test-Path $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}

New-Item -ItemType Directory -Path $staging | Out-Null

Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
  if ($excludedRoots -contains $_.Name) { return }
  if ($excludedFiles -contains $_.Name) { return }

  $target = Join-Path $staging $_.Name
  if ($_.PSIsContainer) {
    Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
  } else {
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }
}

if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Compress-Archive -LiteralPath $staging -DestinationPath $zip -Force

$sizeMb = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 2)
Write-Host "Release package created: $zip ($sizeMb MB)"
