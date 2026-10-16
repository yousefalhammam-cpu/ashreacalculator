$ErrorActionPreference = "Stop"

$failed = @()
$passed = 0
$startedAt = (Get-Date).ToString("o")

Get-ChildItem tests -Filter *.test.js | Sort-Object Name | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) {
    $failed += $_.Name
  } else {
    $passed += 1
  }
}

Write-Host "PASSED=$passed FAILED=$($failed.Count)"

$dist = Join-Path (Resolve-Path ".") "dist"
if (!(Test-Path -LiteralPath $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

$report = [ordered]@{
  name = "AirCalc Pro test report"
  startedAt = $startedAt
  finishedAt = (Get-Date).ToString("o")
  passed = $passed
  failed = $failed.Count
  failedTests = $failed
  status = $(if ($failed.Count -gt 0) { "failed" } else { "passed" })
}

$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $dist "test-report.json") -Encoding UTF8

if ($failed.Count -gt 0) {
  Write-Host "Failed tests: $($failed -join ', ')"
  exit 1
}
