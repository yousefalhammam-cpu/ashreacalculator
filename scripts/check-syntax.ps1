$ErrorActionPreference = "Stop"

$files = @(
  "app.js",
  "modules\hvac-design-copilot.js",
  "modules\equipment-selector.js",
  "modules\equipment-database.js",
  "js\core\engineering-calculation-engine.js",
  "js\copilot\copilot-health-engine.js",
  "js\equipment\equipment-selection-engine.js",
  "js\ai\ai-explanation-client.js",
  "js\firebase-auth.js"
)

$failed = @()

foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) {
    $failed += $file
  }
}

if ($failed.Count -gt 0) {
  Write-Host "Syntax check failed for $($failed.Count) file(s): $($failed -join ', ')"
  exit 1
}

Write-Host "Syntax check passed for $($files.Count) file(s)."
