$ErrorActionPreference = "Stop"

$version = "v1.0.0-beta.1"
$root = Resolve-Path "."
$dist = Join-Path $root "dist"
$zip = Join-Path $dist "aircalc-pro-$version.zip"
$manifest = Join-Path $dist "aircalc-pro-$version.manifest.json"
$checksumFile = Join-Path $dist "aircalc-pro-$version.sha256"

if (!(Test-Path -LiteralPath $zip)) {
  Write-Host "Release package not found: $zip"
  exit 1
}

$zipItem = Get-Item -LiteralPath $zip
$hash = Get-FileHash -LiteralPath $zip -Algorithm SHA256

$payload = [ordered]@{
  product = "AirCalc Pro"
  version = $version
  channel = "beta"
  package = $zipItem.Name
  sizeBytes = $zipItem.Length
  sizeMb = [math]::Round($zipItem.Length / 1MB, 2)
  sha256 = $hash.Hash
  generatedAt = (Get-Date).ToString("o")
  verificationCommands = @(
    "npm run verify",
    "npm run browser:smoke",
    "npm run firebase:check",
    "npm run package:release",
    "npm run verify:release"
  )
  knownLimitations = @(
    "Firefox and Safari must be validated outside this Windows Chromium smoke path.",
    "Production Firebase deployment requires project credentials and explicit approval.",
    "Full manual UX acceptance remains required before public rollout."
  )
}

$payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding UTF8
"$($hash.Hash)  $($zipItem.Name)" | Set-Content -LiteralPath $checksumFile -Encoding ASCII

Write-Host "Release manifest written: $manifest"
Write-Host "Release checksum written: $checksumFile"
