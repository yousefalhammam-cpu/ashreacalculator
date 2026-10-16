$ErrorActionPreference = "Stop"

$version = "v1.0.0-beta.1"
$zip = Join-Path (Resolve-Path ".") "dist\aircalc-pro-$version.zip"

if (!(Test-Path -LiteralPath $zip)) {
  Write-Host "Release package not found: $zip"
  exit 1
}

$blockedPatterns = @(
  ".edge-profile/",
  "node_modules/",
  ".git/",
  "test-hap-unzip/",
  ".server.err",
  ".server.out",
  "test-hap.xlsx",
  "test-hap.zip",
  "test-zip.zip",
  "ui-check-mobile.png"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)

try {
  $entries = $archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") }
  $violations = @()

  foreach ($pattern in $blockedPatterns) {
    $matches = $entries | Where-Object { $_ -like "*$pattern*" }
    if ($matches) {
      $violations += $matches
    }
  }

  $required = @(
    "package.json",
    "app/index.html",
    "app.js",
    "styles.css",
    "firestore.rules",
    "FINAL_BETA_CERTIFICATION.md"
  )

  $missing = @()
  foreach ($file in $required) {
    if (!($entries | Where-Object { $_ -like "*/$file" -or $_ -eq $file })) {
      $missing += $file
    }
  }

  if ($violations.Count -gt 0) {
    Write-Host "Release package contains blocked files:"
    $violations | Sort-Object -Unique | ForEach-Object { Write-Host "- $_" }
    exit 1
  }

  if ($missing.Count -gt 0) {
    Write-Host "Release package is missing required files: $($missing -join ', ')"
    exit 1
  }

  Write-Host "Release package verification passed: $zip"
} finally {
  $archive.Dispose()
}
